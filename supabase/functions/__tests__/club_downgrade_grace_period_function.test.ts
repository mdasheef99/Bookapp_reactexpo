/**
 * @jest-environment node
 */
import {
  __capturedServeHandlers,
  __recordedCalls,
  __resetBetweenTests,
  __scriptEdgeResults,
  __setEdgeEnv,
  type EdgeRecordedCall,
} from './support/edgeFunctionHttpStubs';
import * as handleClubDowngradeGracePeriod from '../handle-club-downgrade-grace-period/index';

const SUPABASE_URL = 'https://clubs-edge-test.supabase.co';
const SERVICE_KEY = 'test-service-role-key';
const CRON_SECRET = 'synthetic-cron-secret-value';
const USER_A = '11111111-1111-4111-8111-111111111111';

type CreateClientRecord = Extract<EdgeRecordedCall, { kind: 'createClient' }>;
type RpcRecord = Extract<EdgeRecordedCall, { kind: 'rpc' }>;

function baseEnv(): Record<string, string> {
  return { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY };
}

function envWithSecret(): Record<string, string> {
  return { ...baseEnv(), CLUB_DOWNGRADE_CRON_SECRET: CRON_SECRET };
}

function handler(): (req: Request) => Promise<Response> {
  expect(handleClubDowngradeGracePeriod).toBeDefined();
  const handlers = __capturedServeHandlers();
  expect(handlers).toHaveLength(1);
  return handlers[0];
}

async function invokeEdge(
  method: string,
  init?: { headers?: Record<string, string>; body?: unknown; rawBody?: string },
): Promise<Response> {
  const request = new Request('https://edge.test/functions/v1/handle-club-downgrade-grace-period', {
    method,
    headers: init?.headers,
    body: init?.rawBody ?? (init?.body === undefined ? undefined : JSON.stringify(init.body)),
  });
  return handler()(request);
}

function createClientCalls(): CreateClientRecord[] {
  return __recordedCalls().filter(
    (record): record is CreateClientRecord => record.kind === 'createClient',
  );
}

function rpcCalls(): RpcRecord[] {
  return __recordedCalls().filter((record): record is RpcRecord => record.kind === 'rpc');
}

