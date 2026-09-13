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
import * as checkMembershipLimits from '../check-membership-limits/index';

const SUPABASE_URL = 'https://clubs-edge-test.supabase.co';
const ANON_KEY = 'test-anon-key';
const SERVICE_KEY = 'test-service-role-key';
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const AUTH_HEADER = 'Bearer synthetic-access-token';

type TableRecord = Extract<EdgeRecordedCall, { kind: 'table' }>;
type CreateClientRecord = Extract<EdgeRecordedCall, { kind: 'createClient' }>;
type AuthRecord = Extract<EdgeRecordedCall, { kind: 'auth.getUser' }>;

function standardEnv(): Record<string, string> {
  return {
    SUPABASE_URL,
    SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  };
}

function handler(): (req: Request) => Promise<Response> {
  expect(checkMembershipLimits).toBeDefined();
  const handlers = __capturedServeHandlers();
  expect(handlers).toHaveLength(1);
  return handlers[0];
}

async function invokeEdge(
  method: string,
  init?: { headers?: Record<string, string>; body?: unknown; rawBody?: string },
): Promise<Response> {
  const request = new Request('https://edge.test/functions/v1/check-membership-limits', {
    method,
    headers: init?.headers,
    body: init?.rawBody ?? (init?.body === undefined ? undefined : JSON.stringify(init.body)),
  });
  return handler()(request);
}

function scriptSelfCheck(params: { tier: string | null; count: number }): void {
  __scriptEdgeResults({
    auth: { user: { id: USER_A } },
    tables: {
      user_profiles: {
        data: params.tier === null ? null : { membership_tier: params.tier },
        error: null,
      },
      book_clubs: { data: null, count: params.count, error: null },
    },
  });
}

function recordsOfKind(kind: EdgeRecordedCall['kind']): EdgeRecordedCall[] {
  return __recordedCalls().filter((record) => record.kind === kind);
}

function tableCalls(): TableRecord[] {
  return __recordedCalls().filter(
    (record): record is TableRecord => record.kind === 'table',
  );
}

function createClientCalls(): CreateClientRecord[] {
  return __recordedCalls().filter(
    (record): record is CreateClientRecord => record.kind === 'createClient',
  );
}

