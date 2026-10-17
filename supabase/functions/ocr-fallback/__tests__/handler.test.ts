import { createOcrHandler } from '../handler';
const web = require('node-fetch');
Object.assign(globalThis, { Request: web.Request, Response: web.Response, Headers: web.Headers });
const base = { version: 1, requestId: '92000000-0000-4000-8000-000000000001', imageBase64: '/9j/AAAA', languageHint: 'en' };
const request = (body: unknown = base, auth = 'Bearer token') => new web.Request('https://example.test/ocr', { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const deps = () => ({ authenticate: jest.fn(async () => 'user-a'), visionKey: 'test-only', fetch: jest.fn(async () => new web.Response(JSON.stringify({ responses: [{ fullTextAnnotation: { text: 'recognized passage' } }] }))), reserveQuota: jest.fn(async () => true) });
it('accepts the real Google sample JPEG but blocks cloud without quota provision', async () => {
 const fs = require('fs');
 const imageBase64 = fs.readFileSync('docs/user/library/ocr-evidence-20261006/google-ocr-sign.jpg').toString('base64');
 const d = deps(); const r = await createOcrHandler({ ...d, reserveQuota: undefined })(request({ ...base, imageBase64 }));
 expect(r.status).toBe(503); expect(await r.json()).toEqual({ error: { code: 'CLOUD_DISABLED' } });
 expect(d.authenticate).toHaveBeenCalled(); expect(d.fetch).not.toHaveBeenCalled();
});
it('times out a stalled provider without retry or leaking content', async () => {
 jest.useFakeTimers();
 try {
  const d = deps(); d.fetch.mockImplementation(() => new Promise(() => {}));
  const task = createOcrHandler(d)(request());
  await jest.advanceTimersByTimeAsync(30001);
  const r = await task; expect(r.status).toBe(504); expect(await r.json()).toEqual({ error: { code: 'PROVIDER_TIMEOUT' } });
  expect(d.fetch).toHaveBeenCalledTimes(1);
 } finally { jest.useRealTimers(); }
});
it('rejects an oversized provider body rather than returning a partial result', async () => {
 const d = deps(); d.fetch.mockResolvedValue(new web.Response('x'.repeat(1024*1024+1)));
 const r = await createOcrHandler(d)(request()); expect(r.status).toBe(502); expect(await r.json()).toEqual({ error: { code: 'INVALID_RESPONSE' } });
});
it('denies missing/invalid user before egress', async () => {
 const d = deps(); d.authenticate.mockResolvedValue(null as any); const r = await createOcrHandler(d)(request());
 expect(r.status).toBe(401); expect(d.fetch).not.toHaveBeenCalled(); expect(d.reserveQuota).not.toHaveBeenCalled();
});
it('fails closed without a durable quota adapter', async () => {
 const d = deps(); const r = await createOcrHandler({ ...d, reserveQuota: undefined })(request());
 expect(r.status).toBe(503); expect(await r.json()).toEqual({ error: { code: 'CLOUD_DISABLED' } }); expect(d.fetch).not.toHaveBeenCalled();
});
it('rejects invalid image and unknown fields before quota', async () => {
 const d = deps(); const r = await createOcrHandler(d)(request({ ...base, imageBase64: 'bad', userId: 'forged' }));
 expect(r.status).toBe(400); expect(d.reserveQuota).not.toHaveBeenCalled(); expect(d.fetch).not.toHaveBeenCalled();
});
it('uses verified identity and reserves before DOCUMENT_TEXT_DETECTION', async () => {
 const d = deps(); const r = await createOcrHandler(d)(request()); expect(r.status).toBe(200);
 expect(d.reserveQuota).toHaveBeenCalledWith('user-a', base.requestId);
 const payload = JSON.parse((d.fetch.mock.calls as any)[0][1].body);
 expect(payload.requests[0].features).toEqual([{ type: 'DOCUMENT_TEXT_DETECTION' }]);
 expect(await r.json()).toMatchObject({ version: 1, provider: 'cloud', reviewText: 'recognized passage', reviewOverflow: false });
});
it('rejects exhausted quota without provider egress', async () => {
 const d = deps(); d.reserveQuota.mockResolvedValue(false); const r = await createOcrHandler(d)(request());
 expect(r.status).toBe(429); expect(d.fetch).not.toHaveBeenCalled();
});
it('sanitizes provider application-level error returned with HTTP 200', async () => {
 const d = deps(); d.fetch.mockResolvedValue(new web.Response(JSON.stringify({ responses: [{ error: { message: 'secret content' } }] })));
 const r = await createOcrHandler(d)(request()); expect(r.status).toBe(502); expect(await r.text()).not.toContain('secret');
});
it('does not silently truncate to 500 words', async () => {
 const d = deps(); const text = Array(600).fill('word').join(' '); d.fetch.mockResolvedValue(new web.Response(JSON.stringify({ responses: [{ fullTextAnnotation: { text } }] })));
 const r = await createOcrHandler(d)(request()); expect((await r.json()).reviewText).toBe(text);
});
it('caps Unicode review with an overflow flag', async () => {
 const d = deps(); d.fetch.mockResolvedValue(new web.Response(JSON.stringify({ responses: [{ fullTextAnnotation: { text: '😀'.repeat(20001) } }] })));
 const r = await createOcrHandler(d)(request()); const body = await r.json(); expect(Array.from(body.reviewText)).toHaveLength(20000); expect(body.reviewOverflow).toBe(true);
});
it('rejects oversized body before identity/quota', async () => {
 const d = deps(); const r = await createOcrHandler(d)(request({ ...base, imageBase64: 'A'.repeat(3*1024*1024) }));
 expect(r.status).toBe(413); expect(d.authenticate).not.toHaveBeenCalled(); expect(d.fetch).not.toHaveBeenCalled();
});
it('rejects empty output and non-POST safely', async () => {
 const d = deps(); d.fetch.mockResolvedValue(new web.Response(JSON.stringify({ responses: [{}] })));
 expect((await createOcrHandler(d)(request())).status).toBe(422);
 expect((await createOcrHandler(d)(new web.Request('https://example.test/ocr'))).status).toBe(405);
});
