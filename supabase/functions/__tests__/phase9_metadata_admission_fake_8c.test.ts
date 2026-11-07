// Unit 2 (8c) D-b: the shared fake must refuse protected unadmitted registrations
// whenever the attempt binding is known, and skip only truly unknown bindings.
import { metadataAdmissionFake } from './support/metadataAdmissionFake';
import { TEST_ONLY_PROTECTION_POLICY } from './support/providerProtection';

const token = 'a'.repeat(64);
const context = { jobId: 'job-1', purpose: 'edition_options', claimToken: token, attempt: 1,
  candidateId: 'candidate-1', storeId: 'store-1', sessionId: 'session-1',
  queryIdentity: 'query-1', requestGeneration: 0 };
const fence = { jobId: 'job-1', worker: 'worker-1', leaseToken: token, claimAttempt: 1,
  candidateId: 'candidate-1', storeId: 'store-1', sessionId: 'session-1',
  requestId: 'job-1', requestGeneration: 0, queryIdentity: 'query-1' };
const physical = (attemptId: string, identity: string) => ({ p_attempt_id: attemptId,
  p_job_id: 'job-1', p_worker: 'worker-1', p_lease_token: token, p_attempt_count: 1,
  p_physical_call_identity: identity });
const registered = (id: string) => ({ data: { status: 'registered', provider_call_id: id }, error: null });

function fakeWith(policies: Array<[string, string, unknown]>) {
  const fake = metadataAdmissionFake(jobId => jobId === 'job-1' ? context : undefined);
  fake.registry({ providers: policies.map(([adapterKey, adapterVersion, protectionPolicy]) =>
    ({ adapterKey, adapterVersion, protectionPolicy })) });
  return fake;
}
const bind = (fake: ReturnType<typeof fakeWith>, attemptId: string, key: string, version: string) =>
  fake.observe('phase9_register_structural_metadata_attempt',
    { p_adapter_key: key, p_adapter_version: version },
    { data: { attempt_id: attemptId }, error: null });
const submit = (fake: ReturnType<typeof fakeWith>, attemptId: string, identity: string,
  result = registered('call-' + identity)) => fake.wrap(async () => result)(
  'phase9_register_edition_options_provider_call_v1', physical(attemptId, identity));

describe('8c fake admission enforcement (D-b)', () => {
  it('skips only an unknown attempt binding and counts it once', async () => {
    const fake = fakeWith([['google_books', '1.0.0', TEST_ONLY_PROTECTION_POLICY]]);
    expect(await submit(fake, 'unknown-attempt', 'p1')).toMatchObject(
      { data: { status: 'registered' } });
    expect(fake.unknownBindingCount()).toBe(1);
    expect(await submit(fake, 'unknown-attempt', 'p1')).toMatchObject(
      { data: { status: 'registered' } });
    expect(fake.unknownBindingCount()).toBe(1);
  });

  it('refuses a known protected binding without an admission', async () => {
    const fake = fakeWith([['google_books', '1.0.0', TEST_ONLY_PROTECTION_POLICY]]);
    bind(fake, 'a1', 'google_books', '1.0.0');
    const result = await submit(fake, 'a1', 'p2');
    expect(result).toEqual({ data: null,
      error: { code: 'P0001', message: 'P9_PROVIDER_RUN_NOT_ADMITTED' } });
    expect(fake.unknownBindingCount()).toBe(0);
  });

  it('admits after an exact reserve, charges once, and releases only when finalized', async () => {
    const replay: string[] = [];
    const fake = metadataAdmissionFake(jobId => jobId === 'job-1' ? context : undefined,
      (name, p) => replay.push(name + ':' + String((p as any).p_physical_call_identity)));
    fake.registry({ providers: [{ adapterKey: 'google_books', adapterVersion: '1.0.0',
      protectionPolicy: TEST_ONLY_PROTECTION_POLICY }] });
    bind(fake, 'a1', 'google_books', '1.0.0');
    expect(fake.reserve({ f: fence, p_key: 'google_books', p_version: '1.0.0' }))
      .toEqual({ data: { status: 'reserved', slots: 1 }, error: null });
    expect(await submit(fake, 'a1', 'p3')).toMatchObject({ data: { status: 'registered' } });
    expect(fake.holds.get(JSON.stringify(['job-1', 'worker-1', token, 1]))!.slots).toBe(0);
    expect(await submit(fake, 'a1', 'p3')).toMatchObject({ data: { status: 'registered' } });
    expect(replay).toEqual(['phase9_register_edition_options_provider_call_v1:p3']);
    expect(fake.holds.get(JSON.stringify(['job-1', 'worker-1', token, 1]))!.slots).toBe(0);
    expect(fake.release({ f: fence, p_key: 'google_books', p_version: '1.0.0' }))
      .toEqual({ data: { status: 'recovery_only' }, error: null });
    fake.observe('phase9_finalize_edition_options_provider_call_v1',
      { p_provider_call_id: 'call-p3' },
      { data: { provider_call_id: 'call-p3', status: 'finalized' }, error: null });
    expect(fake.release({ f: fence, p_key: 'google_books', p_version: '1.0.0' }))
      .toEqual({ data: { status: 'released' }, error: null });
  });

  it('keeps a known NULL-policy provider legitimate without counting an unknown binding', async () => {
    const fake = fakeWith([['open_library', '1.0.0', null]]);
    bind(fake, 'a2', 'open_library', '1.0.0');
    expect(await submit(fake, 'a2', 'p4')).toMatchObject({ data: { status: 'registered' } });
    expect(fake.unknownBindingCount()).toBe(0);
  });

  it('does not turn a missing configuration into NULL or an admission', async () => {
    const fake = fakeWith([]);
    bind(fake, 'a3', 'synthetic', '9.9.9');
    expect(await submit(fake, 'a3', 'p5')).toEqual({ data: null,
      error: { code: 'P0001', message: 'P9_PROVIDER_CONFIGURATION_INVALID' } });
    expect(fake.reserve({ f: fence, p_key: 'synthetic', p_version: '9.9.9' })).toEqual({
      data: null, error: { code: 'P0001', message: 'P9_STATE_CONFLICT' } });
    expect(fake.unknownBindingCount()).toBe(0);
  });

  it('recognizes automatic preparation/begin without an explicit reserve', async () => {
    const automaticContext = { ...context, purpose: 'automatic' };
    const fake = metadataAdmissionFake(jobId => jobId === 'job-1' ? automaticContext : undefined);
    fake.registry({ providers: [{ adapterKey: 'google_books', adapterVersion: '1.0.0',
      protectionPolicy: TEST_ONLY_PROTECTION_POLICY }] });
    const autoFence = { jobId: 'job-1', worker: 'worker-1', leaseToken: token, claimAttempt: 1,
      candidateId: 'candidate-1', storeId: 'store-1', sessionId: 'session-1',
      candidateVersion: 1, capturedRequestId: null, requestGeneration: 0, queryIdentity: 'query-1' };
    fake.observe('phase9_begin_automatic_provider_run_v1',
      { f: autoFence, p_key: 'google_books', p_version: '1.0.0' },
      { data: { status: 'started' }, error: null });
    bind(fake, 'a4', 'google_books', '1.0.0');
    expect(await submit(fake, 'a4', 'p6')).toMatchObject({ data: { status: 'registered' } });
    expect(fake.unknownBindingCount()).toBe(0);
  });
});
