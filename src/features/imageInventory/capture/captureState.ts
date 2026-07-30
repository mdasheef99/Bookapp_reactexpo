import type { ImagePickerAsset, PermissionResponse } from 'expo-image-picker';

export const MAX_SCAN_BYTES = 10_485_760;
export const MAX_SCAN_INPUTS = 15;
export const ALLOWED_SCAN_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type CaptureSource = 'camera' | 'gallery';
export type CapturePermissionState =
    | 'checking'
    | 'granted'
    | 'requestable'
    | 'settings_required';

export type SelectedScanMedia = Readonly<{
    uri: string;
    mimeType: (typeof ALLOWED_SCAN_MIME)[number];
    fileSize: number;
    width: number;
    height: number;
    source: CaptureSource;
}>;

export type MediaValidationResult =
    | { ok: true; media: SelectedScanMedia }
    | { ok: false; message: string };

export function permissionState(
    response: Pick<PermissionResponse, 'granted' | 'canAskAgain'> | null,
): CapturePermissionState {
    if (!response) return 'checking';
    if (response.granted) return 'granted';
    return response.canAskAgain ? 'requestable' : 'settings_required';
}

export function validateSelectedMedia(
    asset: ImagePickerAsset | undefined,
    source: CaptureSource,
): MediaValidationResult {
    const fileSize = asset?.fileSize;
    if (!asset?.uri || fileSize === undefined || !Number.isSafeInteger(fileSize) || fileSize <= 0) {
        return { ok: false, message: 'This image is missing required file information.' };
    }
    if (fileSize > MAX_SCAN_BYTES) {
        return { ok: false, message: 'Choose an image smaller than 10 MB.' };
    }
    if (!asset.mimeType || !ALLOWED_SCAN_MIME.includes(asset.mimeType as never)) {
        return { ok: false, message: 'Choose a JPEG, PNG, or WebP image.' };
    }
    if (!Number.isFinite(asset.width) || !Number.isFinite(asset.height)
        || asset.width <= 0 || asset.height <= 0) {
        return { ok: false, message: 'This image has invalid dimensions.' };
    }
    return {
        ok: true,
        media: {
            uri: asset.uri,
            mimeType: asset.mimeType as SelectedScanMedia['mimeType'],
            fileSize,
            width: asset.width,
            height: asset.height,
            source,
        },
    };
}

export type UploadStage =
    | 'idle'
    | 'authorizing'
    | 'uploading'
    | 'registration_pending'
    | 'registered'
    | 'transport_retryable_error'
    | 'registration_retryable_error'
    | 'terminal_error'
    | 'cancelled';

export type UploadState = Readonly<{
    stage: UploadStage;
    progress: number;
    bytesUploaded: boolean;
    message: string | null;
    generation: number;
}>;

export const initialUploadState: UploadState = {
    stage: 'idle',
    progress: 0,
    bytesUploaded: false,
    message: null,
    generation: 0,
};

export type UploadAction =
    | { type: 'start'; generation: number }
    | { type: 'authorized'; generation: number }
    | { type: 'progress'; generation: number; progress: number }
    | { type: 'register'; generation: number }
    | { type: 'success'; generation: number }
    | {
        type: 'failure';
        generation: number;
        phase: 'transport' | 'registration';
        retryable: boolean;
        message: string;
    }
    | { type: 'cancel'; generation: number }
    | { type: 'reset'; generation: number };

export function uploadReducer(state: UploadState, action: UploadAction): UploadState {
    if (action.type !== 'start' && action.type !== 'reset' && action.generation !== state.generation) {
        return state;
    }
    switch (action.type) {
        case 'start':
            return {
                stage: 'authorizing',
                progress: 0,
                bytesUploaded: false,
                message: null,
                generation: action.generation,
            };
        case 'authorized':
            return { ...state, stage: 'uploading' };
        case 'progress':
            return {
                ...state,
                progress: Math.max(state.progress, Math.min(100, Math.max(0, action.progress))),
            };
        case 'register':
            return {
                ...state,
                stage: 'registration_pending',
                progress: 100,
                bytesUploaded: true,
                message: null,
            };
        case 'success':
            return { ...state, stage: 'registered', progress: 100, message: null };
        case 'failure':
            return {
                ...state,
                stage: action.retryable
                    ? action.phase === 'registration'
                        ? 'registration_retryable_error'
                        : 'transport_retryable_error'
                    : 'terminal_error',
                bytesUploaded: action.phase === 'registration',
                message: action.message,
            };
        case 'cancel':
            return { ...state, stage: 'cancelled', message: null };
        case 'reset':
            return { ...initialUploadState, generation: action.generation };
    }
}
