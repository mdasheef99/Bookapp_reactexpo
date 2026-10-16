/** @jest-environment node */
import {
  __capturedServeHandlers, __recordedCalls, __resetBetweenTests,
  __scriptEdgeResults, __setEdgeEnv,
} from './support/edgeFunctionHttpStubs';
import * as ownerEdge from '../phase9-owner-ingestion/index';
import { editionChoices, editionReadRequest, editionUuid } from './fixtures/phase9/editionPickerContracts';

const authorization = 'Bearer synthetic-owner-token';
const marker = 'bookconnect/edition-reasons-v1';
beforeEach(() => {
  __resetBetweenTests();
  __setEdgeEnv({ SUPABASE_URL: 'https://edition-fixture.supabase.co',
    SUPABASE_ANON_KEY: 'synthetic-anon-key', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key' });
  __scriptEdgeResults({ auth: { user: { id: editionUuid(90) } }, rpc: { data: editionChoices, error: null } });
});
async function request(clientInfo: string | null, body: unknown = editionReadRequest, authenticated = true) {
  expect(ownerEdge).toBeDefined();
  const handlers = __capturedServeHandlers(); expect(handlers).toHaveLength(1);
  return handlers[0](new Request('https://edition-fixture.test/functions/v1/phase9-owner-ingestion', {
    method: 'POST', headers: { 'content-type': 'application/json',
      ...(authenticated ? { authorization } : {}), ...(clientInfo ? { 'x-client-info': clientInfo } : {}) },
    body: JSON.stringify(body),
  }));
}
it('forwards the exact display capability on the authenticated caller client, never the service client', async () => {
  const data = { ...editionChoices, rows: editionChoices.rows.map(row => ({ ...row,
    eligibility: 'ineligible', rejectionReason: 'author_differs' })) };
  __scriptEdgeResults({ auth: { user: { id: editionUuid(90) } }, rpc: { data, error: null } });
  const response = await request(marker);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data });
  const clients = __recordedCalls().filter(call => call.kind === 'createClient');
  expect(clients[1]).toMatchObject({ key: 'synthetic-anon-key', options: {
    global: { headers: { Authorization: authorization, 'X-Client-Info': marker } }, auth: { persistSession: false },
  } });
  expect(clients[2]).toMatchObject({ key: 'synthetic-service-key', options: { auth: { persistSession: false } } });
  expect((clients[2] as { options: unknown }).options).not.toHaveProperty('global');
  expect(__recordedCalls().filter(call => call.kind === 'rpc')).toEqual([{ kind: 'rpc',
    key: 'synthetic-anon-key', name: 'phase9_owner_candidate_edition_choices_v1',
    args: { p_session_id: editionReadRequest.sessionId, p_candidate_id: editionReadRequest.candidateId } }]);
});
it.each([null, 'supabase-js-web/2', marker + ', other'])('keeps legacy/unsupported %s reads compatible', async clientInfo => {
  const response = await request(clientInfo);
  expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ data: editionChoices });
  const clients = __recordedCalls().filter(call => call.kind === 'createClient');
  expect(clients[1]).toMatchObject({ options: { global: { headers: { Authorization: authorization } } } });
  expect((clients[1] as { options: { global: { headers: unknown } } }).options.global.headers).not.toHaveProperty('X-Client-Info');
});
it('the capability alone cannot authenticate or issue an owned RPC', async () => {
  const response = await request(marker, editionReadRequest, false);
  expect(response.status).not.toBe(200);
  expect(__recordedCalls().filter(call => call.kind === 'rpc')).toHaveLength(0);
});
it('the capability cannot admit client-supplied store authority', async () => {
  const response = await request(marker, { ...editionReadRequest, storeId: editionUuid(91) });
  expect(response.status).toBe(400);
  expect(__recordedCalls().filter(call => call.kind === 'rpc')).toHaveLength(0);
});
it('uses the existing CORS allowance without starting authentication or a provider lookup', async () => {
  const handler = __capturedServeHandlers()[0];
  const response = await handler(new Request('https://edition-fixture.test', { method: 'OPTIONS' }));
  expect(response.status).toBe(200);
  expect(response.headers.get('access-control-allow-headers')).toContain('x-client-info');
  expect(__recordedCalls()).toHaveLength(0);
});
