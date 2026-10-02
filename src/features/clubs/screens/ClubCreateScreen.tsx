import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { navigateBackOrFallback } from '@/lib/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { profileService, type UserProfile } from '@/features/auth/services/profileService';
import { useCreateClub } from '@/features/clubs/hooks/useClubs';
import { type AccessLevel, type ClubType, type MeetingType } from '@/features/clubs/services/clubsService';
import { formatAccessLevel, formatClubType, formatMeetingType } from './manage';

const colors = {
    bgPrimary: '#FAF6EE', bgCard: '#FFFEFC', bgSecondary: '#F8EBE7',
    border: '#E7DCD1', accent: '#8B322C', textPrimary: '#1A1412',
    textSecondary: '#6E645F', textTertiary: '#746860',
    error: '#A12D28', errorLight: '#FCEDEA',
} as const;

type CreateClubType = ClubType;

const BASE_CLUB_TYPE_OPTIONS: CreateClubType[] = ['public', 'approval', 'invite_only'];
const ACCESS_LEVEL_OPTIONS: AccessLevel[] = ['all', 'pro', 'pro_plus'];
const MEETING_TYPE_OPTIONS: Array<MeetingType | null> = [null, 'online_only', 'venue_based', 'hybrid'];

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) return error.message;
    if (error && typeof error === 'object' && 'message' in error) {
        const message = String((error as { message?: unknown }).message ?? '');
        if (message) return message;
    }
    return fallback;
}

