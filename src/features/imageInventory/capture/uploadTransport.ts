import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { SelectedScanMedia } from './captureState';

export type UploadHandle = Readonly<{
    promise: Promise<void>;
    cancel: () => void;
}>;

export type UploadTransportCode =
    | 'UPLOAD_CANCELLED'
    | 'UPLOAD_FILE_UNAVAILABLE'
    | 'UPLOAD_FILE_CHANGED'
    | 'UPLOAD_HTTP_ERROR'
    | 'UPLOAD_NETWORK_ERROR';

export type UploadTransportDiagnostic = Readonly<{
    platform: string;
    stage: 'native_signed_put';
    status: number;
    contentType: SelectedScanMedia['mimeType'];
    expectedByteSize: number;
    storageError?: string;
}>;

export class UploadTransportError extends Error {
    constructor(
        readonly code: UploadTransportCode,
        message: string,
        readonly diagnostic?: UploadTransportDiagnostic,
    ) {
        super(message);
        this.name = 'UploadTransportError';
    }
}

const signedHeaders = (media: SelectedScanMedia) => ({
    'cache-control': 'max-age=0',
    'content-type': media.mimeType,
    'x-upsert': 'false',
});

function safeStorageError(body: string): string | undefined {
    if (!body) return undefined;
    let value: unknown = body;
    try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        value = ['code', 'error', 'message', 'statusCode']
            .map((key) => parsed[key])
            .filter((entry): entry is string | number => (
                typeof entry === 'string' || typeof entry === 'number'
            ))
            .join(' | ');
    } catch {
        // A bounded plain-text response is still useful after redaction.
    }
    const text = String(value)
        .replace(/https?:\/\/[^\s"']+/giu, '[redacted-url]')
        .replace(/\b(token|authorization|apikey|key)\s*[=:]\s*[^\s,;"']+/giu, '$1=[redacted]')
        .replace(/[\u0000-\u001f\u007f]/gu, ' ')
        .trim()
        .slice(0, 320);
    return text || undefined;
}

function nativeDiagnostic(
    media: SelectedScanMedia,
    status: number,
    body?: string,
): UploadTransportDiagnostic {
    const storageError = body ? safeStorageError(body) : undefined;
    return {
        platform: Platform.OS,
        stage: 'native_signed_put',
        status,
        contentType: media.mimeType,
        expectedByteSize: media.fileSize,
        ...(storageError ? { storageError } : {}),
    };
}

function uploadNativeSignedMedia(
    signedUploadUrl: string,
    media: SelectedScanMedia,
    onProgress: (percentage: number) => void,
): UploadHandle {
    let task: FileSystem.UploadTask | null = null;
    let settled = false;
    let cancelled = false;
    let rejectPromise: (reason: UploadTransportError) => void = () => undefined;

    const promise = new Promise<void>(async (resolve, reject) => {
        rejectPromise = reject;
        const rejectOnce = (error: UploadTransportError) => {
            if (settled) return;
            settled = true;
            reject(error);
        };
        try {
            const info = await FileSystem.getInfoAsync(media.uri);
            if (cancelled) return;
            if (!info.exists || info.isDirectory) {
                rejectOnce(new UploadTransportError(
                    'UPLOAD_FILE_UNAVAILABLE',
                    'local media unavailable',
                ));
                return;
            }
            if (info.size !== media.fileSize) {
                rejectOnce(new UploadTransportError(
                    'UPLOAD_FILE_CHANGED',
                    'local media changed',
                ));
                return;
            }

            task = FileSystem.createUploadTask(
                signedUploadUrl,
                media.uri,
                {
                    httpMethod: 'PUT',
                    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
                    sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
                    headers: signedHeaders(media),
                },
                ({ totalBytesSent, totalBytesExpectedToSend }) => {
                    if (cancelled || settled || totalBytesExpectedToSend <= 0) return;
                    onProgress(Math.round(
                        (Math.min(totalBytesSent, totalBytesExpectedToSend)
                            / totalBytesExpectedToSend) * 100,
                    ));
                },
            );
            const result = await task.uploadAsync();
            if (cancelled) return;
            if (!result) {
                rejectOnce(new UploadTransportError(
                    'UPLOAD_NETWORK_ERROR',
                    'upload transport failed',
                    nativeDiagnostic(media, 0),
                ));
                return;
            }
            if (result.status < 200 || result.status >= 300) {
                rejectOnce(new UploadTransportError(
                    'UPLOAD_HTTP_ERROR',
                    'upload transport failed',
                    nativeDiagnostic(media, result.status, result.body),
                ));
                return;
            }
            if (!settled) {
                settled = true;
                resolve();
            }
        } catch (error) {
            if (cancelled) return;
            rejectOnce(error instanceof UploadTransportError
                ? error
                : new UploadTransportError(
                    'UPLOAD_NETWORK_ERROR',
                    'upload transport failed',
                    nativeDiagnostic(media, 0),
                ));
        }
    });

    return {
        promise,
        cancel: () => {
            if (settled || cancelled) return;
            cancelled = true;
            settled = true;
            if (task) void task.cancelAsync().catch(() => undefined);
            rejectPromise(new UploadTransportError(
                'UPLOAD_CANCELLED',
                'upload cancelled',
            ));
        },
    };
}

function uploadWebSignedMedia(
    signedUploadUrl: string,
    media: SelectedScanMedia,
    onProgress: (percentage: number) => void,
): UploadHandle {
    const request = new XMLHttpRequest();
    const localController = new AbortController();
    let settled = false;
    let cancelled = false;
    let rejectPromise: (reason: UploadTransportError) => void = () => undefined;

    const promise = new Promise<void>(async (resolve, reject) => {
        rejectPromise = reject;
        try {
            const local = await fetch(media.uri, { signal: localController.signal });
            if (cancelled) return;
            if (!local.ok) throw new Error('local media unavailable');
            const blob = await local.blob();
            if (cancelled) return;
            if (blob.size !== media.fileSize) throw new Error('local media changed');
            const body = new FormData();
            body.append('cacheControl', '0');
            body.append('', blob);
            request.open('PUT', signedUploadUrl);
            request.setRequestHeader('x-upsert', 'false');
            request.upload.onprogress = (event) => {
                if (!cancelled && !settled && event.lengthComputable && event.total > 0) {
                    onProgress(Math.round((event.loaded / event.total) * 100));
                }
            };
            request.onload = () => {
                if (settled) return;
                settled = true;
                if (request.status >= 200 && request.status < 300) resolve();
                else reject(new UploadTransportError(
                    'UPLOAD_HTTP_ERROR',
                    'upload transport failed',
                ));
            };
            request.onerror = () => {
                if (settled) return;
                settled = true;
                reject(new UploadTransportError(
                    'UPLOAD_NETWORK_ERROR',
                    'upload transport failed',
                ));
            };
            request.onabort = () => {
                if (settled) return;
                settled = true;
                reject(new UploadTransportError('UPLOAD_CANCELLED', 'upload cancelled'));
            };
            request.send(body);
        } catch {
            if (cancelled) return;
            if (!settled) {
                settled = true;
                reject(new UploadTransportError(
                    'UPLOAD_NETWORK_ERROR',
                    'upload transport failed',
                ));
            }
        }
    });

    return {
        promise,
        cancel: () => {
            if (settled || cancelled) return;
            cancelled = true;
            settled = true;
            localController.abort();
            request.upload.onprogress = null;
            request.onload = null;
            request.onerror = null;
            request.onabort = null;
            request.abort();
            rejectPromise(new UploadTransportError('UPLOAD_CANCELLED', 'upload cancelled'));
        },
    };
}

export function uploadSignedMedia(
    signedUploadUrl: string,
    media: SelectedScanMedia,
    onProgress: (percentage: number) => void,
): UploadHandle {
    return Platform.OS === 'web'
        ? uploadWebSignedMedia(signedUploadUrl, media, onProgress)
        : uploadNativeSignedMedia(signedUploadUrl, media, onProgress);
}
