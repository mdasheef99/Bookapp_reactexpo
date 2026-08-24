import { useState, useMemo } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import type { MediaType } from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { type ClubPublicDetails, type AccessLevel, type ClubType, type MeetingType } from '@/features/clubs/services/clubsService';
import type { FeedbackState, SettingsDraft } from './manageUtils';
import {
    formatAccessLevel,
    formatClubType,
    formatMeetingType,
    getSettingsValidationMessage,
    isSettingsDirty,
    normalizeMaxMembers,
} from './manageUtils';

interface Props {
    club: ClubPublicDetails;
    settings: SettingsDraft;
    setSettings: React.Dispatch<React.SetStateAction<SettingsDraft | null>>;
    isSaving: boolean;
    onSave: (settings: SettingsDraft) => Promise<void>;
    onReset: () => void;
}

export function ClubManageSettingsSection({ club, settings, setSettings, isSaving, onSave, onReset }: Props) {
    const { colors } = useTheme();
    const [localSettings, setLocalSettings] = useState<SettingsDraft>(settings);
    const [hasTouched, setHasTouched] = useState(false);

    const isDirty = isSettingsDirty(localSettings, club);
    const validationMessage = getSettingsValidationMessage(localSettings, club);

    const handleSave = async () => {
        if (validationMessage) return;
        await onSave(localSettings);
        setHasTouched(false);
    };

    const handleReset = () => {
        setLocalSettings(settings);
        setHasTouched(false);
        onReset();
    };

    const updateField = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => {
        setLocalSettings((prev) => ({ ...prev, [key]: value }));
        setHasTouched(true);
    };

    const [isUploadingCover, setIsUploadingCover] = useState(false);
    const [coverError, setCoverError] = useState<string | null>(null);

    const pickCoverImage = async () => {
        setCoverError(null);
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                setCoverError('Permission denied. Please allow photo access to select a cover image, or enter a URL below.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: (ImagePicker as { MediaType?: { Images: MediaType } }).MediaType?.Images ?? ImagePicker.MediaTypeOptions.Images,
                quality: 0.85,
                allowsEditing: true,
                aspect: [3, 4],
            });

            if (result.canceled || !result.assets || result.assets.length === 0) return;

            const asset = result.assets[0];
            setIsUploadingCover(true);

            const photoUri = asset.uri;
            const response = await fetch(photoUri);
            if (!response.ok) {
                throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
            }
            const blob = await response.blob();

            const contentType = asset.mimeType || blob.type || 'image/jpeg';
            const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
            const path = `${club.id}/cover.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from('club-banners')
                .upload(path, blob, { contentType, upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('club-banners').getPublicUrl(path);
            updateField('coverUrl', data.publicUrl);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);

            if (message.toLowerCase().includes('row-level security') || message.toLowerCase().includes('rls') || message.toLowerCase().includes('new row violates')) {
                setCoverError(
                    'Upload blocked by server security policy. To fix this, add an RLS policy in Supabase Storage → club-banners → Policies: "Allow authenticated users to upload objects to bucket_id = club-banners". You can also enter an image URL below.'
                );
            } else {
                setCoverError(`Upload failed: ${message}. You can still enter a URL manually below.`);
            }
        } finally {
            setIsUploadingCover(false);
        }
    };

    const CLUB_TYPE_OPTIONS: ClubType[] = ['public', 'approval', 'invite_only'];
    const ACCESS_LEVEL_OPTIONS: AccessLevel[] = ['all', 'pro', 'pro_plus'];
    const MEETING_TYPE_OPTIONS: (MeetingType | null)[] = [null, 'online_only', 'venue_based', 'hybrid'];

    return (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Basic settings</Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
            <TextInput
                testID="settings-name-input"
                value={localSettings.name}
                onChangeText={(t) => updateField('name', t)}
                style={[styles.textInput, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholderTextColor={colors.textTertiary}
                placeholder="Club name"
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
            <TextInput
                testID="settings-description-input"
                value={localSettings.description}
                onChangeText={(t) => updateField('description', t)}
                style={[styles.textInput, styles.textArea, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholderTextColor={colors.textTertiary}
                placeholder="Short description..."
                multiline
                numberOfLines={3}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Cover image</Text>
            {localSettings.coverUrl ? (
                <View style={styles.coverPreviewContainer}>
                    <Image
                        source={{ uri: localSettings.coverUrl }}
                        style={[styles.coverPreview, { borderColor: colors.border }]}
                        contentFit="cover"
                        testID="settings-cover-preview"
                    />
                </View>
            ) : null}
            {coverError && (
                <View style={[styles.coverErrorBanner, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
                    <Text style={[styles.coverErrorText, { color: colors.error }]}>{coverError}</Text>
                </View>
            )}
            <TouchableOpacity
                onPress={pickCoverImage}
                disabled={isUploadingCover}
                style={[styles.coverButton, { borderColor: colors.accent, opacity: isUploadingCover ? 0.7 : 1 }]}
                testID="settings-pick-cover"
            >
                {isUploadingCover ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                    <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>
                        {localSettings.coverUrl ? 'Change cover image' : 'Select cover image'}
                    </Text>
                )}
            </TouchableOpacity>
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Or enter image URL</Text>
            <TextInput
                testID="settings-cover-url-input"
                value={localSettings.coverUrl}
                onChangeText={(t) => updateField('coverUrl', t)}
                style={[styles.textInput, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholderTextColor={colors.textTertiary}
                placeholder="https://..."
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Member cap</Text>
            <TextInput
                testID="settings-max-members-input"
                value={localSettings.maxMembers}
                onChangeText={(t) => updateField('maxMembers', t)}
                keyboardType="number-pad"
                style={[styles.textInput, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholderTextColor={colors.textTertiary}
                placeholder="Leave blank for unlimited"
            />

            {club.club_type !== 'author_club' && (
                <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Club type</Text>
                    <View style={styles.rowGroup}>
                        {CLUB_TYPE_OPTIONS.map((opt) => (
                            <TouchableOpacity
                                key={opt}
                                testID={`club-type-option-${opt}`}
                                onPress={() => updateField('clubType', opt)}
                                style={[styles.rowOption, localSettings.clubType === opt && { backgroundColor: colors.accent }]}>
                                <Text style={{ color: localSettings.clubType === opt ? '#FFFFFF' : colors.textPrimary, fontWeight: '700' }}>
                                    {formatClubType(opt)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </>
            )}

            <Text style={[styles.label, { color: colors.textSecondary }]}>Access level</Text>
            <View style={styles.rowGroup}>
                {ACCESS_LEVEL_OPTIONS.map((opt) => (
                    <TouchableOpacity
                        key={opt}
                        testID={`access-level-option-${opt}`}
                        onPress={() => updateField('accessLevel', opt)}
                        style={[styles.rowOption, localSettings.accessLevel === opt && { backgroundColor: colors.accent }]}>
                        <Text style={{ color: localSettings.accessLevel === opt ? '#FFFFFF' : colors.textPrimary, fontWeight: '700' }}>
                            {formatAccessLevel(opt)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Meeting type</Text>
            <View style={styles.rowGroup}>
                {MEETING_TYPE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                        key={opt ?? 'none'}
                        testID={`meeting-type-option-${opt ?? 'none'}`}
                        onPress={() => updateField('meetingType', opt)}
                        style={[styles.rowOption, localSettings.meetingType === opt && { backgroundColor: colors.accent }]}>
                        <Text style={{ color: localSettings.meetingType === opt ? '#FFFFFF' : colors.textPrimary, fontWeight: '700' }}>
                            {formatMeetingType(opt)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {!!validationMessage && hasTouched && (
                <Text style={[styles.validation, { color: colors.error }]}>{validationMessage}</Text>
            )}

            <View style={styles.buttonRow}>
                <TouchableOpacity
                    testID="save-settings-button"
                    onPress={handleSave}
                    disabled={!isDirty || !!validationMessage || isSaving}
                    style={[styles.saveButton, { backgroundColor: colors.accent, opacity: !isDirty || !!validationMessage || isSaving ? 0.5 : 1 }]}>
                    <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save settings'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    testID="reset-settings-button"
                    onPress={handleReset}
                    disabled={!isDirty || isSaving}
                    style={{ opacity: !isDirty || isSaving ? 0.5 : 1 }}>
                    <Text style={[styles.resetText, { color: colors.textSecondary }]}>Reset</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: 10,
        marginBottom: 4,
    },
    textInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
    },
    textArea: {
        minHeight: 72,
        textAlignVertical: 'top',
    },
    rowGroup: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 4,
    },
    rowOption: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    validation: {
        fontSize: 13,
        marginTop: 6,
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginTop: 10,
    },
    saveButton: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    resetText: {
        fontSize: 13,
        fontWeight: '600',
    },
    coverPreviewContainer: {
        alignItems: 'center',
        marginBottom: 8,
    },
    coverPreview: {
        width: 120,
        height: 160,
        borderRadius: 8,
        borderWidth: 1,
    },
    coverButton: {
        borderWidth: 1.5,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    coverErrorBanner: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
    },
    coverErrorText: {
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    },
});
