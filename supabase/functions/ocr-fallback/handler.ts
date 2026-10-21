export interface OcrDependencies {
 authenticate: (jwt: string, signal: AbortSignal) => Promise<string | null>;
 visionKey?: string;
 fetch: typeof fetch;
 // No in-memory quota substitute. Deployment must provide a reviewed durable adapter.
 reserveQuota?: (userId: string, requestId: string) => Promise<boolean>;
}
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const failure = (status: number, code: string) => response(status, { error: { code } });
class InputFailure extends Error { constructor(public status: number, public code: string) { super(code); } }
async function readLimited(source: Request | Response, limit: number): Promise<string> {
 const declared = source.headers.get('content-length');
 if (declared && Number(declared) > limit) throw new InputFailure(413, 'IMAGE_TOO_LARGE');
 const reader = source.body?.getReader?.();
 if (!reader) {
  // Compatibility for the Node test transport; Edge Request/Response use streams.
  const buffer = await source.arrayBuffer();
  if (buffer.byteLength > limit) throw new InputFailure(413, 'IMAGE_TOO_LARGE');
  return new TextDecoder().decode(buffer);
 }
 const chunks: Uint8Array[] = []; let length = 0;
 try {
  while (true) {
   const { done, value } = await reader.read(); if (done) break;
   length += value.byteLength;
   if (length > limit) { await reader.cancel(); throw new InputFailure(413, 'IMAGE_TOO_LARGE'); }
   chunks.push(value);
  }
 } finally { reader.releaseLock(); }
 const bytes = new Uint8Array(length); let offset = 0;
 for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
 return new TextDecoder().decode(bytes);
}
function input(value: unknown) {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputFailure(400, 'INVALID_INPUT');
 const b = value as Record<string, unknown>;
 if (Object.keys(b).some(k => !['version', 'requestId', 'imageBase64', 'languageHint'].includes(k)) || b.version !== 1 || typeof b.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.requestId) || !['en','hi','kn','ml'].includes(b.languageHint as string) || typeof b.imageBase64 !== 'string') throw new InputFailure(400, 'INVALID_INPUT');
 const image = b.imageBase64;
 if (image.length > Math.ceil(2*1024*1024/3)*4) throw new InputFailure(413, 'IMAGE_TOO_LARGE');
 if (!image || image.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image)) throw new InputFailure(400, 'INVALID_INPUT');
 const size = image.length / 4 * 3 - (image.endsWith('==') ? 2 : image.endsWith('=') ? 1 : 0);
 if (size > 2*1024*1024) throw new InputFailure(413, 'IMAGE_TOO_LARGE');
 if (!image.startsWith('/9j/') && !image.startsWith('iVBORw0KGgo')) throw new InputFailure(400, 'INVALID_INPUT');
 return { imageBase64: image, requestId: b.requestId, languageHint: b.languageHint as string };
}
export function createOcrHandler(deps: OcrDependencies) {
 return async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return failure(405, 'INVALID_INPUT');
  const auth = req.headers.get('authorization');
  if (!auth || !/^Bearer \S+$/i.test(auth)) return failure(401, 'AUTH_REQUIRED');
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return failure(400, 'INVALID_INPUT');
  const controller = new AbortController(); const cancel = () => controller.abort(); req.signal?.addEventListener('abort', cancel);
  let timeout: ReturnType<typeof setTimeout>;
  const deadline = new Promise<Response>(resolve => { timeout = setTimeout(() => { controller.abort(); resolve(failure(504, 'PROVIDER_TIMEOUT')); }, 30000); });
  const work = async (): Promise<Response> => {
   try {
    let body: unknown;
    try { body = JSON.parse(await readLimited(req, 3*1024*1024)); }
    catch (e) { if (e instanceof InputFailure) throw e; return failure(400, 'INVALID_INPUT'); }
    const parsed = input(body);
    const userId = await deps.authenticate(auth.slice(7), controller.signal);
    if (!userId) return failure(401, 'AUTH_REQUIRED');
    if (controller.signal.aborted) return failure(504, 'PROVIDER_TIMEOUT');
    if (!deps.visionKey || !deps.reserveQuota) return failure(503, 'CLOUD_DISABLED');
    if (!await deps.reserveQuota(userId, parsed.requestId)) return failure(429, 'QUOTA_EXCEEDED');
    if (controller.signal.aborted) return failure(504, 'PROVIDER_TIMEOUT');
    const upstream = await deps.fetch('https://vision.googleapis.com/v1/images:annotate', {
     method: 'POST', signal: controller.signal,
     headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': deps.visionKey },
     body: JSON.stringify({ requests: [{ image: { content: parsed.imageBase64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], imageContext: { languageHints: [parsed.languageHint] } }] }),
    });
    if (!upstream.ok) return failure(502, 'PROVIDER_UNAVAILABLE');
    let decoded: any;
    try { decoded = JSON.parse(await readLimited(upstream, 1024*1024)); }
    catch { return failure(502, 'INVALID_RESPONSE'); }
    const item = decoded?.responses?.[0];
    if (!item || item.error) return failure(502, 'PROVIDER_UNAVAILABLE');
    const text = item.fullTextAnnotation?.text;
    if (text === undefined || text === '') return failure(422, 'NO_TEXT');
    if (typeof text !== 'string') return failure(502, 'INVALID_RESPONSE');
    if (!text.trim()) return failure(422, 'NO_TEXT');
    const points = Array.from(text);
    return response(200, { version: 1, provider: 'cloud', languageHint: parsed.languageHint, reviewText: points.slice(0,20000).join(''), reviewOverflow: points.length > 20000 });
   } catch (e) {
    if (e instanceof InputFailure) return failure(e.status, e.code);
    return failure(controller.signal.aborted ? 504 : 502, controller.signal.aborted ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE');
   }
  };
  try { return await Promise.race([work(), deadline]); }
  finally { clearTimeout(timeout!); controller.abort(); req.signal?.removeEventListener('abort', cancel); }
 };
}
