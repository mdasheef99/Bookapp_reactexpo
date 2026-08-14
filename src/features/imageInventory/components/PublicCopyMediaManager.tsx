import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { createCaptureAttempt } from '../capture/captureIds';
import { validateSelectedMedia } from '../capture/captureState';
import {
    publicationService,
    type PublicMediaRole,
} from '../api/publicationService';

const roles: ReadonlyArray<{ role: PublicMediaRole; label: string }> = [
    { role: 'actual_copy', label: 'Actual copy' },
    { role: 'damage', label: 'Damage evidence' },
    { role: 'primary_fallback', label: 'Primary fallback' },
];

export function PublicCopyMediaManager({ inventoryId, onDone }: {
    inventoryId: string;
    onDone: () => void;
}) {
    const { colors } = useTheme();
    const [role, setRole] = useState<PublicMediaRole>('actual_copy');
    const [ordinal, setOrdinal] = useState(1);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [pending, setPending] = useState<{
        capabilityId: string;
        sourceMediaAssetId: string;
        role: PublicMediaRole;
        publicOrder: number;
    } | null>(null);

    const linkApproved = async (mediaAssetId: string, upload: NonNullable<typeof pending>) => {
        const link = createCaptureAttempt('public-copy-link');
        await publicationService.submitPublicCopyMedia({
            inventoryId, capabilityId: upload.capabilityId,
            mediaAssetId, role: upload.role, publicOrder: upload.publicOrder,
            idempotencyKey: link.key, commandId: link.commandId,
        });
        setPending(null);
        setMessage('Approved sanitized public-copy photo linked.');
    };

    const checkStatus = async () => {
        if (!pending) return;
        setBusy(true);
        setMessage(null);
        try {
            const status = await publicationService.readPublicCopyStatus(pending.sourceMediaAssetId);
            if (status.state === 'approved') await linkApproved(status.mediaAssetId, pending);
            else if (status.state === 'failed') {
                setPending(null);
                setMessage('The photo failed safety validation. Choose another image.');
            } else setMessage('Sanitization is still processing. Check again shortly.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Photo status could not be checked.');
        } finally {
            setBusy(false);
        }
    };

    const upload = async () => {
        setBusy(true);
        setMessage(null);
        try {
            let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
            if (!permission.granted && permission.canAskAgain) {
                permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            }
            if (!permission.granted) throw new Error('Media-library permission is required.');
            const picked = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'], allowsEditing: false, quality: 1,
                exif: false, base64: false, allowsMultipleSelection: false,
            });
            if (picked.canceled) return;
            const selected = validateSelectedMedia(picked.assets[0], 'gallery');
            if (!selected.ok) throw new Error(selected.message);
            const envelopeSha256 = await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                `${selected.media.mimeType}|${selected.media.fileSize}|${role}`,
            );
            const authorize = createCaptureAttempt('public-copy-authorize');
            const prepared = await publicationService.preparePublicCopyUpload({
                inventoryId, role, ordinal, media: selected.media, envelopeSha256,
                idempotencyKey: authorize.key, commandId: authorize.commandId,
            });
            await prepared.upload(() => undefined).promise;
            const complete = createCaptureAttempt('public-copy-complete');
            const registered = await prepared.complete(complete.key, complete.commandId);
            const approved = registered.state === 'approved'
                ? registered
                : await publicationService.readPublicCopyStatus(registered.mediaAssetId);
            if (approved.state !== 'approved') {
                setPending(approved.state === 'processing' ? {
                    capabilityId: prepared.capabilityId,
                    sourceMediaAssetId: registered.mediaAssetId,
                    role, publicOrder: ordinal,
                } : null);
                setMessage(approved.state === 'failed'
                    ? 'The photo failed safety validation. Choose another image.'
                    : 'Photo uploaded. Sanitization is processing; use Check processing status shortly.');
                return;
            }
            await linkApproved(approved.mediaAssetId, {
                capabilityId: prepared.capabilityId,
                sourceMediaAssetId: registered.mediaAssetId,
                role,
                publicOrder: ordinal,
            });
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'The public-copy photo could not be uploaded.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={[styles.panel, { borderColor: colors.border }]}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Public-copy photos</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
                Photos are validated, re-encoded, and stripped of metadata before they can be public.
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
                Damage evidence must use the damage role. Damage photos never become the cover automatically.
            </Text>
            <View style={styles.roles}>
                {roles.map((option) => (
                    <Pressable
                        key={option.role}
                        testID={`public-media-role-${option.role}`}
                        onPress={() => {
                            setRole(option.role);
                            if (option.role === 'primary_fallback') setOrdinal(1);
                        }}
                        style={[styles.role, { borderColor: role === option.role ? colors.accent : colors.border }]}
                    >
                        <Text style={{ color: colors.textPrimary }}>{option.label}</Text>
                    </Pressable>
                ))}
            </View>
            {role !== 'primary_fallback' ? (
                <View style={styles.roles}>
                    {[1, 2, 3].map((value) => (
                        <Pressable
                            key={value}
                            testID={`public-media-order-${value}`}
                            onPress={() => setOrdinal(value)}
                            style={[styles.role, { borderColor: ordinal === value ? colors.accent : colors.border }]}
                        >
                            <Text style={{ color: colors.textPrimary }}>Position {value}</Text>
                        </Pressable>
                    ))}
                </View>
            ) : null}
            {message ? <Text testID="public-media-message" style={[styles.body, { color: colors.textSecondary }]}>{message}</Text> : null}
            <Pressable
                testID="choose-public-copy-photo"
                disabled={busy}
                onPress={() => void upload()}
                style={[styles.action, { backgroundColor: colors.accent }]}
            >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : null}
                <Text style={styles.actionText}>{busy ? 'Uploading…' : 'Choose and upload photo'}</Text>
            </Pressable>
            {pending ? (
                <Pressable
                    testID="check-public-copy-status"
                    disabled={busy}
                    onPress={() => void checkStatus()}
                    style={[styles.done, { borderColor: colors.border }]}
                >
                    <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Check processing status</Text>
                </Pressable>
            ) : null}
            <Pressable testID="close-public-media-manager" disabled={busy} onPress={onDone} style={styles.done}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Done</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    panel: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
    title: { fontSize: 18, fontWeight: '800' },
    body: { fontSize: 14, lineHeight: 20 },
    roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    role: { minHeight: 38, borderWidth: 1, borderRadius: 19, paddingHorizontal: 12, justifyContent: 'center' },
    action: { minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    actionText: { color: '#FFFFFF', fontWeight: '800' },
    done: { minHeight: 40, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
