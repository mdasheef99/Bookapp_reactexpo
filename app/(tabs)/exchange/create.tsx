import { useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    FlatList, StyleSheet, ActivityIndicator, Alert, Platform, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { profileService } from '@/features/auth/services/profileService';
import { booksService } from '@/features/books/services/booksService';
import { useCreateListing } from '@/features/exchange/hooks/useListings';
import { DELIVERY_OPTION_META, ENABLED_DELIVERY_OPTIONS } from '@/features/exchange/config/exchangeConfig';
import type { BookCondition, DeliveryOption } from '@/features/exchange/services/listingsService';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITIONS: { value: BookCondition; label: string; emoji: string }[] = [
    { value: 'new', label: 'New', emoji: '✨' },
    { value: 'like_new', label: 'Like New', emoji: '⭐' },
    { value: 'good', label: 'Good', emoji: '👍' },
    { value: 'acceptable', label: 'Okay', emoji: '👌' },
    { value: 'poor', label: 'Poor', emoji: '📦' },
];

const DELIVERY_OPTIONS: { value: DeliveryOption; label: string; emoji: string }[] = ENABLED_DELIVERY_OPTIONS.map(value => ({
    value,
    label: DELIVERY_OPTION_META[value].label,
    emoji: DELIVERY_OPTION_META[value].emoji,
}));

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CreateListingScreen() {
    const { session } = useAuth();
    const { colors } = useTheme();
    const createListing = useCreateListing();

    const [selectedUserBookId, setSelectedUserBookId] = useState<string | null>(null);
    const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
    const [condition, setCondition] = useState<BookCondition | null>(null);
    const [conditionNotes, setConditionNotes] = useState('');
    const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
    const [photoUris, setPhotoUris] = useState<string[]>([]);

    const { data: library, isLoading: libraryLoading, isError: libraryError } = useQuery({
        queryKey: ['library', session?.user?.id],
        queryFn: () => booksService.getUserLibrary(session!.user.id, {
            excludeOwnership: ['wishlist', 'borrowed', 'lent_out'],
        }),
        enabled: !!session?.user?.id,
        retry: 0,
    });

    const { data: profile } = useQuery({
        queryKey: ['profile', session?.user?.id],
        queryFn: () => profileService.getProfile(session!.user.id),
        enabled: !!session?.user?.id,
        retry: 1,
    });

    // ── Handlers ─────────────────────────────────────────────────────────────

    const toggleDelivery = (option: DeliveryOption) =>
        setDeliveryOptions(prev =>
            prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
        );

    const pickPhoto = async () => {
        if (photoUris.length >= 4) return;
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow photo access to add listing photos.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            quality: 0.8,
            allowsMultipleSelection: Platform.OS !== 'web',
            selectionLimit: 4 - photoUris.length,
        });
        if (!result.canceled) {
            setPhotoUris(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 4));
        }
    };

    const removePhoto = (index: number) =>
        setPhotoUris(prev => prev.filter((_, i) => i !== index));

    const canSubmit =
        !!selectedUserBookId && !!selectedBookId && !!condition &&
        deliveryOptions.length > 0 && photoUris.length >= 2 && !!profile?.city;

    const handleSubmit = () => {
        if (!canSubmit || !session?.user?.id) return;
        createListing.mutate(
            {
                userBookId: selectedUserBookId!,
                ownerId: session.user.id,
                bookId: selectedBookId!,
                condition: condition!,
                conditionNotes: conditionNotes.trim() || undefined,
                photoUris,
                deliveryOptions,
                city: profile!.city,
            },
            {
                onSuccess: () => router.back(),
                onError: (err) => Alert.alert('Error', err.message || 'Failed to create listing.'),
            }
        );
    };

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#EEF2FF', '#E0E7FF', '#C7D2FE']}
                style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>List a Book</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* ── 1. Book Picker ─────────────────────────────────────── */}
                <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Select Book</Text>
                {libraryLoading ? (
                    <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
                ) : libraryError || !library?.length ? (
                    <View style={[styles.emptyLibrary, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.emptyLibraryText, { color: colors.textSecondary }]}>
                            No owned books ready to list. Add a book to your library first.
                        </Text>
                    </View>
                ) : (
                    <FlatList horizontal data={library} keyExtractor={b => b.id}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.bookList}
                        renderItem={({ item }) => {
                            const book = (item as any).book;
                            const isSelected = item.id === selectedUserBookId;
                            return (
                                <TouchableOpacity activeOpacity={0.8}
                                    onPress={() => { setSelectedUserBookId(item.id); setSelectedBookId(book?.id ?? null); }}
                                    style={[styles.bookCard, { backgroundColor: colors.bgCard, borderColor: isSelected ? colors.accent : colors.border },
                                        isSelected && styles.bookCardSelected]}>
                                    {book?.cover_url ? (
                                        <Image source={{ uri: book.cover_url }} style={styles.bookCover} resizeMode="cover" />
                                    ) : (
                                        <View style={[styles.bookCover, styles.bookCoverPlaceholder, { backgroundColor: colors.bgSecondary }]}>
                                            <Ionicons name="book-outline" size={24} color={colors.textTertiary} />
                                        </View>
                                    )}
                                    <Text style={[styles.bookTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                                        {book?.title ?? 'Unknown'}
                                    </Text>
                                    {isSelected && (
                                        <View style={[styles.selectedBadge, { backgroundColor: colors.accent }]}>
                                            <Ionicons name="checkmark" size={12} color="#FFF" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                    />
                )}

                {/* ── 2. Condition ───────────────────────────────────────── */}
                <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Condition</Text>
                <View style={styles.chipWrap}>
                    {CONDITIONS.map(c => {
                        const active = condition === c.value;
                        return (
                            <TouchableOpacity key={c.value} onPress={() => setCondition(c.value)}
                                style={[styles.chip, { borderColor: active ? colors.accent : colors.border },
                                    active && { backgroundColor: colors.accent }]}>
                                <Text style={[styles.chipText, { color: active ? '#FFF' : colors.textSecondary }]}>
                                    {c.emoji} {c.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ── 3. Condition Notes ─────────────────────────────────── */}
                <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
                    Notes <Text style={{ color: colors.textTertiary }}>(optional)</Text>
                </Text>
                <TextInput
                    style={[styles.notesInput, { backgroundColor: colors.bgCard, borderColor: colors.border, color: colors.textPrimary }]}
                    placeholder="e.g. Minor spine crease, no highlights..."
                    placeholderTextColor={colors.textTertiary}
                    value={conditionNotes} onChangeText={setConditionNotes}
                    multiline numberOfLines={3} maxLength={300}
                />

                {/* ── 4. Delivery Options ────────────────────────────────── */}
                <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
                    Delivery <Text style={{ color: colors.textTertiary }}>(pick all that apply)</Text>
                </Text>
                <View style={styles.chipWrap}>
                    {DELIVERY_OPTIONS.map(d => {
                        const active = deliveryOptions.includes(d.value);
                        return (
                            <TouchableOpacity key={d.value} onPress={() => toggleDelivery(d.value)}
                                style={[styles.chip, { borderColor: active ? colors.accent : colors.border },
                                    active && { backgroundColor: colors.accent }]}>
                                <Text style={[styles.chipText, { color: active ? '#FFF' : colors.textSecondary }]}>
                                    {d.emoji} {d.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ── 5. Photos ──────────────────────────────────────────── */}
                <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
                    Photos <Text style={{ color: colors.textTertiary }}>(2–4 required)</Text>
                </Text>
                <View style={styles.photoGrid}>
                    {[0, 1, 2, 3].map(i => {
                        const uri = photoUris[i];
                        return (
                            <View key={i} style={[styles.photoSlot,
                                { borderColor: i < 2 && !uri ? '#EF4444' : colors.border }]}>
                                {uri ? (
                                    <>
                                        <Image source={{ uri }} style={styles.photoThumb} />
                                        <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                                            <Ionicons name="close-circle" size={22} color="#EF4444" />
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <TouchableOpacity style={styles.photoAdd} onPress={pickPhoto}
                                        disabled={photoUris.length >= 4}>
                                        <Ionicons name="camera-outline" size={28} color={colors.textTertiary} />
                                        <Text style={[styles.photoAddText, { color: colors.textTertiary }]}>
                                            {i < 2 ? 'Required' : 'Optional'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* ── No city warning ────────────────────────────────────── */}
                {!profile?.city && (
                    <View style={styles.warningBanner}>
                        <Ionicons name="warning-outline" size={16} color="#B45309" />
                        <Text style={styles.warningText}>Set your city in Profile settings before listing.</Text>
                    </View>
                )}

                {/* ── Submit ─────────────────────────────────────────────── */}
                <TouchableOpacity onPress={handleSubmit}
                    disabled={!canSubmit || createListing.isPending}
                    activeOpacity={0.85} style={{ marginTop: 16, marginBottom: 48 }}>
                    <LinearGradient
                        colors={canSubmit ? [colors.accent, colors.accentLight] : ['#CBD5E1', '#CBD5E1']}
                        style={styles.submitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        {createListing.isPending
                            ? <ActivityIndicator color="#FFF" />
                            : <Text style={styles.submitText}>
                                {canSubmit ? 'List Book' : 'Complete all fields to list'}
                              </Text>}
                    </LinearGradient>
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '700' },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
    sectionLabel: { fontSize: 15, fontWeight: '700', marginTop: 24, marginBottom: 10 },
    bookList: { gap: 12, paddingBottom: 4 },
    bookCard: {
        width: 100, borderRadius: 12, borderWidth: 2,
        padding: 8, alignItems: 'center', position: 'relative',
    },
    bookCardSelected: { shadowColor: '#6366F1', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    bookCover: { width: 76, height: 108, borderRadius: 6 },
    bookCoverPlaceholder: { justifyContent: 'center', alignItems: 'center' },
    bookTitle: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 6 },
    selectedBadge: {
        position: 'absolute', top: 4, right: 4,
        width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    },
    emptyLibrary: { borderRadius: 12, borderWidth: 1, padding: 20, alignItems: 'center' },
    emptyLibraryText: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
    chipText: { fontSize: 13, fontWeight: '600' },
    notesInput: {
        borderWidth: 1, borderRadius: 12, padding: 14,
        fontSize: 14, minHeight: 80, textAlignVertical: 'top',
    },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    photoSlot: {
        width: '47%', aspectRatio: 1, borderRadius: 12,
        borderWidth: 2, borderStyle: 'dashed', overflow: 'hidden',
    },
    photoThumb: { width: '100%', height: '100%' },
    photoRemove: { position: 'absolute', top: 6, right: 6 },
    photoAdd: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 },
    photoAddText: { fontSize: 12, fontWeight: '600' },
    warningBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: '#FDE68A', marginTop: 16,
    },
    warningText: { fontSize: 13, fontWeight: '600', color: '#B45309' },
    submitBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});

