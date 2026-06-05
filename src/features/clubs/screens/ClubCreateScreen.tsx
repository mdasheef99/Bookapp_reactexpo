import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { navigateBackOrFallback } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { profileService, type UserProfile } from '@/features/auth/services/profileService';
import { useCreateClub } from '@/features/clubs/hooks/useClubs';
import { type AccessLevel, type ClubType, type MeetingType } from '@/features/clubs/services/clubsService';
import { useTheme } from '@/hooks/useTheme';
import { formatAccessLevel, formatClubType, formatMeetingType } from './manage';

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
    const { colors } = useTheme();
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
    const [isUploadingCover, setIsUploadingCover] = useState(false);
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

    const pickCoverImage = async () => {
        if (!user?.id) {
            setFeedback({ type: 'error', message: 'Sign in before selecting a cover image.' });
            return;
        }

        try {
            setFeedback(null);
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                setFeedback({ type: 'error', message: 'Permission denied. Please allow photo access to select a cover image, or enter a URL.' });
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                mediaTypes: (ImagePicker as any).MediaType?.Images ?? ImagePicker.MediaTypeOptions.Images,
                quality: 0.85,
                allowsEditing: true,
                aspect: [3, 4],
            });

            if (result.canceled || !result.assets?.length) return;

            setIsUploadingCover(true);
            const asset = result.assets[0];
            const response = await fetch(asset.uri);
            if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);

            const blob = await response.blob();
            const contentType = asset.mimeType || blob.type || 'image/jpeg';
            const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
            const path = `drafts/${user.id}-${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage.from('club-banners').upload(path, blob, { contentType, upsert: true });
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('club-banners').getPublicUrl(path);
            setCoverUrl(data.publicUrl);
        } catch (error) {
            setFeedback({ type: 'error', message: getErrorMessage(error, 'Unable to upload this cover image. You can still enter an image URL.') });
        } finally {
            setIsUploadingCover(false);
        }
    };

    const renderOption = <T extends string | null>({
        value,
        selected,
        label,
        testID,
        onPress,
    }: {
        value: T;
        selected: boolean;
        label: string;
        testID: string;
        onPress: (value: T) => void;
    }) => (
        <TouchableOpacity
            key={value ?? 'none'}
            testID={testID}
            onPress={() => onPress(value)}
            style={[
                styles.option,
                {
                    backgroundColor: selected ? colors.accent : colors.bgSecondary,
                    borderColor: selected ? colors.accent : colors.border,
                },
            ]}
        >
            <Text style={[styles.optionText, { color: selected ? '#FFFFFF' : colors.textPrimary }]}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigateBackOrFallback(router, '/clubs')} style={styles.iconButton} testID="create-club-back">
                    <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Create club</Text>
                <View style={styles.iconButton} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {!user?.id ? (
                    <View style={[styles.noticeCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Sign in required</Text>
                        <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>You need an authenticated reader account before you can create and manage a club.</Text>
                    </View>
                ) : null}

                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Club basics</Text>

                    <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
                    <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="Weekend literary circle"
                        placeholderTextColor={colors.textTertiary}
                        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                        testID="create-club-name"
                    />

                    <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
                    <TextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder="What kind of readers should join?"
                        placeholderTextColor={colors.textTertiary}
                        style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.textPrimary }]}
                        multiline
                        numberOfLines={4}
                        testID="create-club-description"
                    />

                    <Text style={[styles.label, { color: colors.textSecondary }]}>Cover image URL</Text>
                    {coverUrl.trim() ? (
                        <Image source={{ uri: coverUrl.trim() }} style={[styles.coverPreview, { borderColor: colors.border }]} contentFit="cover" testID="create-club-cover-preview" />
                    ) : null}
                    <TouchableOpacity
                        onPress={pickCoverImage}
                        disabled={isUploadingCover}
                        style={[styles.coverButton, { borderColor: colors.accent, opacity: isUploadingCover ? 0.65 : 1 }]}
                        testID="create-club-pick-cover"
                    >
                        {isUploadingCover ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={[styles.coverButtonText, { color: colors.accent }]}>{coverUrl.trim() ? 'Change cover image' : 'Select cover image'}</Text>}
                    </TouchableOpacity>
                    <TextInput
                        value={coverUrl}
                        onChangeText={setCoverUrl}
                        placeholder="https://..."
                        placeholderTextColor={colors.textTertiary}
                        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                        autoCapitalize="none"
                        keyboardType="url"
                        testID="create-club-cover-url"
                    />

                    <Text style={[styles.label, { color: colors.textSecondary }]}>Member cap</Text>
                    <TextInput
                        value={maxMembers}
                        onChangeText={setMaxMembers}
                        placeholder="Leave blank for unlimited"
                        placeholderTextColor={colors.textTertiary}
                        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                        keyboardType="number-pad"
                        testID="create-club-max-members"
                    />
                </View>

                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Access</Text>

                    <Text style={[styles.label, { color: colors.textSecondary }]}>Club type</Text>
                    <View style={styles.optionGroup}>
                        {clubTypeOptions.map((option) => renderOption({
                            value: option,
                            selected: clubType === option,
                            label: formatClubType(option),
                            testID: `create-club-type-${option}`,
                            onPress: setClubType,
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
                        }))}
                    </View>
                </View>

                {feedback ? (
                    <View
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
    header: { minHeight: 58, borderBottomWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    content: { padding: 16, paddingBottom: 120, gap: 14 },
    card: { borderWidth: 1, borderRadius: 16, padding: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14 },
    label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 12 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
    textArea: { minHeight: 96, textAlignVertical: 'top' },
    coverPreview: { alignSelf: 'center', width: 120, height: 160, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
    coverButton: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
    coverButtonText: { fontSize: 14, fontWeight: '800' },
    optionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    option: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
    optionText: { fontSize: 13, fontWeight: '800' },
    helperText: { fontSize: 12, lineHeight: 18, marginTop: 8 },
    noticeCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
    noticeTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
    noticeBody: { fontSize: 14, lineHeight: 20 },
    feedback: { borderWidth: 1, borderRadius: 12, padding: 12 },
    feedbackText: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
    submitButton: { borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
    submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
