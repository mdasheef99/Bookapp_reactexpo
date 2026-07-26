import { createHash, timingSafeEqual } from 'node:crypto';
import { IncomingHttpHeaders, IncomingMessage } from 'node:http';

export function validWorkerCredential(
  headers: IncomingHttpHeaders,
  expected: string,
): boolean {
  const supplied = typeof headers.authorization === 'string' ? headers.authorization : '';
  const expectedHeader = `Bearer ${expected}`;
  const left = createHash('sha256').update(supplied).digest();
  const right = createHash('sha256').update(expectedHeader).digest();
  return supplied.length === expectedHeader.length && timingSafeEqual(left, right);
}

export function readBoundedBody(
  request: IncomingMessage,
  limit: number,
  timeoutMs: number,
): Promise<Uint8Array> {
  const declared = Number(request.headers['content-length'] ?? 0);
  if (Number.isFinite(declared) && declared > limit) throw new Error('body_too_large');
  return new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
      request.off('aborted', onAborted);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onData = (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += bytes.byteLength;
      if (length > limit) {
        request.pause();
        fail(new Error('body_too_large'));
      } else chunks.push(bytes);
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks));
    };
    const onError = () => fail(new Error('request_aborted'));
    const onAborted = () => fail(new Error('request_aborted'));
    const timer = setTimeout(() => {
      request.pause();
      fail(new Error('body_read_timeout'));
    }, timeoutMs);
    timer.unref();
    request.on('data', onData);
    request.once('end', onEnd);
    request.once('error', onError);
    request.once('aborted', onAborted);
  });
}
