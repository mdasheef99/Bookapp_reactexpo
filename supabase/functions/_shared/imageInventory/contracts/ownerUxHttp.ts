import { ownerUxErrorFromException } from './ownerUxErrors.ts';

export const OWNER_UX_HTTP_HEADERS = Object.freeze({
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'cache-control': 'no-store',
  pragma: 'no-cache',
});

export function ownerUxJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: OWNER_UX_HTTP_HEADERS,
  });
}

export function ownerUxFailureResponse(error: unknown): Response {
  const safe = ownerUxErrorFromException(error);
  return ownerUxJsonResponse(safe.body, safe.status);
}
