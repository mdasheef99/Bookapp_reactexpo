import { useState } from 'react';
import { Image } from 'expo-image';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import {
    ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { publicationService, type PublicMediaRole } from '@/features/imageInventory/api/publicationService';
import { createCaptureAttempt } from '@/features/imageInventory/capture/captureIds';
import { validateSelectedMedia } from '@/features/imageInventory/capture/captureState';
import type { ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { useTheme } from '@/hooks/useTheme';
import { StoreViewMediaClientError } from '../api/storeViewMediaService';
import type {
    StoreViewMediaRecord,
    StoreViewPendingReplacement,
} from '../contracts/storeViewMediaContracts';
import { useStoreViewMediaCommands } from '../queries/storeViewMediaCommands';
import { useStoreViewMedia } from '../queries/storeViewMediaQueries';
import { MEDIA_ROLE_LABELS } from './storeViewPresentation';

const addRoles: ReadonlyArray<PublicMediaRole> = ['actual_copy', 'damage', 'primary_fallback'];

type MediaOperation = Readonly<{
    operationKind: 'add';
    targetLinkId: null;
}> | Readonly<{
    operationKind: 'replace';
    targetLinkId: string;
}>;

type PendingUpload = Readonly<{
    capabilityId: string;
    sourceMediaAssetId: string;
    role: PublicMediaRole;
    publicOrder: number;
}> & MediaOperation;

export function StoreViewManagePhotosModal({ identity, inventoryId, inventoryVersion, visible, onDismiss }: {
    identity: ImageInventoryIdentity;
    inventoryId: string;
    inventoryVersion: number;
    visible: boolean;
    onDismiss: () => void;
}) {
    const { colors } = useTheme();
    const media = useStoreViewMedia(visible ? identity : null, visible ? inventoryId : null);
    const commands = useStoreViewMediaCommands(identity);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
    const [addRole, setAddRole] = useState<PublicMediaRole>('actual_copy');
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

    const records: StoreViewMediaRecord[] = media.data?.media ?? [];
    const pendingReplacements: StoreViewPendingReplacement[] =
        media.data?.pendingReplacements ?? [];

    const refetchMedia = async () => {
        await media.refetch();
    };

    const runLocked = async (work: () => Promise<void>) => {
        if (busy) return;
        setBusy(true);
        setMessage(null);
        try { await work(); } finally { setBusy(false); }
    };

    const refreshAfterCommand = async (conflictRefetch: boolean) => {
        await refetchMedia();
        if (conflictRefetch) setMessage('This book changed. The latest photos were refreshed.');
    };

    const reorder = (linkId: string, direction: -1 | 1) => void runLocked(async () => {
        const ordered = records.map((record) => record.linkId);
        const index = ordered.indexOf(linkId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= ordered.length) return;
        [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
        try {
            await commands.mutateAsync({
                kind: 'reorder', inventoryId,
                inventoryVersion, orderedLinkIds: ordered,
            });
            setMessage('Photo order updated.');
            await refetchMedia();
        } catch (failure) {
            const conflict = failure instanceof StoreViewMediaClientError
                && failure.code === 'P9_VERSION_CONFLICT';
            await refreshAfterCommand(conflict);
            if (!conflict) setMessage(failure instanceof Error ? failure.message : 'The order was not changed.');
        }
    });

    const remove = (linkId: string) => void runLocked(async () => {
        setConfirmRemove(null);
        try {
            await commands.mutateAsync({
                kind: 'remove', inventoryId, inventoryVersion, linkId,
            });
            setMessage('Photo removed.');
            await refetchMedia();
        } catch (failure) {
            const conflict = failure instanceof StoreViewMediaClientError
                && failure.code === 'P9_VERSION_CONFLICT';
            await refreshAfterCommand(conflict);
            if (!conflict) setMessage(failure instanceof Error ? failure.message : 'The photo was not removed.');
        }
    });

    const installReplacement = async (capabilityId: string, mediaAssetId: string, targetLinkId: string) => {
        try {
            await commands.mutateAsync({
                kind: 'replace', inventoryId, inventoryVersion,
                capabilityId, mediaAssetId, targetLinkId,
            });
            setMessage('Replacement photo installed.');
            await refetchMedia();
        } catch (failure) {
            const conflict = failure instanceof StoreViewMediaClientError
                && failure.code === 'P9_VERSION_CONFLICT';
            await refreshAfterCommand(conflict);
            if (!conflict) setMessage(failure instanceof Error ? failure.message : 'The photo was not replaced.');
        }
    };

    const linkApprovedPublicCopy = async (pending: Readonly<{
        capabilityId: string;
        mediaAssetId: string;
        role: PublicMediaRole;
        publicOrder: number;
    }> & MediaOperation) => {
        if (pending.operationKind === 'replace') {
            await installReplacement(pending.capabilityId, pending.mediaAssetId, pending.targetLinkId);
            return;
        }
        const link = createCaptureAttempt('public-copy-link');
        await publicationService.submitPublicCopyMedia({
            inventoryId, capabilityId: pending.capabilityId,
            mediaAssetId: pending.mediaAssetId, role: pending.role,
            publicOrder: pending.publicOrder,
            idempotencyKey: link.key, commandId: link.commandId,
        });
        setMessage('Approved sanitized public-copy photo linked.');
        await refetchMedia();
    };

    const pickAndUpload = async (role: PublicMediaRole, order: number, operation: MediaOperation) => {
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
                inventoryId, role, ordinal: order, media: selected.media, envelopeSha256,
                idempotencyKey: authorize.key, commandId: authorize.commandId,
                operationKind: operation.operationKind,
                ...(operation.targetLinkId ? { targetLinkId: operation.targetLinkId } : {}),
            });
            await prepared.upload(() => undefined).promise;
            const complete = createCaptureAttempt('public-copy-complete');
            const registered = await prepared.complete(complete.key, complete.commandId);
            const status = registered.state === 'approved'
                ? registered
                : await publicationService.readPublicCopyStatus(registered.mediaAssetId);
            if (status.state === 'processing') {
                setPendingUpload({
                    capabilityId: prepared.capabilityId,
                    sourceMediaAssetId: registered.mediaAssetId,
                    role, publicOrder: order, ...operation,
                });
                setMessage('Photo uploaded. Safety processing is running; check again shortly.');
                await refetchMedia();
                return;
            }
            if (status.state === 'failed') {
                setMessage('The photo failed safety validation. Choose another image.');
                return;
            }
            await linkApprovedPublicCopy({
                capabilityId: prepared.capabilityId, mediaAssetId: status.mediaAssetId,
                role, publicOrder: order, ...operation,
            });
        } catch (failure) {
            setMessage(failure instanceof Error ? failure.message : 'The photo could not be uploaded.');
        }
    };

    const checkPendingStatus = () => void runLocked(async () => {
        if (!pendingUpload) return;
        const status = await publicationService.readPublicCopyStatus(pendingUpload.sourceMediaAssetId);
        if (status.state === 'failed') {
            setPendingUpload(null);
            setMessage('The photo failed safety validation. Choose another image.');
        } else if (status.state === 'approved') {
            setPendingUpload(null);
            if (pendingUpload.operationKind === 'replace') {
                await linkApprovedPublicCopy({
                    capabilityId: pendingUpload.capabilityId, mediaAssetId: status.mediaAssetId,
                    role: pendingUpload.role, publicOrder: pendingUpload.publicOrder,
                    operationKind: 'replace', targetLinkId: pendingUpload.targetLinkId,
                });
            } else {
                await linkApprovedPublicCopy({
                    capabilityId: pendingUpload.capabilityId, mediaAssetId: status.mediaAssetId,
                    role: pendingUpload.role, publicOrder: pendingUpload.publicOrder,
                    operationKind: 'add', targetLinkId: null,
                });
            }
        } else {
            setMessage('Safety processing is still running. Check again shortly.');
        }
    });

    const freeOrder = (): number => {
        const used = new Set(records.map((record) => record.publicOrder));
        for (let value = 1; value <= 3; value += 1) {
            if (!used.has(value)) return value;
        }
        return 0;
    };

    const addOrder = freeOrder();
    const disabled = busy || commands.isPending;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
            <View style={[styles.sheet, { backgroundColor: colors.bgPrimary }]}>
                <ScrollView contentContainerStyle={styles.content}>
                    <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
                        Manage Photos
                    </Text>
                    <Text style={[styles.body, { color: colors.textSecondary }]}>
                        Photos are safety-validated, re-encoded, and metadata-stripped before they can appear publicly.
                        While a replacement is processing, the current photo stays public.
                    </Text>

                    {media.isPending ? <ActivityIndicator color={colors.accent} /> : null}
                    {media.isError ? (
                        <Text style={[styles.body, { color: colors.textSecondary }]}>
                            The current photos could not be loaded.
                        </Text>
                    ) : null}

                    {records.map((record, index) => (
                        <View key={record.linkId} style={[styles.row, { borderColor: colors.border }]}>
                            <Image
                                source={{ uri: record.url }}
                                accessibilityLabel={`${MEDIA_ROLE_LABELS[record.role]} photo ${record.publicOrder}`}
                                contentFit="cover"
                                style={styles.thumb}
                            />
                            <View style={styles.rowBody}>
                                <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>
                                    {MEDIA_ROLE_LABELS[record.role]}
                                </Text>
                                <Text style={{ color: colors.textSecondary }}>
                                    Position {record.publicOrder} · {record.width}×{record.height}
                                </Text>
                                {record.role === 'primary_fallback' ? (
                                    <Text style={{ color: colors.accent, fontWeight: '700' }}>Cover photo</Text>
                                ) : null}
                                <View style={styles.rowActions}>
                                    <Pressable
                                        testID={`store-view-media-up-${index}`}
                                        disabled={disabled || index === 0}
                                        onPress={() => reorder(record.linkId, -1)}
                                        style={[styles.smallAction, { borderColor: colors.border }]}
                                    >
                                        <Text style={{ color: colors.textPrimary }}>Move up</Text>
                                    </Pressable>
                                    <Pressable
                                        testID={`store-view-media-down-${index}`}
                                        disabled={disabled || index === records.length - 1}
                                        onPress={() => reorder(record.linkId, 1)}
                                        style={[styles.smallAction, { borderColor: colors.border }]}
                                    >
                                        <Text style={{ color: colors.textPrimary }}>Move down</Text>
                                    </Pressable>
                                    <Pressable
                                        testID={`store-view-media-replace-${index}`}
                                        disabled={disabled}
                                        onPress={() => void runLocked(() => pickAndUpload(
                                            record.role, record.publicOrder,
                                            { operationKind: 'replace', targetLinkId: record.linkId },
                                        )).then(() => undefined)}
                                        style={[styles.smallAction, { borderColor: colors.border }]}
                                    >
                                        <Text style={{ color: colors.textPrimary }}>Replace…</Text>
                                    </Pressable>
                                    <Pressable
                                        testID={`store-view-media-remove-${index}`}
                                        disabled={disabled}
                                        onPress={() => setConfirmRemove(record.linkId)}
                                        style={[styles.smallAction, { borderColor: colors.border }]}
                                    >
                                        <Text style={{ color: colors.textSecondary }}>Remove</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    ))}
                    {records.length === 0 && !media.isPending ? (
                        <Text style={[styles.body, { color: colors.textSecondary }]}>
                            No approved public photos yet. Add the first photo below.
                        </Text>
                    ) : null}

                    {pendingReplacements.map((pending) => (
                        <View key={pending.capabilityId} style={[styles.row, { borderColor: colors.border }]}>
                            <View style={styles.rowBody}>
                                <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>
                                    {pending.operationKind === 'replace' ? 'Replacement for' : 'Add photo'}{' '}
                                    {MEDIA_ROLE_LABELS[pending.role]} · Position {pending.order}
                                </Text>
                                <Text style={{ color: colors.textSecondary }}>
                                    {pending.state === 'processing' ? 'Safety processing…'
                                                : pending.state === 'failed' ? `Failed safety validation${pending.safeErrorCode ? ` (${pending.safeErrorCode})` : ''}.`
                                                    : pending.state === 'upload_pending' ? 'Upload authorized; photo not yet received.'
                                                        : pending.operationKind === 'replace'
                                                            ? 'Approved and ready to install.'
                                                            : 'Approved and ready to add.'}
                                </Text>
                                {pending.state === 'approved' && pending.mediaAssetId ? (
                                    <Pressable
                                        testID={`store-view-media-install-${pending.capabilityId}`}
                                        disabled={disabled}
                                        onPress={() => {
                                            const mediaAssetId = pending.mediaAssetId;
                                            if (!mediaAssetId) return;
                                            void runLocked(() => {
                                                if (pending.operationKind === 'replace') {
                                                    if (!pending.targetLinkId) {
                                                        setMessage('The original photo is no longer available. Choose another image.');
                                                        return Promise.resolve();
                                                    }
                                                    return linkApprovedPublicCopy({
                                                        capabilityId: pending.capabilityId, mediaAssetId,
                                                        role: pending.role, publicOrder: pending.order,
                                                        operationKind: 'replace', targetLinkId: pending.targetLinkId,
                                                    });
                                                }
                                                return linkApprovedPublicCopy({
                                                    capabilityId: pending.capabilityId, mediaAssetId,
                                                    role: pending.role, publicOrder: pending.order,
                                                    operationKind: 'add', targetLinkId: null,
                                                });
                                            }).then(() => undefined);
                                        }}
                                        style={[styles.action, { backgroundColor: colors.accent }]}
                                    >
                                        <Text style={styles.actionText}>
                                            {pending.operationKind === 'replace' ? 'Install approved replacement' : 'Add approved photo'}
                                        </Text>
                                    </Pressable>
                                ) : null}
                            </View>
                        </View>
                    ))}

                    {pendingUpload ? (
                        <Pressable
                            testID="store-view-media-check-status"
                            disabled={disabled}
                            onPress={checkPendingStatus}
                            style={[styles.action, { backgroundColor: colors.accent }]}
                        >
                            <Text style={styles.actionText}>Check processing status</Text>
                        </Pressable>
                    ) : null}

                    <View style={[styles.roles, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }]}>
                        <Text style={[styles.body, { color: colors.textSecondary }]}>Add photo role:</Text>
                        {addRoles.map((role) => (
                            <Pressable
                                key={role}
                                testID={`store-view-media-add-role-${role}`}
                                disabled={disabled}
                                onPress={() => setAddRole(role)}
                                style={[styles.role, { borderColor: addRole === role ? colors.accent : colors.border }]}
                            >
                                <Text style={{ color: colors.textPrimary }}>{MEDIA_ROLE_LABELS[role]}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <Pressable
                        testID="store-view-media-add-photo"
                        disabled={disabled || addOrder === 0}
                        onPress={() => void runLocked(() => pickAndUpload(
                            addRole, addOrder, { operationKind: 'add', targetLinkId: null },
                        )).then(() => undefined)}
                        style={[styles.action, { backgroundColor: colors.accent, opacity: addOrder === 0 ? 0.5 : 1 }]}
                    >
                        {busy ? <ActivityIndicator color="#FFFFFF" /> : null}
                        <Text style={styles.actionText}>
                            {busy ? 'Uploading…' : addOrder === 0 ? 'All photo positions are full' : 'Add approved photo'}
                        </Text>
                    </Pressable>

                    {message ? (
                        <Text testID="store-view-media-message" style={[styles.body, { color: colors.textSecondary }]}>
                            {message}
                        </Text>
                    ) : null}
                    {confirmRemove ? (
                        <View style={[styles.confirm, { borderColor: colors.border }]}>
                            <Text style={[styles.body, { color: colors.textPrimary }]}>
                                Remove this photo? Required damage evidence cannot be removed from a live listing.
                            </Text>
                            <Pressable
                                testID="store-view-media-confirm-remove"
                                disabled={disabled}
                                onPress={() => remove(confirmRemove)}
                                style={[styles.action, { backgroundColor: colors.accent }]}
                            >
                                <Text style={styles.actionText}>Confirm removal</Text>
                            </Pressable>
                            <Pressable
                                testID="store-view-media-cancel-remove"
                                disabled={disabled}
                                onPress={() => setConfirmRemove(null)}
                                style={[styles.done, { borderColor: colors.border }]}
                            >
                                <Text style={{ color: colors.textPrimary }}>Cancel</Text>
                            </Pressable>
                        </View>
                    ) : null}
                    <Pressable
                        testID="close-store-view-manage-photos"
                        disabled={disabled}
                        onPress={onDismiss}
                        style={[styles.done, { borderColor: colors.border }]}
                    >
                        <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Done</Text>
                    </Pressable>
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    sheet: { flex: 1 },
    content: { padding: 20, paddingBottom: 40, gap: 14 },
    title: { fontSize: 22, fontWeight: '800' },
    body: { fontSize: 14, lineHeight: 20 },
    row: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12 },
    thumb: { width: 84, height: 84, borderRadius: 10 },
    rowBody: { flex: 1, gap: 4 },
    rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    smallAction: { minHeight: 34, borderWidth: 1, borderRadius: 17, paddingHorizontal: 10, justifyContent: 'center' },
    roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    role: { minHeight: 38, borderWidth: 1, borderRadius: 19, paddingHorizontal: 12, justifyContent: 'center' },
    action: { minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    actionText: { color: '#FFFFFF', fontWeight: '800' },
    done: { minHeight: 40, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    confirm: { gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
});
