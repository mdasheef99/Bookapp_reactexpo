import { supabase } from '@/lib/supabase';
import { captureService } from '../api/captureService';

jest.mock('@/lib/supabase', () => ({
    supabase: { functions: { invoke: jest.fn() } },
}));

const invoke = supabase.functions.invoke as jest.Mock;
const uuid = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
const media = {
    uri: 'file:///private/scan.jpg',
    mimeType: 'image/jpeg' as const,
    fileSize: 1024,
    width: 100,
    height: 200,
    source: 'camera' as const,
};

describe('Phase 9 Unit 6C ingestion adapter', () => {
    beforeEach(() => jest.clearAllMocks());

    it('starts with visible private defaults and stable semantic identity', async () => {
        invoke.mockResolvedValue({ data: { sessionId: uuid(1) }, error: null });
        await expect(captureService.startSession(
            { language: 'en', script: 'Latn', condition: 'good' },
            'start-session-key-0001',
            uuid(2),
        )).resolves.toBe(uuid(1));
        expect(invoke).toHaveBeenCalledWith('phase9-owner-ingestion', {
            body: {
                action: 'start_session',
                contractVersion: 'phase9-v1',
                language: 'en',
                script: 'Latn',
                condition: 'good',
                idempotencyKey: 'start-session-key-0001',
                commandId: uuid(2),
            },
        });
    });

    it('keeps signed transport details adapter-local and discards the job identifier', async () => {
        invoke
            .mockResolvedValueOnce({
                data: {
                    capabilityId: uuid(3),
                    signedUploadUrl: 'https://storage.example/upload?token=private',
                    uploadToken: 'private-token',
                    expiresAt: '2026-08-01T00:00:00.000Z',
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: { inputId: uuid(4), jobId: uuid(5), state: 'uploaded' },
                error: null,
            });
        const prepared = await captureService.prepareUpload(
            uuid(1), media, 1, 'authorize-upload-key-0001', uuid(6),
        );
        expect(prepared.expiresAt).toBe('2026-08-01T00:00:00.000Z');
        await expect(prepared.register(
            'register-upload-key-0001', uuid(7),
        )).resolves.toEqual({ inputId: uuid(4), state: 'uploaded' });
    });

    it('fails closed on malformed sensitive envelopes', async () => {
        invoke.mockResolvedValue({
            data: {
                capabilityId: uuid(3),
                signedUploadUrl: 'not-a-url',
                uploadToken: 'private',
                expiresAt: 'tomorrow',
            },
            error: null,
        });
        await expect(captureService.prepareUpload(
            uuid(1), media, 1, 'authorize-upload-key-0001', uuid(6),
        )).rejects.toMatchObject({ code: 'P9_INTERNAL_ERROR' });
    });

    it('preserves the one-current-image limit as bounded replacement guidance', async () => {
        invoke.mockResolvedValue({
            data: null,
            error: {
                context: { json: async () => ({
                    error: 'P9_SINGLE_IMAGE_LIMIT', retryable: false,
                    message: 'private database detail',
                }) },
            },
        });
        await expect(captureService.prepareUpload(
            uuid(1), media, 1, 'authorize-upload-key-0001', uuid(6),
        )).rejects.toMatchObject({
            code: 'P9_SINGLE_IMAGE_LIMIT', retryable: false,
            message: 'Remove the current image before choosing a replacement.',
        });
    });
});
