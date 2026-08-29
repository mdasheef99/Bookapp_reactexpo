import { useEffect, useReducer, useRef, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import { CaptureClientError, captureService, type PreparedUpload } from '../api/captureService';
import {
    initialUploadState,
    permissionState,
    uploadReducer,
    validateSelectedMedia,
    type CaptureSource,
} from '../capture/captureState';
import { createCaptureAttempt, type CaptureAttempt } from '../capture/captureIds';
import { hasCurrentCaptureIdentity } from '../capture/captureAuthority';
import { useCaptureWorkflow } from '../capture/CaptureWorkflowContext';
import { registerCaptureCancellation } from '../capture/captureCancellation';
import type { UploadHandle } from '../capture/uploadTransport';
import {
    imageInventoryKeys,
    type ImageInventoryIdentity,
    useOwnerInventoryDiscovery,
    useOwnerInventoryInputs,
} from '../queries/ownerUxQueries';
import { useStartScanSessionV2 } from '../queries/ownerBatchReviewQueries';
import {
    buildStartScanSessionV2Request,
    initialScanSetupForm,
    isStartEnabled,
    type ScanSetupFormState,
} from '../scanSetup/scanSetupForm';
import { ScanSetupForm, ScanSetupSummary } from '../components/ScanSetupForm';
import { inventoryRoutes } from '../navigation/inventoryRoutes';
import { InventoryAccessBoundary } from './InventoryAccessBoundary';
import { useOwnerQueryMutationGate } from '../offline/ownerUxOfflineGate';

function CaptureSetup({ identity }: { identity: ImageInventoryIdentity }) {
    const router = useRouter();
    const discovery = useOwnerInventoryDiscovery(identity);
    const workflow = useCaptureWorkflow();
    const { isOffline } = useNetworkStatus();
    const { colors } = useTheme();
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const operationGeneration = useRef(0);
    const [sourceStep, setSourceStep] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    // One logical Start attempt owns one stable semantic identity AND one
    // frozen immutable request payload. A lost or ambiguous response replays
    // the exact original request; only a reconciled new Start may mint a
    // different identity, and later form edits never mutate an in-flight
    // replay's meaning.
    const [startAttempt] = useState(() => createCaptureAttempt('start-scan-session-v2'));
    const startRequestRef = useRef<ReturnType<typeof buildStartScanSessionV2Request> | null>(null);
    const startReconciledRef = useRef(false);
    const startedSessionIdRef = useRef<string | null>(null);
    const [form, setForm] = useState<ScanSetupFormState>(initialScanSetupForm);
    const startV2 = useStartScanSessionV2(identity);
    const gate = useOwnerQueryMutationGate({
        scope: `${identity.userId}:${identity.storeId}:capture-setup`,
        isOffline,
        query: discovery,
    });
    const mutationAuthority = useRef(gate.canMutate);
    mutationAuthority.current = gate.canMutate;
    useEffect(() => registerCaptureCancellation(() => {
        operationGeneration.current += 1;
        busyRef.current = false;
        setBusy(false);
        setSourceStep(false);
    }), []);

    async function beginStart() {
        if (busyRef.current || !gate.canMutate || !hasCurrentCaptureIdentity(identity)) return;
        if (!isStartEnabled(form)) {
            setMessage('Choose or enter a shelf location before starting.');
            return;
        }
        busyRef.current = true;
        const attempt = ++operationGeneration.current;
        setBusy(true);
        setMessage(null);
        try {
            if (!discovery.data?.activeSession) {
                if (!startReconciledRef.current) {
                    const request = startRequestRef.current
                        ?? buildStartScanSessionV2Request(form, startAttempt);
                    startRequestRef.current = request;
                    await new Promise<void>((resolve, reject) => {
                        startV2.mutate(request, {
                            onSuccess: (canonical) => {
                                startedSessionIdRef.current = canonical.sessionId;
                                resolve();
                            },
                            onError: (error) => reject(error),
                        });
                    });
                }
                startReconciledRef.current = true;
            }
            if (attempt !== operationGeneration.current || !hasCurrentCaptureIdentity(identity) || !mutationAuthority.current) return;
            setSourceStep(true);
        } catch {
            // The semantic identity is intentionally retained so the next
            // press replays the SAME idempotency key and command ID.
            setMessage('Starting did not finish clearly. Press Start scanning again to continue.');
        } finally {
            if (attempt === operationGeneration.current) {
                busyRef.current = false;
                setBusy(false);
            }
        }
    }

    async function choose(source: CaptureSource) {
        if (busyRef.current || !gate.canMutate) return;
        busyRef.current = true;
        const attempt = ++operationGeneration.current;
        setBusy(true);
        setMessage(null);
        try {
            const getPermission = source === 'camera'
                ? ImagePicker.getCameraPermissionsAsync
                : ImagePicker.getMediaLibraryPermissionsAsync;
            const requestPermission = source === 'camera'
                ? ImagePicker.requestCameraPermissionsAsync
                : ImagePicker.requestMediaLibraryPermissionsAsync;
            let permission = await getPermission();
            if (attempt !== operationGeneration.current || !hasCurrentCaptureIdentity(identity) || !mutationAuthority.current) return;
            if (!permission.granted && permission.canAskAgain) permission = await requestPermission();
            if (attempt !== operationGeneration.current || !hasCurrentCaptureIdentity(identity) || !mutationAuthority.current) return;
            const normalized = permissionState(permission);
            if (normalized !== 'granted') {
                setMessage(normalized === 'settings_required'
                    ? 'Allow access in device settings to continue.'
                    : 'Permission is required to choose this source.');
                return;
            }
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync({
                    mediaTypes: ['images'], allowsEditing: false, quality: 1, exif: false, base64: false,
                })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'], allowsEditing: false, quality: 1, exif: false, base64: false,
                    allowsMultipleSelection: false,
                });
            if (attempt !== operationGeneration.current || !hasCurrentCaptureIdentity(identity) || !mutationAuthority.current) return;
            if (result.canceled) return;
            const validated = validateSelectedMedia(result.assets[0], source);
            if (!validated.ok) {
                setMessage(validated.message);
                return;
            }
            if (attempt !== operationGeneration.current || !hasCurrentCaptureIdentity(identity) || !mutationAuthority.current) return;
            const sessionId = discovery.data?.activeSession?.sessionId
                ?? startedSessionIdRef.current;
            if (!sessionId) throw new CaptureClientError(
                'P9_INTERNAL_ERROR',
                true,
                'The session could not be started. Press Start scanning again.',
            );
            workflow.select(validated.media);
            router.push(inventoryRoutes.preview(sessionId));
        } catch (error) {
            setMessage(error instanceof CaptureClientError
                ? error.message
                : 'The image source could not be opened.');
        } finally {
            if (attempt === operationGeneration.current) {
                busyRef.current = false;
                setBusy(false);
            }
        }
    }

    return (
        <ScreenBackground>
            <View style={{ flex: 1 }}>
                <ScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28, gap: 18 }}
                >
                    <View style={{ gap: 8 }}>
                        <Text
                            selectable
                            accessibilityRole="header"
                            style={{ color: colors.textPrimary, fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -0.7 }}
                        >
                            Scan books
                        </Text>
                        <Text selectable style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22 }}>
                            Set defaults for this scan. You can change any detected book during review.
                        </Text>
                    </View>

                    <View style={{
                        alignSelf: 'flex-start',
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        backgroundColor: colors.bgCard,
                    }}>
                        <Text selectable style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                            Up to 15 visible book spines per image
                        </Text>
                    </View>

                    <ScanSetupForm form={form} onChange={setForm} />

                    <View style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 16,
                        padding: 16,
                        backgroundColor: colors.bgCard,
                        gap: 5,
                    }}>
                        <Text selectable style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800' }}>
                            Before taking the photo
                        </Text>
                        <Text selectable style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
                            Keep titles sharp and upright, avoid glare, and make sure no more than 15 spines are visible.
                        </Text>
                    </View>

                    {isOffline ? <Text selectable style={{ color: colors.error }}>Reconnect before choosing an image.</Text> : null}
                    {message ? <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error }}>{message}</Text> : null}
                </ScrollView>

                <View style={{
                    paddingHorizontal: 20,
                    paddingTop: 14,
                    paddingBottom: 18,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    backgroundColor: colors.bgCard,
                    gap: 12,
                }}>
                    <ScanSetupSummary form={form} />
                    {!sourceStep ? (
                        <>
                            <Button
                                title="Start scanning"
                                onPress={() => void beginStart()}
                                disabled={busy || !gate.canMutate || discovery.isLoading || !isStartEnabled(form)}
                                testID="capture-start"
                            />
                            {!isStartEnabled(form) ? (
                                <Text selectable style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center' }}>
                                    Choose or enter a shelf location before starting.
                                </Text>
                            ) : null}
                        </>
                    ) : (
                        <View style={{ gap: 10 }}>
                            <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800' }}>
                                Choose the image source
                            </Text>
                            <Button title="Open camera" onPress={() => void choose('camera')} disabled={busy || !gate.canMutate} testID="capture-camera" />
                            <Button title="Choose from gallery" variant="secondary" onPress={() => void choose('gallery')} disabled={busy || !gate.canMutate} testID="capture-gallery" />
                        </View>
                    )}
                    {message?.includes('settings') ? (
                        <Button title="Open settings" variant="ghost" onPress={() => void Linking.openSettings()} />
                    ) : null}
                </View>
            </View>
        </ScreenBackground>
    );
}

