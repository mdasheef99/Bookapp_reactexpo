// M93 admission/grant protocol. SQL integration tests remain the authority for transactions/locks.
type Parameters = Record<string, any>;
type Result = { data: any; error: any };
type Rpc = (name: string, p: Parameters) => Promise<Result>;
type Hold = { f: Parameters; key: string; version: string; slots: number };
const explicitKeys = ['jobId','worker','leaseToken','claimAttempt','candidateId','storeId','sessionId',
  'requestId','requestGeneration','queryIdentity'];
const automaticKeys = explicitKeys.filter(key => key !== 'requestId').concat('candidateVersion','capturedRequestId');
const refusal = (message: string): Result => ({ data: null, error: { code: 'P0001', message } });
const ok = (data: any): Result => ({ data, error: null });
const isRefusal = (value: unknown): value is Result =>
  value !== null && typeof value === 'object' && 'error' in (value as Record<string, unknown>);
const claimKey = (f: Parameters) => JSON.stringify([f.jobId, f.worker, f.leaseToken, f.claimAttempt]);
const providerKey = (key: string, version: string) => key + '@' + version;
const physicalNames = new Set(['phase9_register_metadata_provider_call','phase9_register_edition_options_provider_call_v1']);

export function metadataAdmissionFake(contextFor: (jobId: string) => Parameters | undefined,
  recordReplay: (name: string, p: Parameters) => void = () => {}) {
  const policies = new Map<string, any>();
  const attempts = new Map<string, { key: string; version: string }>();
  const holds = new Map<string, Hold>();
  const registrations = new Map<string, Result>();
  const calls = new Map<string, { jobId: string; claim: string; status: string }>();
  const used = new Map<string, number>();
  const closed = new Set<string>();
  // D-b: registrations accepted ONLY because the attempt has no fake binding. The new
  // fake test asserts this increments only for direct-hook cases; every worker/explicit
  // fixture test asserts it stays 0.
  let unknownBindingRegistrations = 0;
  function registry(snapshot: any) {
    policies.clear();
    for (const row of snapshot.providers) policies.set(providerKey(row.adapterKey,row.adapterVersion), row.protectionPolicy);
  }
  function signature(p: Parameters, keys: string[]): Result | null {
    if (!p || Object.keys(p).length !== keys.length || keys.some(key => !Object.hasOwn(p,key))) {
      return refusal('P9_REQUEST_INVALID');
    }
    return null;
  }
  function fence(p: Parameters, automatic = false): Parameters | Result {
    const invalid = signature(p.f, automatic ? automaticKeys : explicitKeys);
    if (invalid !== null) return invalid;
    const f = p.f;
    const context = contextFor(f.jobId);
    if (!context || closed.has(claimKey(f)) || f.worker.length === 0
      || context.jobId !== f.jobId || context.claimToken !== f.leaseToken || context.attempt !== f.claimAttempt
      || context.candidateId !== f.candidateId || context.storeId !== f.storeId || context.sessionId !== f.sessionId
      || context.queryIdentity !== f.queryIdentity
      || (automatic ? context.purpose === 'edition_options'
        : context.purpose !== 'edition_options' || f.requestId !== f.jobId || context.requestGeneration !== f.requestGeneration)) {
      return refusal('P9_STATE_CONFLICT');
    }
    return f as Parameters;
  }
  function requested(p: Parameters) {
    return { jobId: p.p_job_id, worker: p.p_worker, leaseToken: p.p_lease_token, claimAttempt: p.p_attempt_count };
  }
  const identity = (p: Parameters) => JSON.stringify([claimKey(requested(p)),p.p_attempt_id,p.p_physical_call_identity]);
  function admission(f: Parameters, key: string, version: string) {
    const prior = holds.get(claimKey(f));
    if (prior && prior.key === key && prior.version === version && prior.slots > 0) return prior;
    const hold = { f: structuredClone(f), key, version, slots: key === 'google_books' ? 1 : 6 };
    holds.set(claimKey(f), hold);
    return hold;
  }
  function guard(p: Parameters): Result | null {
    if (registrations.has(identity(p))) return null;
    const provider = attempts.get(String(p.p_attempt_id));
    // D-b: only an attempt with no fake binding skips enforcement (direct-hook tests
    // that never create an attempt). A known protected binding still requires a hold.
    if (!provider) { unknownBindingRegistrations += 1; return null; }
    const key = providerKey(provider.key,provider.version);
    if (!policies.has(key)) return refusal('P9_PROVIDER_CONFIGURATION_INVALID');
    if (policies.get(key) === null) return null; // Legitimate legacy operation, not unconditional enforcement.
    const hold = holds.get(claimKey(requested(p)));
    if (!hold || hold.key !== provider.key || hold.version !== provider.version || hold.slots < 1
      || closed.has(claimKey(requested(p)))) return refusal('P9_PROVIDER_RUN_NOT_ADMITTED');
    return null;
  }
  function observe(name: string, p: Parameters, result: Result) {
    if (result.error !== null) return;
    const data = result.data;
    if (name === 'phase9_provider_configuration_v1') registry(data);
    if (name === 'phase9_register_structural_metadata_attempt') attempts.set(String(data.attempt_id), {
      key: p.p_adapter_key, version: p.p_adapter_version,
    });
    if (name === 'phase9_prepare_automatic_metadata_v1'
      && data?.admission?.status === 'started') {
      const f = fence(p,true); if (!isRefusal(f)) admission(f,p.p_lookup.adapter_key,p.p_lookup.adapter_version);
    }
    if (name === 'phase9_begin_automatic_provider_run_v1'
      && (data?.status === 'started' || data?.status === 'replayed' && data.runStatus === 'running')) {
      const f = fence(p,true); if (!isRefusal(f)) admission(f,p.p_key,p.p_version);
    }
    if (name === 'phase9_reserve_metadata_provider_round_v1' && data?.status === 'reserved') {
      const f = fence(p); if (!isRefusal(f) && !holds.has(claimKey(f))) holds.set(claimKey(f), { f: structuredClone(f),
        key: p.p_key, version: p.p_version, slots: data.slots });
    }
    if (physicalNames.has(name) && data?.status === 'registered') {
      const key = identity(p);
      if (!registrations.has(key)) {
        const provider = attempts.get(String(p.p_attempt_id));
        if (provider && policies.get(providerKey(provider.key,provider.version)) !== null) {
          const hold = holds.get(claimKey(requested(p)));
          if (hold) {
            hold.slots--;
            used.set(hold.f.storeId, (used.get(hold.f.storeId) ?? 0) + 1);
          }
        }
        registrations.set(key,result);
        calls.set(String(data.provider_call_id), { jobId: p.p_job_id, claim: claimKey(requested(p)), status: 'registered' });
      }
    }
    if (name === 'phase9_finalize_metadata_provider_call' || name === 'phase9_finalize_edition_options_provider_call_v1') {
      const call = calls.get(String(p.p_provider_call_id));
      if (call && data?.provider_call_id === p.p_provider_call_id) call.status = data.status;
    }
    if (name === 'phase9_finish_automatic_provider_run_v1' && ['finalized','retry_scheduled'].includes(data?.status)) {
      const hold = holds.get(claimKey(p.f)); if (hold) hold.slots = 0;
    }
  }
  function reserve(p: Parameters): Result {
    const invalid = signature(p,['f','p_key','p_version']); if (invalid !== null) return invalid;
    const fenced = fence(p); if (isRefusal(fenced)) return fenced;
    const f = fenced as Parameters;
    if ([...calls.values()].some(call => call.jobId === f.jobId && call.status !== 'finalized')) {
      return ok({ status: 'recovery_only' });
    }
    const key = providerKey(p.p_key,p.p_version);
    if (!policies.has(key)) return refusal('P9_STATE_CONFLICT');
    const policy = policies.get(key);
    const slots = p.p_key === 'google_books' ? 1 : 6;
    if (policy === null || policy.storeMaxGets < slots) return ok({ status: 'configuration_required' });
    const prior = holds.get(claimKey(f));
    if (prior?.slots && prior.key === p.p_key && prior.version === p.p_version) {
      return ok({ status: 'reserved', slots: prior.slots });
    }
    if ((used.get(f.storeId) ?? 0) + slots > policy.storeMaxGets) {
      if ([...calls.values()].some(call => call.jobId === f.jobId)) return ok({ status: 'drain_required' });
      closed.add(claimKey(f)); contextFor(f.jobId)!.attempt--;
      return ok({ status: 'capacity_wait', dueAt: new Date(Date.now() + 60000).toISOString() });
    }
    return ok({ status: 'reserved', slots: admission(f,p.p_key,p.p_version).slots });
  }
  function release(p: Parameters): Result {
    const invalid = signature(p,['f','p_key','p_version']); if (invalid !== null) return invalid;
    const fenced = fence(p); if (isRefusal(fenced)) return fenced;
    const f = fenced as Parameters;
    const hold = holds.get(claimKey(f));
    if (!hold || hold.key !== p.p_key || hold.version !== p.p_version) return refusal('P9_STATE_CONFLICT');
    if ([...calls.values()].some(call => call.claim === claimKey(f) && call.status !== 'finalized')) {
      return ok({ status: 'recovery_only' });
    }
    hold.slots = 0; return ok({ status: 'released' });
  }
  function wrap(rpc: Rpc): Rpc {
    return async (name, p = {}) => {
      if (physicalNames.has(name)) {
        const prior = registrations.get(identity(p));
        if (prior) { recordReplay(name,p); return prior; }
        const refused = guard(p); // Successful registration overrides cannot bypass M93's claim/provider grant.
        if (refused !== null) return refused;
      }
      const result = await rpc(name,p);
      observe(name,p,result);
      return result;
    };
  }
  return {
    registry, guard, observe, holds, calls, used, reserve, release, wrap,
    unknownBindingCount: () => unknownBindingRegistrations,
  };
}
