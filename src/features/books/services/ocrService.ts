import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
export type OcrLanguageHint = 'en' | 'hi' | 'kn' | 'ml';
export type OcrProvider = 'on-device' | 'cloud';
export interface OcrTextBounds { left: number; top: number; width: number; height: number }
export interface OcrResult { version: 1; provider: OcrProvider; languageHint: OcrLanguageHint; reviewText: string; reviewOverflow: boolean; textBounds?: OcrTextBounds[] }
export const OCR_REVIEW_LIMIT = 20000;
export const OCR_IMAGE_BYTES = 2 * 1024 * 1024;
export type OcrErrorCode = 'ON_DEVICE_UNAVAILABLE' | 'LOCAL_FAILED' | 'UNSUPPORTED_SCRIPT' | 'CONSENT_REQUIRED' | 'CANCELED' | 'AUTH_REQUIRED' | 'INVALID_INPUT' | 'IMAGE_TOO_LARGE' | 'CLOUD_DISABLED' | 'QUOTA_EXCEEDED' | 'PROVIDER_TIMEOUT' | 'PROVIDER_UNAVAILABLE' | 'NO_TEXT' | 'INVALID_RESPONSE';
const messages: Record<OcrErrorCode, string> = {
 ON_DEVICE_UNAVAILABLE: 'On-device scanning is unavailable in this app. You can write or paste your note instead.',
 LOCAL_FAILED: 'The page could not be read on this device. Adjust the photo or return to writing.',
 UNSUPPORTED_SCRIPT: 'This language is not supported by on-device scanning in this version. You can write or paste your note instead.',
 CONSENT_REQUIRED: 'Confirm uploading this page before using cloud recognition.', CANCELED: 'Recognition canceled.',
 AUTH_REQUIRED: 'Sign in to use cloud recognition.', INVALID_INPUT: 'Choose a valid JPEG or PNG page image.',
 IMAGE_TOO_LARGE: 'This image is too large. Use a smaller image or crop the page.', CLOUD_DISABLED: 'Cloud recognition is not available yet. Your text has been kept.',
 QUOTA_EXCEEDED: 'The cloud recognition limit has been reached. Your text has been kept.', PROVIDER_TIMEOUT: 'Recognition timed out. Your text has been kept.',
 PROVIDER_UNAVAILABLE: 'Cloud recognition could not finish. Your text has been kept.', NO_TEXT: 'No text was recognized. Adjust the photo or return to writing.',
 INVALID_RESPONSE: 'Recognition returned an unreadable result. Your text has been kept.',
};
export class OcrError extends Error { constructor(public readonly code: OcrErrorCode) { super(messages[code]); this.name = 'OcrError'; } }
export function ocrErrorMessage(error: unknown): string { return error instanceof OcrError ? error.message : messages.LOCAL_FAILED; }
function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw new OcrError('CANCELED'); }
export function boundedReview(text: unknown, languageHint: OcrLanguageHint, provider: OcrProvider, textBounds?: OcrTextBounds[]): OcrResult {
 if (typeof text !== 'string') throw new OcrError('INVALID_RESPONSE');
 if (!text.trim()) throw new OcrError('NO_TEXT');
 const points = Array.from(text);
 return { version: 1, provider, languageHint, reviewText: points.slice(0, OCR_REVIEW_LIMIT).join(''), reviewOverflow: points.length > OCR_REVIEW_LIMIT, ...(textBounds?.length ? { textBounds } : {}) };
}
function validatedTextBounds(blocks: unknown): OcrTextBounds[] | undefined {
 if (!Array.isArray(blocks)) return undefined;
 const frames = blocks.flatMap(block => {
  const frame = (block as { frame?: unknown } | null)?.frame as Partial<OcrTextBounds> | undefined;
  return frame && [frame.left, frame.top, frame.width, frame.height].every(value => typeof value === 'number' && Number.isFinite(value))
   && frame.width! > 0 && frame.height! > 0
   ? [{ left: frame.left!, top: frame.top!, width: frame.width!, height: frame.height! }] : [];
 });
 return frames.length ? frames : undefined;
}
export function validateCloudImage(image: string) {
 if (typeof image !== 'string' || !image) throw new OcrError('INVALID_INPUT');
 if (image.length > Math.ceil(OCR_IMAGE_BYTES/3)*4) throw new OcrError('IMAGE_TOO_LARGE');
 if (image.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image)) throw new OcrError('INVALID_INPUT');
 const size = image.length / 4 * 3 - (image.endsWith('==') ? 2 : image.endsWith('=') ? 1 : 0);
 if (size > OCR_IMAGE_BYTES) throw new OcrError('IMAGE_TOO_LARGE');
 if (!image.startsWith('/9j/') && !image.startsWith('iVBORw0KGgo')) throw new OcrError('INVALID_INPUT');
}
async function awaitRecognition<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
 checkAbort(signal);
 let cancel: () => void = () => {}; let timer: ReturnType<typeof setTimeout>;
 const stopped = new Promise<never>((_, reject) => {
  cancel = () => reject(new OcrError('CANCELED'));
  signal?.addEventListener('abort', cancel);
  timer = setTimeout(() => reject(new OcrError('PROVIDER_TIMEOUT')), 30000);
 });
 try { return await Promise.race([work, stopped]); }
 finally { clearTimeout(timer!); signal?.removeEventListener('abort', cancel); }
}
export async function recognizePageText(imagePath: string, options?: { languageHint?: OcrLanguageHint; signal?: AbortSignal; onNativeWork?: (work: Promise<unknown>) => void }): Promise<OcrResult> {
 const language = options?.languageHint ?? 'en'; checkAbort(options?.signal);
 if (language !== 'en') throw new OcrError('UNSUPPORTED_SCRIPT');
 if (Platform.OS === 'web') throw new OcrError('ON_DEVICE_UNAVAILABLE');
 let recognizer: { recognize: (path: string, script: string) => Promise<{ text: unknown; blocks?: unknown }> };
 try {
  // Lazy loading keeps unsupported surfaces usable. Installed 1.5.2 exports default.
  recognizer = require('@react-native-ml-kit/text-recognition').default;
  if (typeof recognizer?.recognize !== 'function') throw new Error();
 } catch { throw new OcrError('ON_DEVICE_UNAVAILABLE'); }
 let result: { text: unknown; blocks?: unknown };
 try {
  const work = recognizer.recognize(imagePath, 'Latin');
  // Cancellation stops adoption, not necessarily native computation. Keep transformed-image leases until actual settlement.
  options?.onNativeWork?.(work);
  result = await awaitRecognition(work, options?.signal);
 }
 catch (error) {
  checkAbort(options?.signal);
  if (error instanceof OcrError) throw error;
  const unavailable = error instanceof Error && /linked|NativeModule|not available/i.test(error.message);
  throw new OcrError(unavailable ? 'ON_DEVICE_UNAVAILABLE' : 'LOCAL_FAILED');
 }
 checkAbort(options?.signal);
 return boundedReview(result?.text, language, 'on-device', validatedTextBounds(result?.blocks));
}
export interface CloudOcrOptions { imageBase64: string; languageHint: OcrLanguageHint; requestId: string; consent: boolean; userId: string; signal?: AbortSignal }
export async function recognizePageViaCloud(options: CloudOcrOptions): Promise<OcrResult> {
 if (options.consent !== true) throw new OcrError('CONSENT_REQUIRED');
 const sameUser = () => useAuthStore.getState().status === 'authenticated' && useAuthStore.getState().session?.user.id === options.userId;
 if (!options.userId || !sameUser()) throw new OcrError('AUTH_REQUIRED');
 if (!['en', 'hi', 'kn', 'ml'].includes(options.languageHint) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(options.requestId)) throw new OcrError('INVALID_INPUT');
 validateCloudImage(options.imageBase64); checkAbort(options.signal);
 const controller = new AbortController(); let timedOut = false;
 const cancel = () => controller.abort(); options.signal?.addEventListener('abort', cancel);
 const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 30000);
 try {
  const { data, error } = await awaitRecognition(supabase.functions.invoke('ocr-fallback', {
   body: { version: 1, requestId: options.requestId, imageBase64: options.imageBase64, languageHint: options.languageHint }, signal: controller.signal,
  }), options.signal);
  checkAbort(options.signal); if (!sameUser()) throw new OcrError('CANCELED');
  if (timedOut) throw new OcrError('PROVIDER_TIMEOUT');
  let envelope = data;
  if (error) {
   // Only consume a small known error envelope, never propagate raw transport details.
   const context = (error as { context?: { clone?: () => { text: () => Promise<string> } } }).context;
   try { const text = await context?.clone?.().text(); if (text && text.length <= 1024) envelope = JSON.parse(text); } catch { /* safe generic error below */ }
  }
  const code = envelope?.error?.code;
  if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(messages, code)) throw new OcrError(code as OcrErrorCode);
  if (error) throw new OcrError('PROVIDER_UNAVAILABLE');
  if (envelope?.version !== 1 || envelope?.provider !== 'cloud' || envelope?.languageHint !== options.languageHint || typeof envelope?.reviewOverflow !== 'boolean') throw new OcrError('INVALID_RESPONSE');
  const result = boundedReview(envelope.reviewText, options.languageHint, 'cloud');
  if (result.reviewOverflow) throw new OcrError('INVALID_RESPONSE');
  return { ...result, reviewOverflow: envelope.reviewOverflow };
 } catch (error) {
  checkAbort(options.signal); if (!sameUser()) throw new OcrError('CANCELED');
  if (timedOut) throw new OcrError('PROVIDER_TIMEOUT');
  throw error instanceof OcrError ? error : new OcrError('PROVIDER_UNAVAILABLE');
 } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', cancel); }
}
export const ocrService = { recognizePageText, recognizePageViaCloud };
