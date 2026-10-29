import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import {
    ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { PublicationClientError, publicationService, type PublicMediaRole } from '@/features/imageInventory/api/publicationService';
import { createCaptureAttempt } from '@/features/imageInventory/capture/captureIds';
import { validateSelectedMedia } from '@/features/imageInventory/capture/captureState';
import type { ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { useTheme } from '@/hooks/useTheme';
import { StoreViewMediaClientError } from '../api/storeViewMediaService';
import type {
    StoreViewMediaRecord,
    StoreViewPendingReplacement,
} from '../contracts/storeViewMediaContracts';
import type { StoreViewDetail } from '../contracts/storeViewContracts';
import { useStoreViewMediaCommands } from '../queries/storeViewMediaCommands';
import { storeViewMediaKeys, useStoreViewMedia } from '../queries/storeViewMediaQueries';
import { invalidateStoreViewAfterMedia } from '../queries/storeViewInvalidation';
import { editIdentityChanged, isEditAccessLost } from '../state/storeViewEditRebase';
import {
    PhotoConfirmError,
    confirmPhotoBook,
} from '../state/storeViewPhotoConfirmation';
import type { EditRefreshResult } from '../state/storeViewEditRebase';
import { MEDIA_ROLE_LABELS } from './storeViewPresentation';

const addRoles: ReadonlyArray<PublicMediaRole> = ['actual_copy', 'damage', 'primary_fallback'];

/** R15: post-command media refetches share the 15s confirm timeout. */
export const MEDIA_REFETCH_TIMEOUT_MS = 15_000;

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

export function StoreViewManagePhotosModal({ identity, inventoryId, visible, onDismiss, onConfirmBook, onAccessLost }: {
    identity: ImageInventoryIdentity;
    inventoryId: string;
    visible: boolean;
    onDismiss: () => void;
    onConfirmBook: (
        onLate: (detail: StoreViewDetail) => void,
        onLateFailure?: (failure: { ok: false; offline: boolean; code?: string | null; httpStatus?: number | null }) => void,
    ) => Promise<EditRefreshResult>;
    onAccessLost: () => void;
}) {
    const { colors } = useTheme();
    // The modal is rendered inside the detail screen even when closed,
    // including in provider-less unit tests; the add-path refresh below
    // simply skips when no QueryClient is available (the app always provides
    // one).
    let client: ReturnType<typeof useQueryClient> | null = null;
    try {
        client = useQueryClient();
    } catch {
        client = null;
    }
    // R3: the media query stays disabled until the detail version is
    // confirmed, so the list shown and used for actions always comes from
    // a media read that starts after the detail read resolves.
    const [mediaArmed, setMediaArmed] = useState(false);
    const media = useStoreViewMedia(
        visible ? identity : null,
        visible ? inventoryId : null,
        mediaArmed,
    );
    const commands = useStoreViewMediaCommands(identity);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
    const [addRole, setAddRole] = useState<PublicMediaRole>('actual_copy');
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
    // Confirmed state (§3.3): a version plus a photo list read after it. The
    // photo buttons are enabled only while it is set.
    const [confirmState, setConfirmState] = useState<'confirming' | 'ready' | 'failed'>('confirming');
    const [confirmedVersion, setConfirmedVersion] = useState<number | null>(null);
    const [confirmOffline, setConfirmOffline] = useState(false);
    // Identity snapshot (C4): a user/store change while open is access lost.
    const [baselineIdentity, setBaselineIdentity] = useState<ImageInventoryIdentity | null>(null);
    const openRef = useRef(false);
    // Opening generation (C5): confirm and late results from a previous
    // opening are ignored.
    const openingRef = useRef(0);
    // R10: per-attempt id within each opening. A late result from an
    // earlier timed-out confirm must not overwrite a newer Retry.
    const attemptRef = useRef(0);
    // R11: mount tracking. After unmount, no post-await path calls
    // onAccessLost or sets state.
    const mountedRef = useRef(true);
    useEffect(() => () => { mountedRef.current = false; }, []);
    // Ref lock so two presses in the same tick can't both run (C7).
    const actionLock = useRef(false);
    const stateRef = useRef(confirmState);
    stateRef.current = confirmState;

    const isCurrentOpening = (generation: number) => generation === openingRef.current
        && openRef.current && mountedRef.current;

    const records: StoreViewMediaRecord[] = mediaArmed ? (media.data?.media ?? []) : [];
    const pendingReplacements: StoreViewPendingReplacement[] =
        mediaArmed ? (media.data?.pendingReplacements ?? []) : [];

    const failAccessLost = () => {
        // R11: never call onAccessLost after unmount.
        if (!mountedRef.current) return;
        onAccessLost();
    };

    const accessLost = (failure: unknown): boolean => {
        // Recognises StoreViewMediaClientError and PublicationClientError by
        // code (C3); either may also carry an HTTP status.
        if (failure instanceof StoreViewMediaClientError || failure instanceof PublicationClientError) {
            const httpStatus = failure.httpStatus ?? null;
            return isEditAccessLost({ code: failure.code ?? null, httpStatus });
        }
        if (failure instanceof PhotoConfirmError) {
            return isEditAccessLost({ code: failure.code, httpStatus: failure.httpStatus });
        }
        if (failure && typeof failure === 'object' && 'code' in failure) {
            const code = (failure as { code?: unknown }).code;
            const rawStatus = (failure as { httpStatus?: unknown }).httpStatus;
            return isEditAccessLost({
                code: typeof code === 'string' ? code : null,
                httpStatus: typeof rawStatus === 'number' ? rawStatus : null,
            });
        }
        return false;
    };

    /**
     * R15: post-command media refetches are bounded by the same 15s
     * timeout. A stall falls back to the failed-confirm state with Retry.
     */
    const refetchMediaBounded = async (): Promise<{ ok: true } | { ok: false; error: unknown }> => {
        const generation = openingRef.current;
        const attemptId = attemptRef.current;
        let timedOut = false;
        let timerId: ReturnType<typeof setTimeout> | undefined;
        const timer = new Promise<{ ok: false; error: unknown }>((resolve) => {
            timerId = setTimeout(
                () => {
                    timedOut = true;
                    resolve({ ok: false, error: new Error('photo refresh timed out') });
                },
                MEDIA_REFETCH_TIMEOUT_MS,
            );
        });
        const attempt = (async (): Promise<{ ok: true } | { ok: false; error: unknown }> => {
            try {
                // cancelRefetch alone reuses an in-flight request on a cold cache.
                await client?.cancelQueries({ queryKey: storeViewMediaKeys.detail(identity, inventoryId), exact: true });
                if (!isCurrentOpening(generation) || attemptId !== attemptRef.current) {
                    return { ok: false, error: new Error('stale photo refresh') };
                }
                const result = await media.refetch();
                if (!result || result.error || !result.data) {
                    return { ok: false, error: result?.error ?? new Error('photo refresh failed') };
                }
                return { ok: true };
            } catch (error) {
                return { ok: false, error };
            }
        })();
        void attempt.then((result) => {
            if (timedOut && isCurrentOpening(generation) && attemptId === attemptRef.current
                && !result.ok && accessLost(result.error)) failAccessLost();
        });
        try {
            return await Promise.race([attempt, timer]);
        } finally {
            if (timerId !== undefined) clearTimeout(timerId);
        }
    };

    const adoptLateVersionFor = (generation: number, attempt: number, version: number) => {
        // R10: late results must match the current attempt within the
        // opening, not just the opening.
        if (generation !== openingRef.current || attempt !== attemptRef.current
            || !openRef.current || stateRef.current === 'ready') return;
        if (!mountedRef.current) return;
        // R3: the detail version resolved (late); only now may the media
        // list be read and used.
        setMediaArmed(true);
        setConfirmedVersion(version);
        void (async () => {
            const refetched = await refetchMediaBounded();
            if (generation !== openingRef.current || attempt !== attemptRef.current
                || !openRef.current || stateRef.current === 'ready') return;
            if (!mountedRef.current) return;
            // R6b: late access loss routes to the access-lost path.
            if (!refetched.ok) {
                if (accessLost(refetched.error)) failAccessLost();
                return;
            }
            setConfirmState('ready');
            setConfirmOffline(false);
        })();
    };

    const applyLateFailureFor = (generation: number, attempt: number, failure: unknown) => {
        // R9: a failure arriving after the timeout routes late access loss
        // to the access-lost path for the current attempt only.
        if (generation !== openingRef.current || attempt !== attemptRef.current || !openRef.current) return;
        if (!mountedRef.current) return;
        if (accessLost(failure)) failAccessLost();
    };

    const stale = (detail: string) => new PhotoConfirmError(false, `stale: ${detail}`);

    const confirm = async (): Promise<boolean> => {
        const generation = openingRef.current;
        const attempt = attemptRef.current + 1;
        attemptRef.current = attempt;
        // R11: every post-await step below re-checks generation, attempt,
        // mount and open state, so nothing after unmount fetches, sets
        // state or calls onAccessLost.
        const current = () => generation === openingRef.current
            && attempt === attemptRef.current
            && openRef.current
            && mountedRef.current;
        setConfirmState('confirming');
        setConfirmedVersion(null);
        setConfirmOffline(false);
        setMessage(null);
        try {
            const version = await confirmPhotoBook({
                isOnline: onlineManager.isOnline(),
                refreshDetail: async () => {
                    const outcome = await onConfirmBook(
                        (detail) => {
                            if (!current()) return;
                            setMediaArmed(true);
                            adoptLateVersionFor(generation, attempt, detail.versions.inventoryVersion);
                        },
                        (failure) => applyLateFailureFor(generation, attempt, failure),
                    );
                    // Keep the error code and HTTP status (C2) so access
                    // loss routes to onAccessLost instead of "try again".
                    if (!outcome.ok) throw new PhotoConfirmError(
                        outcome.offline, 'book refresh failed',
                        outcome.code ?? null, outcome.httpStatus ?? null,
                    );
                    // R3: the detail version resolved; only now may the
                    // media list be read and used. R11: never arm or fetch
                    // for a stale attempt or after unmount.
                    if (!current()) throw stale('detail resolved stale');
                    setMediaArmed(true);
                    return outcome.detail.versions.inventoryVersion;
                },
                refreshMedia: async () => {
                    // R11: never fetch for a stale attempt or after unmount.
                    if (!current()) throw stale('media refresh stale');
                    const refetched = await refetchMediaBounded();
                    if (!refetched.ok) {
                        const failure = refetched.error as { code?: unknown; httpStatus?: unknown } | undefined;
                        const code = typeof failure?.code === 'string' ? failure.code : null;
                        const rawStatus = failure?.httpStatus;
                        throw new PhotoConfirmError(
                            false, 'photo refresh failed', code,
                            typeof rawStatus === 'number' ? rawStatus : null,
                        );
                    }
                },
                // A late completion of a timed-out confirm is accepted (C14).
                onLateVersion: (version) => {
                    if (!current()) return;
                    setMediaArmed(true);
                    adoptLateVersionFor(generation, attempt, version);
                },
                // R9: a late failure is still reported so late access loss
                // routes to onAccessLost for the current attempt.
                onLateFailure: (failure) => applyLateFailureFor(generation, attempt, failure),
            });
            if (generation !== openingRef.current || attempt !== attemptRef.current || !openRef.current) return false;
            if (!mountedRef.current) return false;
            setConfirmedVersion(version);
            setConfirmState('ready');
            return true;
        } catch (failure) {
            if (generation !== openingRef.current || attempt !== attemptRef.current || !openRef.current) return false;
            if (!mountedRef.current) return false;
            if (accessLost(failure)) {
                failAccessLost();
                return false;
            }
            const offline = failure instanceof PhotoConfirmError && failure.offline;
            setConfirmState('failed');
            setConfirmOffline(offline);
            return false;
        }
    };

    useEffect(() => {
        if (visible && !openRef.current) {
            openRef.current = true;
            openingRef.current += 1;
            setBaselineIdentity(identity);
            setPendingUpload(null);
            setConfirmRemove(null);
            setMediaArmed(false);
            actionLock.current = false;
            setBusy(false);
            void confirm();
        }
        if (!visible) {
            openRef.current = false;
            // Invalidate in-flight confirms/late results and reset so the
            // next opening starts from "on open" (C5).
            openingRef.current += 1;
            setConfirmState('confirming');
            setConfirmedVersion(null);
            setConfirmOffline(false);
            setMessage(null);
            setMediaArmed(false);
        }
        // Confirm once per opening; never reuse a stale version or photo list.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    useEffect(() => {
        if (visible && baselineIdentity && editIdentityChanged(baselineIdentity, identity)) {
            failAccessLost();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, identity, baselineIdentity]);

    const runLocked = async (work: (generation: number) => Promise<void>) => {
        if (busy || actionLock.current) return;
        const generation = openingRef.current;
        if (!isCurrentOpening(generation)) return;
        actionLock.current = true;
        setBusy(true);
        setMessage(null);
        try {
            await work(generation);
        } catch (failure) {
            // Catches pending-status/install failures (C6): no unhandled
            // rejections, access loss routes out, otherwise re-confirm and
            // show a message.
            if (!isCurrentOpening(generation)) return;
            if (accessLost(failure)) {
                failAccessLost();
                return;
            }
            const message = failure instanceof Error ? failure.message : 'The photo action could not be completed.';
            await confirm();
            if (!isCurrentOpening(generation)) return;
            setMessage(message);
        } finally {
            if (isCurrentOpening(generation)) {
                actionLock.current = false;
                setBusy(false);
            }
        }
    };

    const refreshAfterCommand = async (generation: number, conflictRefetch: boolean) => {
        if (!isCurrentOpening(generation)) return;
        // R15: bounded like every other post-command refetch. R6b: access
        // loss routes out instead of showing a temporary message.
        const refetched = await refetchMediaBounded();
        if (!isCurrentOpening(generation)) return;
        if (!refetched.ok) {
            if (accessLost(refetched.error)) failAccessLost();
            return;
        }
        if (conflictRefetch) setMessage('This book changed. The latest photos were refreshed.');
    };

    /** R6b/R15: shared post-command settle — access loss routes out, a stall
     * or failure falls back to the failed-confirm state with Retry, and
     * success shows only when the follow-up refetch succeeded (C8). */
    const settleCommandSuccess = async (generation: number, version: number, message: string): Promise<void> => {
        if (!isCurrentOpening(generation)) return;
        setConfirmedVersion(version);
        setConfirmState('confirming');
        const refetched = await refetchMediaBounded();
        if (!isCurrentOpening(generation)) return;
        if (!refetched.ok) {
            if (accessLost(refetched.error)) {
                failAccessLost();
                return;
            }
            // The failed-confirm block shows "Couldn't refresh this book.
            // Try again." with Retry; no extra message needed.
            setConfirmState('failed');
            setConfirmOffline(false);
            return;
        }
        setConfirmState('ready');
        setMessage(message);
    };

    const reorder = (linkId: string, direction: -1 | 1) => void runLocked(async (generation) => {
        if (confirmedVersion === null) return;
        const ordered = records.map((record) => record.linkId);
        const index = ordered.indexOf(linkId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= ordered.length) return;
        [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
        try {
            const result = await commands.mutateAsync({
                kind: 'reorder', inventoryId,
                inventoryVersion: confirmedVersion, orderedLinkIds: ordered,
            });
            if (!isCurrentOpening(generation)) return;
            await settleCommandSuccess(generation, result.inventoryVersion, 'Photo order updated.');
        } catch (failure) {
            if (!isCurrentOpening(generation)) return;
            if (accessLost(failure)) {
                failAccessLost();
                return;
            }
            const conflict = failure instanceof StoreViewMediaClientError
                && failure.code === 'P9_VERSION_CONFLICT';
            setConfirmedVersion(null);
            setConfirmState('confirming');
            await confirm();
            if (!isCurrentOpening(generation)) return;
            if (!conflict) {
                await refreshAfterCommand(generation, false);
                if (!isCurrentOpening(generation)) return;
                setMessage(failure instanceof Error ? failure.message : 'The order was not changed.');
            }
        }
    });

    const remove = (linkId: string) => void runLocked(async (generation) => {
        if (confirmedVersion === null) return;
        setConfirmRemove(null);
        try {
            const result = await commands.mutateAsync({
                kind: 'remove', inventoryId, inventoryVersion: confirmedVersion, linkId,
            });
            if (!isCurrentOpening(generation)) return;
            await settleCommandSuccess(generation, result.inventoryVersion, 'Photo removed.');
        } catch (failure) {
            if (!isCurrentOpening(generation)) return;
            if (accessLost(failure)) {
                failAccessLost();
                return;
            }
            const conflict = failure instanceof StoreViewMediaClientError
                && failure.code === 'P9_VERSION_CONFLICT';
            setConfirmedVersion(null);
            setConfirmState('confirming');
            await confirm();
            if (!isCurrentOpening(generation)) return;
            if (!conflict) {
                await refreshAfterCommand(generation, false);
                if (!isCurrentOpening(generation)) return;
                setMessage(failure instanceof Error ? failure.message : 'The photo was not removed.');
            }
        }
    });

    const installReplacement = async (generation: number, capabilityId: string, mediaAssetId: string, targetLinkId: string) => {
        if (!isCurrentOpening(generation)) return;
        if (confirmedVersion === null) return;
        try {
            const result = await commands.mutateAsync({
                kind: 'replace', inventoryId, inventoryVersion: confirmedVersion,
                capabilityId, mediaAssetId, targetLinkId,
            });
            if (!isCurrentOpening(generation)) return;
            await settleCommandSuccess(generation, result.inventoryVersion, 'Replacement photo installed.');
        } catch (failure) {
            if (!isCurrentOpening(generation)) return;
            if (accessLost(failure)) {
                failAccessLost();
                return;
            }
            const conflict = failure instanceof StoreViewMediaClientError
                && failure.code === 'P9_VERSION_CONFLICT';
            setConfirmedVersion(null);
            setConfirmState('confirming');
            await confirm();
            if (!isCurrentOpening(generation)) return;
            if (!conflict) {
                await refreshAfterCommand(generation, false);
                if (!isCurrentOpening(generation)) return;
                setMessage(failure instanceof Error ? failure.message : 'The photo was not replaced.');
            }
        }
    };

    const linkApprovedPublicCopy = async (generation: number, pending: Readonly<{
        capabilityId: string;
        mediaAssetId: string;
        role: PublicMediaRole;
        publicOrder: number;
    }> & MediaOperation) => {
        if (!isCurrentOpening(generation)) return;
        if (pending.operationKind === 'replace') {
            await installReplacement(generation, pending.capabilityId, pending.mediaAssetId, pending.targetLinkId);
            return;
        }
        const link = createCaptureAttempt('public-copy-link');
        await publicationService.submitPublicCopyMedia({
            inventoryId, capabilityId: pending.capabilityId,
            mediaAssetId: pending.mediaAssetId, role: pending.role,
            publicOrder: pending.publicOrder,
            idempotencyKey: link.key, commandId: link.commandId,
        });
        if (!isCurrentOpening(generation)) return;
        // R6b/R15: the post-add refetch is bounded and routes access loss
        // out; other failures continue to the re-confirm below.
        const refetched = await refetchMediaBounded();
        if (!isCurrentOpening(generation)) return;
        if (!refetched.ok && accessLost(refetched.error)) {
            failAccessLost();
            return;
        }
        if (client) void invalidateStoreViewAfterMedia(client, identity);
        // An add carries no version, so clear and confirm again.
        setConfirmedVersion(null);
        setConfirmState('confirming');
        const confirmed = await confirm();
        if (!isCurrentOpening(generation)) return;
        // Success shows only when the follow-up confirm succeeded (C8).
        if (confirmed) setMessage('Approved sanitized public-copy photo linked.');
    };

    const pickAndUpload = async (generation: number, role: PublicMediaRole, order: number, operation: MediaOperation) => {
        if (!isCurrentOpening(generation)) return;
        // R16: no inner catch — a failed add must propagate to runLocked so
        // it re-confirms (SDD §3.3: the server may have linked the photo
        // even though the response was lost).
        let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (!isCurrentOpening(generation)) return;
        if (!permission.granted && permission.canAskAgain) {
            permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!isCurrentOpening(generation)) return;
        }
        if (!permission.granted) throw new Error('Media-library permission is required.');
        const picked = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsEditing: false, quality: 1,
            exif: false, base64: false, allowsMultipleSelection: false,
        });
        if (!isCurrentOpening(generation)) return;
        if (picked.canceled) return;
        const selected = validateSelectedMedia(picked.assets[0], 'gallery');
        if (!selected.ok) throw new Error(selected.message);
        const envelopeSha256 = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            `${selected.media.mimeType}|${selected.media.fileSize}|${role}`,
        );
        if (!isCurrentOpening(generation)) return;
        const authorize = createCaptureAttempt('public-copy-authorize');
        const prepared = await publicationService.preparePublicCopyUpload({
            inventoryId, role, ordinal: order, media: selected.media, envelopeSha256,
            idempotencyKey: authorize.key, commandId: authorize.commandId,
            operationKind: operation.operationKind,
            ...(operation.targetLinkId ? { targetLinkId: operation.targetLinkId } : {}),
        });
        if (!isCurrentOpening(generation)) return;
        await prepared.upload(() => undefined).promise;
        if (!isCurrentOpening(generation)) return;
        const complete = createCaptureAttempt('public-copy-complete');
        const registered = await prepared.complete(complete.key, complete.commandId);
        if (!isCurrentOpening(generation)) return;
        const status = registered.state === 'approved'
            ? registered
            : await publicationService.readPublicCopyStatus(registered.mediaAssetId);
        if (!isCurrentOpening(generation)) return;
        if (status.state === 'processing') {
            setPendingUpload({
                capabilityId: prepared.capabilityId,
                sourceMediaAssetId: registered.mediaAssetId,
                role, publicOrder: order, ...operation,
            });
            setMessage('Photo uploaded. Safety processing is running; check again shortly.');
            const refetched = await refetchMediaBounded();
            if (!isCurrentOpening(generation)) return;
            if (!refetched.ok && accessLost(refetched.error)) failAccessLost();
            return;
        }
        if (status.state === 'failed') {
            setMessage('The photo failed safety validation. Choose another image.');
            return;
        }
        await linkApprovedPublicCopy(generation, {
            capabilityId: prepared.capabilityId, mediaAssetId: status.mediaAssetId,
            role, publicOrder: order, ...operation,
        });
    };

    const checkPendingStatus = () => void runLocked(async (generation) => {
        if (!pendingUpload) return;
        const status = await publicationService.readPublicCopyStatus(pendingUpload.sourceMediaAssetId);
        if (!isCurrentOpening(generation)) return;
        if (status.state === 'failed') {
            setPendingUpload(null);
            setMessage('The photo failed safety validation. Choose another image.');
        } else if (status.state === 'approved') {
            setPendingUpload(null);
            if (pendingUpload.operationKind === 'replace') {
                await linkApprovedPublicCopy(generation, {
                    capabilityId: pendingUpload.capabilityId, mediaAssetId: status.mediaAssetId,
                    role: pendingUpload.role, publicOrder: pendingUpload.publicOrder,
                    operationKind: 'replace', targetLinkId: pendingUpload.targetLinkId,
                });
            } else {
                await linkApprovedPublicCopy(generation, {
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
    const ready = confirmState === 'ready';
    const disabled = busy || commands.isPending || !ready;

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

                    {confirmState === 'confirming' ? (
                        <Text testID="store-view-media-loading" style={[styles.body, { color: colors.textSecondary }]}>
                            Loading the latest photos…
                        </Text>
                    ) : null}
                    {confirmState === 'failed' ? (
                        <View style={{ gap: 8 }}>
                            <Text testID="store-view-media-refresh-error" style={[styles.body, { color: colors.textSecondary }]}>
                                {confirmOffline
                                    ? "You're offline. The photo buttons are disabled."
                                    : "Couldn't refresh this book. Try again."}
                            </Text>
                            <Pressable
                                testID="store-view-media-retry"
                                disabled={busy}
                                onPress={() => void confirm()}
                                style={[styles.done, { borderColor: colors.border }]}
                            >
                                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Retry</Text>
                            </Pressable>
                        </View>
                    ) : null}

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
                                        onPress={() => void runLocked((generation) => pickAndUpload(
                                            generation,
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
                                    {pendingStatusLabel(pending)}
                                </Text>
                                {pending.state === 'approved' && pending.mediaAssetId ? (
                                    <Pressable
                                        testID={`store-view-media-install-${pending.capabilityId}`}
                                        disabled={disabled}
                                        onPress={() => {
                                            const mediaAssetId = pending.mediaAssetId;
                                            if (!mediaAssetId) return;
                                            void runLocked((generation) => {
                                                if (pending.operationKind === 'replace') {
                                                    if (!pending.targetLinkId) {
                                                        setMessage('The original photo is no longer available. Choose another image.');
                                                        return Promise.resolve();
                                                    }
                                                    return linkApprovedPublicCopy(generation, {
                                                        capabilityId: pending.capabilityId, mediaAssetId,
                                                        role: pending.role, publicOrder: pending.order,
                                                        operationKind: 'replace', targetLinkId: pending.targetLinkId,
                                                    });
                                                }
                                                return linkApprovedPublicCopy(generation, {
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
                        onPress={() => void runLocked((generation) => pickAndUpload(
                            generation,
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
                        disabled={busy || commands.isPending}
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

function pendingStatusLabel(pending: StoreViewPendingReplacement): string {
    if (pending.state === 'processing') return 'Safety processing…';
    if (pending.state === 'failed') {
        return pending.safeErrorCode
            ? `Failed safety validation (${pending.safeErrorCode}).`
            : 'Failed safety validation.';
    }
    if (pending.state === 'upload_pending') return 'Upload authorized; photo not yet received.';
    return pending.operationKind === 'replace'
        ? 'Approved and ready to install.'
        : 'Approved and ready to add.';
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
