import {
    MAX_SCAN_BYTES,
    initialUploadState,
    permissionState,
    uploadReducer,
    validateSelectedMedia,
} from '../capture/captureState';

const asset = {
    uri: 'file:///private/image.jpg',
    mimeType: 'image/jpeg',
    fileSize: 1024,
    width: 1200,
    height: 800,
};

describe('Phase 9 Unit 6C capture state', () => {
    it('normalizes granted, requestable, permanent denial, and pending permissions', () => {
        expect(permissionState(null)).toBe('checking');
        expect(permissionState({ granted: true, canAskAgain: true })).toBe('granted');
        expect(permissionState({ granted: false, canAskAgain: true })).toBe('requestable');
        expect(permissionState({ granted: false, canAskAgain: false })).toBe('settings_required');
    });

    it('accepts bounded media without copying metadata into the normalized value', () => {
        expect(validateSelectedMedia({ ...asset, exif: { GPS: 'private' } } as never, 'camera'))
            .toEqual({ ok: true, media: { ...asset, source: 'camera' } });
    });

    it.each([
        [{ ...asset, mimeType: 'image/gif' }, 'JPEG'],
        [{ ...asset, fileSize: MAX_SCAN_BYTES + 1 }, '10 MB'],
        [{ ...asset, fileSize: undefined }, 'file information'],
        [{ ...asset, width: 0 }, 'dimensions'],
    ])('rejects invalid media before authorization', (invalid, message) => {
        expect(validateSelectedMedia(invalid as never, 'gallery')).toEqual({
            ok: false,
            message: expect.stringContaining(message),
        });
    });

    it('keeps progress bounded and monotonic and ignores stale completions', () => {
        let state = uploadReducer(initialUploadState, { type: 'start', generation: 1 });
        state = uploadReducer(state, { type: 'authorized', generation: 1 });
        state = uploadReducer(state, { type: 'progress', generation: 1, progress: 55 });
        state = uploadReducer(state, { type: 'progress', generation: 1, progress: 20 });
        state = uploadReducer(state, { type: 'progress', generation: 1, progress: 120 });
        expect(state.progress).toBe(100);
        const cancelled = uploadReducer(state, { type: 'cancel', generation: 1 });
        expect(uploadReducer(cancelled, { type: 'success', generation: 0 })).toBe(cancelled);
    });

    it('records byte completion separately from retryable registration failure', () => {
        let state = uploadReducer(initialUploadState, { type: 'start', generation: 1 });
        state = uploadReducer(state, { type: 'authorized', generation: 1 });
        state = uploadReducer(state, { type: 'register', generation: 1 });
        expect(state).toMatchObject({
            stage: 'registration_pending',
            bytesUploaded: true,
            progress: 100,
        });
        state = uploadReducer(state, {
            type: 'failure',
            generation: 1,
            phase: 'registration',
            retryable: true,
            message: 'Try registration again.',
        });
        expect(state).toMatchObject({
            stage: 'registration_retryable_error',
            bytesUploaded: true,
        });
        expect(JSON.stringify(state)).not.toMatch(
            /file:|signed|token|bearer|capability|bytes":|raw|private path/iu,
        );
    });

    it('keeps transport failures eligible for byte retry without claiming completion', () => {
        let state = uploadReducer(initialUploadState, { type: 'start', generation: 1 });
        state = uploadReducer(state, { type: 'authorized', generation: 1 });
        state = uploadReducer(state, {
            type: 'failure',
            generation: 1,
            phase: 'transport',
            retryable: true,
            message: 'Try upload again.',
        });
        expect(state).toMatchObject({
            stage: 'transport_retryable_error',
            bytesUploaded: false,
        });
    });
});
