/**
 * Confirmed photo state (§3.3). The photo buttons are enabled only while a
 * confirmed state — a version plus a photo list read after it — is set.
 * Confirming refetches the book detail, then the photo list; both must
 * succeed. Closing and reopening starts again from "on open" so a stale
 * version or photo list is never reused. No contract change.
 */
export class PhotoConfirmError extends Error {
    readonly offline: boolean;
    readonly code: string | null;
    readonly httpStatus: number | null;
    constructor(offline: boolean, message: string, code: string | null = null, httpStatus: number | null = null) {
        super(message);
        this.name = 'PhotoConfirmError';
        this.offline = offline;
        this.code = code;
        this.httpStatus = httpStatus;
    }
}

export const PHOTO_CONFIRM_TIMEOUT_MS = 15_000;

/**
 * Reads a fresh version, then re-reads the photo list. Throws
 * PhotoConfirmError (offline flag set when the device is offline or the
 * refresh stalls). A detail refresh that completes later is reported through
 * onLateVersion so the modal can still accept it.
 */
export async function confirmPhotoBook(args: {
    isOnline: boolean;
    refreshDetail: () => Promise<number>;
    refreshMedia: () => Promise<void>;
    timeoutMs?: number;
    onLateVersion?: (version: number) => void;
    /** R9: a failure that lands after the timeout is reported here instead of being suppressed. */
    onLateFailure?: (failure: unknown) => void;
}): Promise<number> {
    if (!args.isOnline) throw new PhotoConfirmError(true, 'offline');
    const timeoutMs = args.timeoutMs ?? PHOTO_CONFIRM_TIMEOUT_MS;
    let late = false;
    let lateVersion: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    const timer = new Promise<number>((_resolve, reject) => {
        timerId = setTimeout(() => {
            late = true;
            if (lateVersion !== null) args.onLateVersion?.(lateVersion);
            // R17: a 15s stall counts as offline, as in §3.2.
            reject(new PhotoConfirmError(true, 'timeout'));
        }, timeoutMs);
    });
    const attempt = (async (): Promise<number> => {
        try {
            const version = await args.refreshDetail();
            lateVersion = version;
            if (late) {
                args.onLateVersion?.(version);
                return version;
            }
            await args.refreshMedia();
            return version;
        } catch (failure) {
            // R9: a late failure is still reported so the modal can route
            // late access loss to the access-lost path.
            if (late) args.onLateFailure?.(failure);
            throw failure;
        }
    })();
    attempt.catch(() => undefined);
    try {
        return await Promise.race([attempt, timer]);
    } finally {
        if (timerId !== undefined) clearTimeout(timerId);
    }
}
