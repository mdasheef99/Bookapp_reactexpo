import type { SelectedScanMedia } from './captureState';

export type UploadHandle = Readonly<{
    promise: Promise<void>;
    cancel: () => void;
}>;

export function uploadSignedMedia(
    signedUploadUrl: string,
    media: SelectedScanMedia,
    onProgress: (percentage: number) => void,
): UploadHandle {
    const request = new XMLHttpRequest();
    const localController = new AbortController();
    let settled = false;
    let cancelled = false;
    let rejectPromise: (reason: Error) => void = () => undefined;

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
                else reject(new Error('upload transport failed'));
            };
            request.onerror = () => {
                if (settled) return;
                settled = true;
                reject(new Error('upload transport failed'));
            };
            request.onabort = () => {
                if (settled) return;
                settled = true;
                reject(new Error('upload cancelled'));
            };
            request.send(body);
        } catch {
            if (cancelled) return;
            if (!settled) {
                settled = true;
                reject(new Error('upload transport failed'));
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
            rejectPromise(new Error('upload cancelled'));
        },
    };
}