describe('handle-club-downgrade-grace-period Edge Function (real handler)', () => {
  beforeEach(() => {
    __resetBetweenTests();
    __setEdgeEnv(baseEnv());
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('OPTIONS returns 200 ok including x-cron-secret in the allowed headers', async () => {
    const response = await invokeEdge('OPTIONS');

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('ok');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const allowHeaders = response.headers.get('Access-Control-Allow-Headers') ?? '';
    expect(allowHeaders).toContain('authorization');
    expect(allowHeaders).toContain('x-client-info');
    expect(allowHeaders).toContain('apikey');
    expect(allowHeaders).toContain('content-type');
    expect(allowHeaders).toContain('x-cron-secret');
  });

  it('rejects a representative non-POST method 405 before any environment or client work', async () => {
    const response = await invokeEdge('GET');

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({ error: 'Method not allowed' });
    expect(createClientCalls()).toHaveLength(0);
    expect(rpcCalls()).toHaveLength(0);
  });

  it('returns 500 naming a missing SUPABASE_URL without creating a client or calling RPC', async () => {
    const { SUPABASE_URL: _omitted, ...partialEnv } = baseEnv();
    __setEdgeEnv(partialEnv);

    const response = await invokeEdge('POST', { body: {} });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain('Missing required env vars');
    expect(body.error).toContain('SUPABASE_URL');
    expect(createClientCalls()).toHaveLength(0);
    expect(rpcCalls()).toHaveLength(0);
  });

  it('returns 500 naming a missing SUPABASE_SERVICE_ROLE_KEY without calling RPC', async () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _omitted, ...partialEnv } = baseEnv();
    __setEdgeEnv(partialEnv);

    const response = await invokeEdge('POST', { body: {} });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain('Missing required env vars');
    expect(body.error).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(rpcCalls()).toHaveLength(0);
  });

  describe('with CLUB_DOWNGRADE_CRON_SECRET configured (P0 gate)', () => {
    beforeEach(() => {
      __setEdgeEnv(envWithSecret());
      __scriptEdgeResults({ rpc: { data: [], error: null } });
    });

    it('rejects a missing x-cron-secret 403 without creating a client or calling RPC', async () => {
      const response = await invokeEdge('POST', { body: {} });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
      expect(createClientCalls()).toHaveLength(0);
      expect(rpcCalls()).toHaveLength(0);
    });

    it('rejects a wrong x-cron-secret 403 without creating a client or calling RPC', async () => {
      const response = await invokeEdge('POST', {
        headers: { 'x-cron-secret': 'definitely-not-the-secret' },
        body: {},
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
      expect(createClientCalls()).toHaveLength(0);
      expect(rpcCalls()).toHaveLength(0);
    });

    it('proceeds to the RPC with the correct x-cron-secret', async () => {
      const response = await invokeEdge('POST', {
        headers: { 'x-cron-secret': CRON_SECRET },
        body: {},
      });

      expect(response.status).toBe(200);
      const calls = rpcCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('process_club_downgrade_grace_period');
      expect(calls[0].args).toEqual({ p_user_id: null, p_grace_days: 14, p_dry_run: false });
      expect(calls[0].key).toBe(SERVICE_KEY);
    });
  });

  describe('default RPC semantics (secret unset as fixture setup; DEF-1 optional-secret policy review remains deferred)', () => {
    it('invokes the exact RPC with default null/14/false arguments for an empty body', async () => {
      const response = await invokeEdge('POST', { body: {} });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ processed: 0, results: [] });

      const calls = rpcCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('process_club_downgrade_grace_period');
      expect(calls[0].args).toEqual({ p_user_id: null, p_grace_days: 14, p_dry_run: false });

      const clients = createClientCalls();
      expect(clients).toHaveLength(1);
      expect(clients[0].key).toBe(SERVICE_KEY);
      expect(clients[0].options).toEqual({ auth: { persistSession: false } });
    });

    it('forwards an explicit user_id unchanged without normalization', async () => {
      const response = await invokeEdge('POST', { body: { user_id: USER_A } });

      expect(response.status).toBe(200);
      const calls = rpcCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].args).toMatchObject({ p_user_id: USER_A });
    });

    it.each([
      [1, 1],
      [90, 90],
      [0, 14],
      [91, 14],
      ['abc', 14],
      ['14', 14],
    ])('parses grace_days %p to p_grace_days %p', async (input, expected) => {
      await invokeEdge('POST', { body: { grace_days: input } });

      const calls = rpcCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].args).toMatchObject({ p_grace_days: expected });
    });

    it.each([
      [true, true],
      ['true', true],
      [false, false],
      ['false', false],
      [1, false],
      [undefined, false],
    ])('parses dry_run %p to p_dry_run %p', async (input, expected) => {
      const body: Record<string, unknown> = {};
      if (input !== undefined) body.dry_run = input;

      await invokeEdge('POST', { body });

      const calls = rpcCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].args).toMatchObject({ p_dry_run: expected });
    });

    it('wraps returned rows unchanged as processed/results', async () => {
      const rows = [
        { user_id: 'aaaa1111-1111-4111-8111-111111111111', archived_club_ids: ['c1'] },
        { user_id: 'bbbb2222-2222-4222-8222-222222222222', archived_club_ids: ['c2', 'c3'] },
      ];
      __scriptEdgeResults({ rpc: { data: rows, error: null } });

      const response = await invokeEdge('POST', { body: {} });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ processed: 2, results: rows });
    });

    it('maps an empty RPC data array to processed 0 with empty results', async () => {
      __scriptEdgeResults({ rpc: { data: [], error: null } });

      const response = await invokeEdge('POST', { body: {} });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ processed: 0, results: [] });
    });

    it('maps an RPC error to a 400 error body and never a 200 success', async () => {
      __scriptEdgeResults({ rpc: { error: { message: 'synthetic rpc failure' } } });

      const response = await invokeEdge('POST', { body: {} });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(typeof body.error).toBe('string');
      expect(body.error.length).toBeGreaterThan(0);
      expect(body.processed).toBeUndefined();
    });

    it('maps an unexpected RPC rejection to 500 with the generic internal error', async () => {
      __scriptEdgeResults({ rpc: { reject: new Error('synthetic unexpected failure') } });

      const response = await invokeEdge('POST', { body: {} });

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: 'Internal server error' });
    });

    it('falls back to default RPC arguments for a malformed JSON body', async () => {
      const response = await invokeEdge('POST', { rawBody: '{not-json' });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ processed: 0, results: [] });

      const calls = rpcCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].args).toEqual({ p_user_id: null, p_grace_days: 14, p_dry_run: false });
    });
  });
});
