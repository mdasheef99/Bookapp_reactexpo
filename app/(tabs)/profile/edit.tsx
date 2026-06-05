import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { profileService } from '@/features/auth/services/profileService';
import { useTheme } from '@/hooks/useTheme';

export default function EditProfileScreen() {
    const { session } = useAuth();
    const { colors } = useTheme();
    const queryClient = useQueryClient();
    const userId = session?.user?.id ?? null;
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [city, setCity] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const { data: profile, isLoading } = useQuery({
        queryKey: ['profile', userId],
        queryFn: () => profileService.getProfile(userId!),
        enabled: !!userId,
        staleTime: 60_000,
    });

    useEffect(() => {
        if (!profile) return;
        setDisplayName(profile.display_name ?? '');
        setUsername(profile.username ?? '');
        setCity(profile.city ?? '');
        setAvatarUrl(profile.avatar_url ?? null);
    }, [profile]);

    const saveProfile = async () => {
        if (!userId) return;
        if (!displayName.trim() || !city.trim()) {
            Alert.alert('Profile incomplete', 'Display name and city are required.');
            return;
        }

        setIsSaving(true);
        try {
            const updatedProfile = await profileService.updateProfile(userId, {
                display_name: displayName,
                username,
                city,
            });
            if (updatedProfile) {
                queryClient.setQueryData(['profile', userId], (current: typeof updatedProfile | undefined) => ({
                    ...current,
                    ...updatedProfile,
                }));
            }
            router.replace('/(tabs)/profile');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not update your profile.';
            Alert.alert('Update failed', message);
        } finally {
            setIsSaving(false);
        }
    };

    const pickAvatar = async () => {
        if (!userId) return;
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Photo access needed', 'Please allow photo access to change your profile picture.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                mediaTypes: (ImagePicker as any).MediaType?.Images ?? ImagePicker.MediaTypeOptions.Images,
                quality: 0.85,
                allowsEditing: true,
                aspect: [1, 1],
            });

            if (result.canceled || !result.assets?.[0]) return;

            setIsUploadingAvatar(true);
            const publicUrl = await profileService.uploadAvatar(userId, result.assets[0].uri);
            setAvatarUrl(publicUrl);
            queryClient.setQueryData(['profile', userId], (current: typeof profile | undefined) => current
                ? { ...current, avatar_url: publicUrl, updated_at: new Date().toISOString() }
                : current);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not update your profile photo.';
            Alert.alert('Upload failed', message);
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    return (
        <ScreenBackground>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => router.replace('/(tabs)/profile')}
                        style={styles.backButton}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Edit Profile</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <GlassCard padding={22} borderRadius={22}>
                    <View style={styles.avatarSection}>
                        {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
                        ) : (
                            <View style={[styles.avatarFallback, { backgroundColor: colors.accent }]}>
                                <Ionicons name="person" size={34} color="#FFFFFF" />
                            </View>
                        )}
                        <Button
                            title={isUploadingAvatar ? 'Uploading...' : 'Change Photo'}
                            onPress={pickAvatar}
                            variant="secondary"
                            size="sm"
                            loading={isUploadingAvatar}
                            style={styles.changePhotoButton}
                        />
                    </View>

                    <View style={styles.form}>
                        <Input
                            label="Display Name *"
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder={isLoading ? 'Loading...' : 'Your display name'}
                            testID="edit-profile-display-name"
                            accessibilityLabel="Display name"
                        />
                        <Input
                            label="Username"
                            value={username}
                            onChangeText={setUsername}
                            placeholder="reader_name"
                            maxLength={30}
                            testID="edit-profile-username"
                            accessibilityLabel="Username"
                        />
                        <Input
                            label="City *"
                            value={city}
                            onChangeText={setCity}
                            placeholder="Your city"
                            testID="edit-profile-city"
                            accessibilityLabel="City"
                        />
                    </View>

                    <Button title="Save Changes" onPress={saveProfile} loading={isSaving} disabled={isSaving || isUploadingAvatar} size="lg" />
                </GlassCard>
            </ScrollView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 56,
        paddingBottom: 40,
        gap: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    headerSpacer: {
        width: 40,
    },
    avatarSection: {
        alignItems: 'center',
        gap: 12,
        marginBottom: 22,
    },
    avatarImage: {
        width: 96,
        height: 96,
        borderRadius: 48,
    },
    avatarFallback: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    changePhotoButton: {
        maxWidth: 180,
    },
    form: {
        gap: 16,
        marginBottom: 24,
    },
});