export function InventoryCaptureSetupScreen() {
    return <InventoryAccessBoundary>{(identity) => <CaptureSetup identity={identity} />}</InventoryAccessBoundary>;
}

function Preview({ identity, sessionId }: { identity: ImageInventoryIdentity; sessionId: string }) {
    const router = useRouter();
    const isFocused = useIsFocused();
    const queryClient = useQueryClient();
    const workflow = useCaptureWorkflow();
    const inputs = useOwnerInventoryInputs(identity, sessionId, isFocused);
    const { isOffline } = useNetworkStatus();
    const { colors } = useTheme();
    const [state, dispatch] = useReducer(uploadReducer, initialUploadState);
    const generation = useRef(0);
    const running = useRef(false);
    const active = useRef<UploadHandle | null>(null);
    const prepared = useRef<PreparedUpload | null>(null);
    const authorizeAttempt = useRef<CaptureAttempt | null>(null);
    const registerAttempt = useRef<CaptureAttempt | null>(null);
    const successfulNavigation = useRef(false);
    const media = workflow.selected;
    const gate = useOwnerQueryMutationGate({
        scope: `${identity.userId}:${identity.storeId}:${sessionId}:upload`,
        isOffline,
        query: inputs,
    });
    const mutationAuthority = useRef(gate.canMutate);
    mutationAuthority.current = gate.canMutate;

    const cancel = () => {
        generation.current += 1;
        active.current?.cancel();
        active.current = null;
        running.current = false;
        prepared.current = null;
        dispatch({ type: 'cancel', generation: state.generation });
    };
    useEffect(() => {
        const unregister = registerCaptureCancellation(cancel);
        return () => {
            unregister();
            cancel();
            if (successfulNavigation.current) { successfulNavigation.current = false; workflow.clear(); }
        };
    }, [workflow.clear]);

    async function upload() {
        if (!media || !mutationAuthority.current || running.current
            || (inputs.data?.items.length ?? 0) > 0) return;
        running.current = true;
        const nextGeneration = ++generation.current;
        let registrationStarted = false;
        dispatch({ type: 'start', generation: nextGeneration });
        try {
            let uploadAttempt = prepared.current;
            const registrationReplay = state.bytesUploaded && uploadAttempt !== null;
            if (!registrationReplay && (
                !uploadAttempt || Date.parse(uploadAttempt.expiresAt) <= Date.now() + 5_000
            )) {
                const nextAuthorizeAttempt = createCaptureAttempt('authorize-upload');
                authorizeAttempt.current = nextAuthorizeAttempt;
                uploadAttempt = await captureService.prepareUpload(
                    sessionId,
                    media,
                    (inputs.data?.items.length ?? 0) + 1,
                    nextAuthorizeAttempt.key,
                    nextAuthorizeAttempt.commandId,
                );
                if (!mutationAuthority.current) return;
                prepared.current = uploadAttempt;
                registerAttempt.current = createCaptureAttempt('register-upload');
            }
            if (!uploadAttempt) throw new CaptureClientError(
                'P9_INTERNAL_ERROR',
                true,
                'Upload preparation is unavailable.',
            );
            if (generation.current !== nextGeneration || !hasCurrentCaptureIdentity(identity) || !mutationAuthority.current) return;
            if (!registrationReplay) {
                dispatch({ type: 'authorized', generation: nextGeneration });
                active.current = uploadAttempt.upload((progress) => {
                    dispatch({ type: 'progress', generation: nextGeneration, progress });
                });
                await active.current.promise;
                if (generation.current !== nextGeneration || !hasCurrentCaptureIdentity(identity) || !mutationAuthority.current) return;
            }
            dispatch({ type: 'register', generation: nextGeneration });
            registrationStarted = true;
            if (!mutationAuthority.current) return;
            const currentRegisterAttempt = registerAttempt.current;
            if (!currentRegisterAttempt) throw new CaptureClientError(
                'P9_INTERNAL_ERROR',
                true,
                'Upload registration identity is unavailable.',
            );
            await uploadAttempt.register(currentRegisterAttempt.key, currentRegisterAttempt.commandId);
            if (generation.current !== nextGeneration || !hasCurrentCaptureIdentity(identity) || !mutationAuthority.current) return;
            dispatch({ type: 'success', generation: nextGeneration });
            prepared.current = null;
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: imageInventoryKeys.discovery(identity) }),
                queryClient.invalidateQueries({ queryKey: imageInventoryKeys.session(identity, sessionId) }),
                queryClient.invalidateQueries({ queryKey: imageInventoryKeys.inputs(identity, sessionId) }),
            ]);
            if (generation.current !== nextGeneration || !hasCurrentCaptureIdentity(identity) || !mutationAuthority.current) return;
            successfulNavigation.current = true;
            router.replace(inventoryRoutes.session(sessionId));
        } catch (error) {
            successfulNavigation.current = false;
            if (generation.current !== nextGeneration) return;
            const captureError = error instanceof CaptureClientError ? error : null;
            let retryPhase: 'transport' | 'registration' = registrationStarted
                ? 'registration'
                : 'transport';
            if (captureError?.code === 'P9_MEDIA_OBJECT_CHANGED'
                || captureError?.code === 'P9_STATE_CONFLICT') {
                prepared.current = null;
                retryPhase = 'transport';
            }
            if (registrationStarted) {
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: imageInventoryKeys.session(identity, sessionId) }),
                    queryClient.invalidateQueries({ queryKey: imageInventoryKeys.inputs(identity, sessionId) }),
                ]);
            }
            dispatch({
                type: 'failure',
                generation: nextGeneration,
                phase: retryPhase,
                retryable: captureError?.retryable ?? true,
                message: captureError?.message ?? 'Upload interrupted. Try again.',
            });
        } finally {
            if (generation.current === nextGeneration) {
                active.current = null;
                running.current = false;
            }
        }
    }

    if (!media) {
        return (
            <ScreenBackground>
                <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24 }}>
                    <GlassCard padding={20} borderRadius={16}>
                        <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '800' }}>Image not available</Text>
                        <Text selectable style={{ color: colors.textSecondary, marginTop: 8 }}>That upload was not registered. Select the image again.</Text>
                        <Button title="Choose image" style={{ marginTop: 16 }} onPress={() => router.replace(inventoryRoutes.scan())} />
                    </GlassCard>
                </ScrollView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, gap: 16 }}>
                <Image source={{ uri: media.uri }} contentFit="contain" accessibilityLabel="Selected spine photo" style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 16 }} />
                <GlassCard padding={20} borderRadius={16}>
                    <Text selectable style={{ color: colors.textPrimary, fontWeight: '800' }}>{media.source === 'camera' ? 'Camera image' : 'Gallery image'}</Text>
                    <Text selectable style={{ color: colors.textSecondary, marginTop: 8 }}>Check that titles are sharp, upright, and free from glare. Keep no more than 15 spines visible.</Text>
                    {state.stage !== 'idle' ? (
                        <Text selectable accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: state.progress }} accessibilityLiveRegion="polite" style={{ color: colors.textPrimary, marginTop: 12 }}>
                            {state.bytesUploaded ? 'Registering image' : `Uploading image ${Math.round(state.progress)}%`}
                        </Text>
                    ) : null}
                    {state.message ? <Text selectable style={{ color: colors.error, marginTop: 10 }}>{state.message}</Text> : null}
                    {(inputs.data?.items.length ?? 0) > 0 ? (
                        <Text selectable accessibilityLiveRegion="assertive" style={{ color: colors.error, marginTop: 10 }}>This scan already has an image. Remove it before choosing a replacement.</Text>
                    ) : null}
                    <View style={{ gap: 12, marginTop: 18 }}>
                        {state.stage !== 'terminal_error' ? (
                            <Button
                                title={state.stage === 'registration_retryable_error'
                                    ? 'Retry registration'
                                    : state.stage === 'transport_retryable_error'
                                        ? 'Retry upload'
                                        : 'Upload image'}
                                onPress={() => void upload()}
                                disabled={!gate.canMutate || (inputs.data?.items.length ?? 0) > 0 || ['authorizing', 'uploading', 'registration_pending'].includes(state.stage)}
                            />
                        ) : null}
                        {['authorizing', 'uploading'].includes(state.stage) ? <Button title="Cancel upload" variant="secondary" onPress={cancel} /> : null}
                        <Button title="Choose another image" variant="ghost" onPress={() => { workflow.clear(); router.back(); }} disabled={['authorizing', 'uploading', 'registration_pending'].includes(state.stage)} />
                    </View>
                </GlassCard>
            </ScrollView>
        </ScreenBackground>
    );
}

export function InventoryCapturePreviewScreen({ sessionId }: { sessionId: string }) {
    return <InventoryAccessBoundary>{(identity) => <Preview identity={identity} sessionId={sessionId} />}</InventoryAccessBoundary>;
}
