jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
jest.mock('@react-native-ml-kit/text-recognition', () => ({ __esModule: true, default: { recognize: jest.fn() } }));
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { ocrService } from '../ocrService';
import { supabase } from '@/lib/supabase';
import { setAuthState } from '@/features/auth/store/authStore';
const native = TextRecognition.recognize as jest.Mock;
const invoke = supabase.functions.invoke as jest.Mock;
const requestId = '92000000-0000-4000-8000-000000000001';
const cloudOptions = { imageBase64: '/9j/AAAA', languageHint: 'en' as const, requestId, consent: true, userId: 'reader-a' };
it('times out stalled local recognition without triggering a cloud request', async () => {
 jest.useFakeTimers();
 try {
  native.mockImplementation(() => new Promise(() => {}));
  const failure = expect(ocrService.recognizePageText('/image.jpg')).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });
  await jest.advanceTimersByTimeAsync(30001); await failure; expect(invoke).not.toHaveBeenCalled();
 } finally { jest.useRealTimers(); }
});
it('rejects oversized cloud image before calling backend', async () => {
 await expect(ocrService.recognizePageViaCloud({ ...cloudOptions, imageBase64: '/9j/' + 'A'.repeat(3*1024*1024) })).rejects.toMatchObject({ code: 'IMAGE_TOO_LARGE' });
 expect(invoke).not.toHaveBeenCalled();
});
beforeEach(() => { jest.clearAllMocks(); setAuthState({ session: { user: { id: 'reader-a' } } as any, status: 'authenticated', initializationError: null }); });
it('loads the real default-export/object contract and preserves 600 words', async () => {
 const text = Array(600).fill('passage').join(' '); native.mockResolvedValue({ text, blocks: [] });
 const result = await ocrService.recognizePageText('/image.jpg');
 expect(native).toHaveBeenCalledWith('/image.jpg', 'Latin'); expect(result.reviewText).toBe(text);
 expect(result.reviewOverflow).toBe(false); expect(invoke).not.toHaveBeenCalled();
});
it('returns validated text-box frames from the local recognizer for automatic crop selection', async () => {
 native.mockResolvedValue({ text: 'two printed lines', blocks: [
  { frame: { left: 35, top: 110, width: 400, height: 20 } },
  { frame: { left: 40, top: 160, width: 390, height: 22 } },
  { frame: { left: 10, top: 10, width: 0, height: 10 } },
  { text: 'no frame' },
 ] });
 await expect(ocrService.recognizePageText('/page.jpg')).resolves.toMatchObject({
  reviewText: 'two printed lines',
  textBounds: [{ left: 35, top: 110, width: 400, height: 20 }, { left: 40, top: 160, width: 390, height: 22 }],
 });
});
it('does not upload after an empty result', async () => {
 native.mockResolvedValue({ text: '  ', blocks: [] });
 await expect(ocrService.recognizePageText('/image.jpg')).rejects.toMatchObject({ code: 'NO_TEXT' }); expect(invoke).not.toHaveBeenCalled();
});
it('does not leak local failure details or upload', async () => {
 native.mockRejectedValue(new Error('private image details'));
 await expect(ocrService.recognizePageText('/image.jpg')).rejects.toMatchObject({ code: 'LOCAL_FAILED' }); expect(invoke).not.toHaveBeenCalled();
});
it('offers unsupported scripts without invoking Latin or cloud', async () => {
 await expect(ocrService.recognizePageText('/image.jpg', { languageHint: 'kn' })).rejects.toMatchObject({ code: 'UNSUPPORTED_SCRIPT' });
 expect(native).not.toHaveBeenCalled(); expect(invoke).not.toHaveBeenCalled();
});
it('rejects malformed native text', async () => {
 native.mockResolvedValue({ text: 42 }); await expect(ocrService.recognizePageText('/image.jpg')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
it('bounds review without splitting emoji', async () => {
 native.mockResolvedValue({ text: '😀'.repeat(20001), blocks: [] }); const result = await ocrService.recognizePageText('/image.jpg');
 expect(Array.from(result.reviewText)).toHaveLength(20000); expect(result.reviewOverflow).toBe(true);
});
it('requires explicit cloud consent', async () => {
 await expect(ocrService.recognizePageViaCloud({ ...cloudOptions, consent: false })).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' }); expect(invoke).not.toHaveBeenCalled();
});
it('rejects malformed image before transmission', async () => {
 await expect(ocrService.recognizePageViaCloud({ ...cloudOptions, imageBase64: 'not an image' })).rejects.toMatchObject({ code: 'INVALID_INPUT' }); expect(invoke).not.toHaveBeenCalled();
});
it('decodes full-review cloud response and sends versioned request', async () => {
 invoke.mockResolvedValue({ data: { version: 1, provider: 'cloud', languageHint: 'en', reviewText: 'passage', reviewOverflow: false }, error: null });
 expect(await ocrService.recognizePageViaCloud(cloudOptions)).toMatchObject({ reviewText: 'passage', provider: 'cloud' });
 expect(invoke).toHaveBeenCalledWith('ocr-fallback', expect.objectContaining({ body: { version: 1, requestId, imageBase64: cloudOptions.imageBase64, languageHint: 'en' } }));
});
it('reports disabled cloud safely', async () => {
 invoke.mockResolvedValue({ data: { error: { code: 'CLOUD_DISABLED' } }, error: null });
 await expect(ocrService.recognizePageViaCloud(cloudOptions)).rejects.toMatchObject({ code: 'CLOUD_DISABLED' });
});
it('rejects the old capped cloud response', async () => {
 invoke.mockResolvedValue({ data: { text: 'capped', rawText: 'uncapped' }, error: null });
 await expect(ocrService.recognizePageViaCloud(cloudOptions)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
it('ignores canceled native result', async () => {
 let resolve!: (v: unknown) => void; native.mockImplementation(() => new Promise(r => { resolve = r; }));
 const controller = new AbortController(); const work = ocrService.recognizePageText('/image.jpg', { signal: controller.signal });
 controller.abort(); resolve({ text: 'late', blocks: [] }); await expect(work).rejects.toMatchObject({ code: 'CANCELED' });
});
it('rejects cloud output after account changes', async () => {
 invoke.mockImplementation(async () => { setAuthState({ session: null, status: 'unauthenticated', initializationError: null });
 return { data: { version: 1, provider: 'cloud', languageHint: 'en', reviewText: 'late', reviewOverflow: false }, error: null }; });
 await expect(ocrService.recognizePageViaCloud(cloudOptions)).rejects.toMatchObject({ code: 'CANCELED' });
});