describe('check-membership-limits Edge Function (real handler)', () => {
  beforeEach(() => {
    __resetBetweenTests();
    __setEdgeEnv(standardEnv());
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('OPTIONS returns 200 ok with the permissive CORS contract', async () => {
    const response = await invokeEdge('OPTIONS');

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('ok');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const allowHeaders = response.headers.get('Access-Control-Allow-Headers') ?? '';
    expect(allowHeaders).toContain('authorization');
    expect(allowHeaders).toContain('x-client-info');
    expect(allowHeaders).toContain('apikey');
    expect(allowHeaders).toContain('content-type');
  });

  it('self-request happy path returns the entitlement payload and performs auth plus privileged reads', async () => {
    scriptSelfCheck({ tier: 'pro', count: 4 });

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/json' },
      body: { user_id: USER_A, action: 'create_club' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({
      allowed: true,
      current_count: 4,
      max_allowed: 5,
      tier: 'pro',
      reason: null,
    });

    const authCalls = recordsOfKind('auth.getUser') as AuthRecord[];
    expect(authCalls).toHaveLength(1);
    expect(authCalls[0].key).toBe(ANON_KEY);

    const clients = createClientCalls();
    expect(clients).toHaveLength(2);
    expect(clients[0].key).toBe(ANON_KEY);
    expect(clients[0].options).toEqual({
      global: { headers: { Authorization: AUTH_HEADER } },
    });
    expect(clients[1].key).toBe(SERVICE_KEY);
    expect(clients[1].options).toEqual({ auth: { persistSession: false } });
  });

  it('denies a cross-user request 403 before any privileged database access', async () => {
    scriptSelfCheck({ tier: 'pro', count: 0 });

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_B, action: 'create_club' },
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(typeof body.error).toBe('string');
    expect(body.error).toContain('Forbidden');

    expect(tableCalls()).toHaveLength(0);
    expect(recordsOfKind('rpc')).toHaveLength(0);
    const clients = createClientCalls();
    expect(clients).toHaveLength(1);
    expect(clients[0].key).toBe(ANON_KEY);
  });

  it('rejects a missing Authorization header 401 before constructing any Supabase client', async () => {
    const response = await invokeEdge('POST', {
      body: { user_id: USER_A, action: 'create_club' },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing Authorization header',
    });
    expect(createClientCalls()).toHaveLength(0);
    expect(tableCalls()).toHaveLength(0);
  });

  it('rejects an invalid or expired JWT 401 without privileged database access', async () => {
    __scriptEdgeResults({ auth: { error: { message: 'JWT expired' } } });

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A, action: 'create_club' },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Unauthorized: invalid or expired token',
    });
    expect(tableCalls()).toHaveLength(0);
    expect(recordsOfKind('auth.getUser')).toHaveLength(1);
  });

  it('rejects an invalid user_id 400 with no client construction or database access', async () => {
    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: 'not-a-uuid', action: 'create_club' },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Valid user_id is required',
    });
    expect(createClientCalls()).toHaveLength(0);
    expect(tableCalls()).toHaveLength(0);
  });

  it('rejects an unknown action 400 with no client construction or database access', async () => {
    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A, action: 'delete_world' },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'action must be create_club or check_downgrade',
    });
    expect(createClientCalls()).toHaveLength(0);
    expect(tableCalls()).toHaveLength(0);
  });

  it('defaults a missing action to create_club (pro user at cap is denied)', async () => {
    scriptSelfCheck({ tier: 'pro', count: 5 });

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.allowed).toBe(false);
    expect(body.max_allowed).toBe(5);
    expect(body.reason).toBe('Membership tier pro already reached its 5-club limit.');
  });

  it('denies free tier create_club at zero clubs with the upgrade reason', async () => {
    scriptSelfCheck({ tier: 'free', count: 0 });

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A, action: 'create_club' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      allowed: false,
      current_count: 0,
      max_allowed: 0,
      tier: 'free',
      reason: 'Free members cannot create clubs. Upgrade to Pro to create a club.',
    });
  });

  it('allows pro create_club below the cap (4 of 5)', async () => {
    scriptSelfCheck({ tier: 'pro', count: 4 });

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A, action: 'create_club' },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ allowed: true, current_count: 4, max_allowed: 5, tier: 'pro' });
    expect(body.reason).toBeNull();
  });

  it('denies pro create_club at the cap (5 of 5)', async () => {
    scriptSelfCheck({ tier: 'pro', count: 5 });

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A, action: 'create_club' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      allowed: false,
      current_count: 5,
      max_allowed: 5,
      tier: 'pro',
      reason: 'Membership tier pro already reached its 5-club limit.',
    });
  });

  it('allows pro_plus create_club below the cap (14 of 15)', async () => {
    scriptSelfCheck({ tier: 'pro_plus', count: 14 });

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A, action: 'create_club' },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      allowed: true,
      current_count: 14,
      max_allowed: 15,
      tier: 'pro_plus',
    });
    expect(body.reason).toBeNull();
  });

  it('denies pro_plus create_club at the cap (15 of 15)', async () => {
    scriptSelfCheck({ tier: 'pro_plus', count: 15 });

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A, action: 'create_club' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      allowed: false,
      current_count: 15,
      max_allowed: 15,
      tier: 'pro_plus',
      reason: 'Membership tier pro_plus already reached its 15-club limit.',
    });
  });

  it('treats an unknown tier value as free', async () => {
    scriptSelfCheck({ tier: 'gold', count: 0 });

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A, action: 'create_club' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      allowed: false,
      current_count: 0,
      max_allowed: 0,
      tier: 'free',
      reason: 'Free members cannot create clubs. Upgrade to Pro to create a club.',
    });
  });

  it('treats a missing profile row as free', async () => {
    scriptSelfCheck({ tier: null, count: 0 });

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A, action: 'create_club' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      allowed: false,
      current_count: 0,
      max_allowed: 0,
      tier: 'free',
      reason: 'Free members cannot create clubs. Upgrade to Pro to create a club.',
    });
  });

  it('allows check_downgrade exactly at the cap (5 of 5, <= semantics)', async () => {
    scriptSelfCheck({ tier: 'pro', count: 5 });

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A, action: 'check_downgrade' },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      allowed: true,
      current_count: 5,
      max_allowed: 5,
      tier: 'pro',
      reason: null,
    });
  });

  it('denies check_downgrade above the cap (6 of 5)', async () => {
    scriptSelfCheck({ tier: 'pro', count: 6 });

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A, action: 'check_downgrade' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      allowed: false,
      current_count: 6,
      max_allowed: 5,
      tier: 'pro',
      reason: 'Membership tier pro allows 5 active club(s), but user currently has 6.',
    });
  });

  it('issues the pinned privileged query shape against the service-role client', async () => {
    scriptSelfCheck({ tier: 'pro', count: 4 });

    await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A, action: 'create_club' },
    });

    const calls = tableCalls();
    expect(calls).toHaveLength(2);

    const profileCall = calls.find((call) => call.table === 'user_profiles');
    expect(profileCall).toBeDefined();
    expect(profileCall!.key).toBe(SERVICE_KEY);
    expect(profileCall!.select).toEqual({ arg: 'membership_tier', options: null });
    expect(profileCall!.filters).toEqual([{ op: 'eq', args: ['user_id', USER_A] }]);
    expect(profileCall!.awaitedAs).toBe('maybeSingle');

    const clubsCall = calls.find((call) => call.table === 'book_clubs');
    expect(clubsCall).toBeDefined();
    expect(clubsCall!.key).toBe(SERVICE_KEY);
    expect(clubsCall!.select).toEqual({
      arg: '*',
      options: { count: 'exact', head: true },
    });
    expect(clubsCall!.filters).toEqual([
      { op: 'eq', args: ['admin_id', USER_A] },
      { op: 'or', args: ['is_archived.is.false,is_archived.is.null'] },
    ]);
    expect(clubsCall!.awaitedAs).toBe('implicit');
  });

  it('maps a profile query failure to a 400 error body without allowed=true', async () => {
    __scriptEdgeResults({
      auth: { user: { id: USER_A } },
      tables: { user_profiles: { error: { message: 'synthetic profile failure' } } },
    });

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A, action: 'create_club' },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
    expect(body.allowed).toBeUndefined();
  });

  it('maps a club-count query failure to a 400 error body without allowed=true', async () => {
    __scriptEdgeResults({
      auth: { user: { id: USER_A } },
      tables: {
        user_profiles: { data: { membership_tier: 'pro' }, error: null },
        book_clubs: { error: { message: 'synthetic count failure' } },
      },
    });

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A, action: 'create_club' },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
    expect(body.allowed).toBeUndefined();
  });

  it('returns 500 naming the missing required environment variable', async () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _omitted, ...partialEnv } = standardEnv();
    __setEdgeEnv(partialEnv);

    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      body: { user_id: USER_A, action: 'create_club' },
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain('Missing required env vars');
    expect(body.error).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(createClientCalls()).toHaveLength(0);
  });

  it('rejects a malformed JSON body 400 before any client construction', async () => {
    const response = await invokeEdge('POST', {
      headers: { Authorization: AUTH_HEADER },
      rawBody: '{{{',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid JSON body',
    });
    expect(createClientCalls()).toHaveLength(0);
    expect(tableCalls()).toHaveLength(0);
  });
});