export default function ClubCreateScreen() {
    const { user } = useAuth();
    const createClub = useCreateClub();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [coverUrl, setCoverUrl] = useState('');
    const [clubType, setClubType] = useState<CreateClubType>('public');
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [accessLevel, setAccessLevel] = useState<AccessLevel>('all');
    const [meetingType, setMeetingType] = useState<MeetingType | null>(null);
    const [maxMembers, setMaxMembers] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
    const clubTypeOptions = useMemo(() => profile?.is_verified_author ? [...BASE_CLUB_TYPE_OPTIONS, 'author_club' as const] : BASE_CLUB_TYPE_OPTIONS, [profile?.is_verified_author]);

    useEffect(() => {
        let active = true;
        if (!user?.id) {
            setProfile(null);
            return;
        }
        profileService.getProfile(user.id)
            .then((result) => { if (active) setProfile(result); })
            .catch(() => { if (active) setProfile(null); });
        return () => { active = false; };
    }, [user?.id]);

    const validationMessage = useMemo(() => {
        const trimmedName = name.trim();
        if (trimmedName.length === 0) return 'Club name is required.';
        if (trimmedName.length < 3) return 'Club name must be at least 3 characters.';
        if (maxMembers.trim()) {
            const parsed = Number(maxMembers.trim());
            if (!Number.isInteger(parsed) || parsed < 2) return 'Member cap must be a whole number of at least 2.';
        }
        if (coverUrl.trim() && !/^https?:\/\//i.test(coverUrl.trim())) return 'Cover image must be an http or https URL.';
        return null;
    }, [coverUrl, maxMembers, name]);

    const handleSubmit = async () => {
        if (!user?.id) {
            setFeedback({ type: 'error', message: 'Sign in before creating a club.' });
            return;
        }
        if (validationMessage) {
            setFeedback({ type: 'error', message: validationMessage });
            return;
        }

        try {
            setFeedback(null);
            const createdClub = await createClub.mutateAsync({
                name: name.trim(),
                description: description.trim() || undefined,
                cover_url: coverUrl.trim() || undefined,
                club_type: clubType,
                access_level: accessLevel,
                meeting_type: meetingType ?? undefined,
                admin_id: user.id,
                max_members: maxMembers.trim() ? Number(maxMembers.trim()) : undefined,
                author_id: clubType === 'author_club' ? profile?.id : undefined,
            });
            setFeedback({ type: 'success', message: 'Club created.' });
            router.replace(`/clubs/${createdClub.id}`);
        } catch (error) {
            setFeedback({ type: 'error', message: getErrorMessage(error, 'Unable to create this club right now.') });
        }
    };

    // PRODUCT-14: no pre-creation banner upload. Banners are club-owned and
    // uploaded from manage settings after the club exists; here only a URL
    // may be pasted. The old drafts/{uid}-{ts} upload path was removed with
    // the club-banners Storage lockdown (CLUB-BACKEND-01).

    const renderOption = <T extends string | null>({
        value,
        selected,
        label,
        testID,
        onPress,
        layout,
    }: {
        value: T;
        selected: boolean;
        label: string;
        testID: string;
        onPress: (value: T) => void;
        layout: 'full' | 'third' | 'half';
    }) => (
        <TouchableOpacity
            key={value ?? 'none'}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={selected ? `${label}, selected` : label}
            accessibilityState={{ selected }}
            onPress={() => onPress(value)}
            style={[
                styles.option,
                layout === 'full' ? styles.fullOption : layout === 'third' ? styles.thirdOption : styles.halfOption,
                {
                    backgroundColor: selected ? colors.accent : colors.bgCard,
                    borderColor: selected ? colors.accent : colors.border,
                },
            ]}
        >
            <Text style={[styles.optionText, { color: selected ? '#FFFFFF' : colors.textPrimary }]}>{label}</Text>
            {selected ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to clubs" onPress={() => navigateBackOrFallback(router, '/clubs')} style={styles.iconButton} testID="create-club-back">
                    <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Create club</Text>
                <View style={styles.iconButton} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <View style={styles.introduction}>
                    <Text accessibilityRole="header" style={styles.pageTitle}>Create club</Text>
                    <Text style={styles.introText}>Start a book club for readers to gather, discuss, and read together.</Text>
                </View>
                {!user?.id ? (
                    <View style={[styles.noticeCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Sign in required</Text>
                        <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>You need an authenticated reader account before you can create and manage a club.</Text>
                    </View>
                ) : null}

                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Club basics</Text>

                    <Text style={[styles.label, { color: colors.textPrimary }]}>Name <Text style={styles.fieldHint}>· Required</Text></Text>
                    <TextInput
                        accessibilityLabel="Club name, required"
                        value={name}
                        onChangeText={setName}
                        placeholder="Weekend literary circle"
                        placeholderTextColor={colors.textTertiary}
                        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                        testID="create-club-name"
                    />
                    <Text style={styles.helperText}>At least 3 characters.</Text>

                    <Text style={[styles.label, { color: colors.textPrimary }]}>Description <Text style={styles.fieldHint}>· Optional</Text></Text>
                    <TextInput
                        accessibilityLabel="Description, optional"
                        value={description}
                        onChangeText={setDescription}
                        placeholder="What kind of readers should join?"
                        placeholderTextColor={colors.textTertiary}
                        style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.textPrimary }]}
                        multiline
                        numberOfLines={4}
                        testID="create-club-description"
                    />

                    <Text style={[styles.label, { color: colors.textPrimary }]}>Cover image URL <Text style={styles.fieldHint}>· Optional</Text></Text>
                    {coverUrl.trim() ? (
                        <Image source={{ uri: coverUrl.trim() }} style={[styles.coverPreview, { borderColor: colors.border }]} contentFit="cover" testID="create-club-cover-preview" />
                    ) : null}
                    <Text style={[styles.coverHint, { color: colors.textTertiary }]}>Banners are uploaded from club settings after the club is created. Paste an image URL here or add the banner later.</Text>
                    <TextInput
                        accessibilityLabel="Cover image URL, optional"
                        value={coverUrl}
                        onChangeText={setCoverUrl}
                        placeholder="https://..."
                        placeholderTextColor={colors.textTertiary}
                        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                        autoCapitalize="none"
                        keyboardType="url"
                        testID="create-club-cover-url"
                    />

                    <Text style={[styles.label, { color: colors.textPrimary }]}>Member cap <Text style={styles.fieldHint}>· Optional</Text></Text>
                    <TextInput
                        accessibilityLabel="Member cap, optional"
                        value={maxMembers}
                        onChangeText={setMaxMembers}
                        placeholder="Leave blank for unlimited"
                        placeholderTextColor={colors.textTertiary}
                        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                        keyboardType="number-pad"
                        testID="create-club-max-members"
                    />
                    <Text style={styles.helperText}>If set, enter a whole number of at least 2.</Text>
                </View>

                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Access & format</Text>

                    <Text style={[styles.label, { color: colors.textSecondary }]}>Club type</Text>
                    <View style={styles.optionColumn}>
                        {clubTypeOptions.map((option) => renderOption({
                            value: option,
                            selected: clubType === option,
                            label: formatClubType(option),
                            testID: `create-club-type-${option}`,
                            onPress: setClubType,
                            layout: 'full',
                        }))}
                    </View>
                    {profile?.is_verified_author ? (
                        <Text style={[styles.helperText, { color: colors.textSecondary }]}>Verified author profile detected. Author clubs keep the verified author identity attached to the club.</Text>
                    ) : null}

                    <Text style={[styles.label, { color: colors.textSecondary }]}>Access level</Text>
                    <View style={styles.optionGroup}>
                        {ACCESS_LEVEL_OPTIONS.map((option) => renderOption({
                            value: option,
                            selected: accessLevel === option,
                            label: formatAccessLevel(option),
                            testID: `create-club-access-${option}`,
                            onPress: setAccessLevel,
                            layout: 'third',
                        }))}
                    </View>

                    <Text style={[styles.label, { color: colors.textSecondary }]}>Meeting format</Text>
                    <View style={styles.optionGroup}>
                        {MEETING_TYPE_OPTIONS.map((option) => renderOption({
                            value: option,
                            selected: meetingType === option,
                            label: formatMeetingType(option),
                            testID: `create-club-meeting-${option ?? 'none'}`,
                            onPress: setMeetingType,
                            layout: 'half',
                        }))}
                    </View>
                </View>

                {feedback ? (
                    <View
                        accessibilityLiveRegion="polite"
                        style={[
                            styles.feedback,
                            {
                                backgroundColor: feedback.type === 'error' ? colors.errorLight : colors.bgSecondary,
                                borderColor: feedback.type === 'error' ? colors.error : colors.accent,
                            },
                        ]}
                    >
                        <Text style={[styles.feedbackText, { color: feedback.type === 'error' ? colors.error : colors.accent }]}>{feedback.message}</Text>
                    </View>
                ) : null}

                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={!user?.id || createClub.isPending}
                    accessibilityRole="button"
                    accessibilityLabel={createClub.isPending ? 'Creating club' : 'Create club'}
                    accessibilityState={{ disabled: !user?.id || createClub.isPending, busy: createClub.isPending }}
                    aria-busy={createClub.isPending}
                    style={[styles.submitButton, { backgroundColor: colors.accent, opacity: !user?.id || createClub.isPending ? 0.55 : 1 }]}
                    testID="create-club-submit"
                >
                    {createClub.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Create club</Text>}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { minHeight: 56, borderBottomWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 21 },
    content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, paddingBottom: 120, gap: 16 },
    introduction: { gap: 6, paddingVertical: 4 },
    pageTitle: { color: colors.textPrimary, fontFamily: 'Newsreader_600SemiBold', fontSize: 30, lineHeight: 36 },
    introText: { color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    card: { borderWidth: 1, borderRadius: 12, padding: 16 },
    sectionTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 22, lineHeight: 28, marginBottom: 4 },
    label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 19, marginBottom: 8, marginTop: 16 },
    fieldHint: { color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12 },
    input: { backgroundColor: colors.bgCard, minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    textArea: { minHeight: 96, textAlignVertical: 'top' },
    coverPreview: { alignSelf: 'center', width: 120, height: 160, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
    coverHint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 10 },
    optionColumn: { gap: 8 },
    optionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    option: { minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    fullOption: { width: '100%', justifyContent: 'space-between' },
    thirdOption: { flex: 1 },
    halfOption: { flexBasis: '47%', flexGrow: 1 },
    optionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 19, flexShrink: 1 },
    helperText: { color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 6 },
    noticeCard: { borderWidth: 1, borderRadius: 10, padding: 14 },
    noticeTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 21, marginBottom: 6 },
    noticeBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    feedback: { borderWidth: 1, borderRadius: 8, padding: 12 },
    feedbackText: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 21 },
    submitButton: { borderRadius: 8, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    submitText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
});
