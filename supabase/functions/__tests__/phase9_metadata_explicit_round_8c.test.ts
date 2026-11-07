import { executeEditionOptionsLookup } from '../_shared/imageInventory/runtime/metadataEditionOptions';
import { editionWorkerFixture, createdFixtures } from './fixtures/phase9/editionOptionsWorker';
import { providerConfigurationRow, providerConfigurationSnapshot } from './fixtures/phase9/providerConfiguration';
import { TEST_ONLY_PROTECTION_POLICY } from './support/providerProtection';

afterEach(() => {
  for (const fixture of createdFixtures.splice(0)) {
    expect(fixture.admissions.unknownBindingCount()).toBe(0);
  }
});


const reserve = 'phase9_reserve_metadata_provider_round_v1';
const release = 'phase9_release_metadata_provider_round_v1';
function protectedFixture(receipt?: unknown, loseReserve = 0, loseRelease = 0) {
  const fixture = editionWorkerFixture();
  fixture.useUuidLineage();
  const base = fixture.dependencies.serviceClient.rpc;
  fixture.dependencies.serviceClient.rpc = async (name, parameters) => {
    if (name === 'phase9_provider_configuration_v1') return {
      data: providerConfigurationSnapshot([providerConfigurationRow('google_books', '1.0.0', {
        explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
        protectionPolicy: TEST_ONLY_PROTECTION_POLICY,
      })]), error: null,
    };
    const result = await base(name, parameters);
    if (name === reserve && loseReserve-- > 0) throw new Error('lost reserve response');
    if (name === release && loseRelease-- > 0) throw new Error('lost release response');
    return name === reserve && receipt !== undefined ? { data: receipt, error: null } : result;
  };
  const run = () => {
    const { context, gateway } = fixture.direct();
    return executeEditionOptionsLookup(context, gateway, fixture.adapter, new AbortController().signal);
  };
  return { fixture, run };
}

describe('8c explicit worker admission (M93 protocol, 02c sections 4.3/4.4/8)', () => {
  it('reserves the exact explicit fence before any lineage and releases before completion', async () => {
    const { fixture, run } = protectedFixture();
    fixture.controls.beforeComplete = async () => {
      expect(fixture.calls.some(call => call.name === release)).toBe(true);
    };
    expect(await run()).toEqual({ outcome: 'edition_options_available' });
    const names = fixture.calls.map(call => call.name);
    for (const name of ['phase9_register_structural_metadata_lookup', 'phase9_reserve_metadata_usage',
      'phase9_register_structural_metadata_attempt']) expect(names.indexOf(reserve)).toBeLessThan(names.indexOf(name));
    const submitted = fixture.calls.find(call => call.name === reserve)!.parameters;
    expect(submitted).toEqual({ f: {
      jobId: fixture.current().jobId, worker: fixture.dependencies.workerId,
      leaseToken: fixture.current().claimToken, claimAttempt: 1,
      candidateId: fixture.current().candidateId, storeId: fixture.current().storeId,
      sessionId: fixture.current().sessionId, requestId: fixture.current().jobId,
      requestGeneration: 0, queryIdentity: fixture.current().queryIdentity,
    }, p_key: 'google_books', p_version: '1.0.0' });
    expect(fixture.stats().providerRequests).toBe(1);
  });
  it.each([
    [{ status: 'capacity_wait', dueAt: new Date(Date.now() + 60000).toISOString() }, 'retry_scheduled'],
    [{ status: 'recovery_only' }, 'manual_metadata_required'],
    [{ status: 'configuration_required' }, 'manual_metadata_required'],
    [{ status: 'drain_required' }, 'manual_metadata_required'],
    [{ status: 'started', slots: 1 }, 'manual_metadata_required'],
    [{ status: 'reserved', slots: 0 }, 'manual_metadata_required'],
    [{ status: 'reserved', slots: 2 }, 'manual_metadata_required'],
  ])('does not create lineage or GETs for %j', async (receipt, outcome) => {
    const { fixture, run } = protectedFixture(receipt);
    expect(await run()).toEqual({ outcome });
    expect(fixture.calls.filter(call => /register_structural_metadata|reserve_metadata_usage/u.test(call.name))).toEqual([]);
    expect(fixture.stats().providerRequests).toBe(0);
  });
  it('recovers a committed reserve response exactly once before fetching', async () => {
    const { fixture, run } = protectedFixture(undefined, 1);
    expect(await run()).toEqual({ outcome: 'edition_options_available' });
    const requests = fixture.calls.filter(call => call.name === reserve);
    expect(requests).toHaveLength(2);
    expect(requests[0].parameters).toEqual(requests[1].parameters);
    expect(fixture.stats().providerRequests).toBe(1);
  });
  it('preserves release uncertainty without invoking completion or failure', async () => {
    const { fixture, run } = protectedFixture(undefined, 0, 2);
    const complete = jest.spyOn(fixture.boundary, 'complete');
    const fail = jest.spyOn(fixture.boundary, 'fail');
    expect(await run()).toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.calls.filter(call => call.name === release)).toHaveLength(2);
    expect(complete).not.toHaveBeenCalled();
    expect(fail).not.toHaveBeenCalled();
    expect(fixture.stats().providerRequests).toBe(1);
  });
  it('releases while the claim is live before scheduling a provider retry', async () => {
    const { fixture, run } = protectedFixture();
    fixture.controls.status = 429;
    const fail = jest.spyOn(fixture.boundary, 'fail').mockImplementation(async () => {
      expect(fixture.calls.some(call => call.name === release)).toBe(true);
      return { status: 'retry_scheduled' };
    });
    expect(await run()).toEqual({ outcome: 'retry_scheduled' });
    expect(fail).toHaveBeenCalledTimes(1);
  });
  it('keeps the positively established NULL-policy compatibility route', async () => {
    const fixture = editionWorkerFixture();
    const { context, gateway } = fixture.direct();
    expect(await executeEditionOptionsLookup(context, gateway, fixture.adapter,
      new AbortController().signal)).toEqual({ outcome: 'edition_options_available' });
    expect(fixture.stats().providerRequests).toBe(1);
  });
  it('writes exactly one bounded failure for configuration_required and no lineage/GET', async () => {
    const { fixture, run } = protectedFixture({ status: 'configuration_required' });
    const fail = jest.spyOn(fixture.boundary, 'fail');
    expect(await run()).toEqual({ outcome: 'manual_metadata_required' });
    expect(fail).toHaveBeenCalledTimes(1);
    expect(fail).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'provider_disabled', retryable: false,
    }));
    expect(fixture.calls.filter(call => /register_structural_metadata|reserve_metadata_usage/u
      .test(call.name))).toEqual([]);
    expect(fixture.stats().providerRequests).toBe(0);
  });
  it('does not write completion or failure for a persistently malformed reserve receipt', async () => {
    const { fixture, run } = protectedFixture({ status: 'bogus' });
    const complete = jest.spyOn(fixture.boundary, 'complete');
    const fail = jest.spyOn(fixture.boundary, 'fail');
    expect(await run()).toEqual({ outcome: 'manual_metadata_required' });
    expect(complete).not.toHaveBeenCalled();
    expect(fail).not.toHaveBeenCalled();
    expect(fixture.calls.filter(call => call.name === reserve)).toHaveLength(2);
    expect(fixture.calls.filter(call => /register_structural_metadata|reserve_metadata_usage/u
      .test(call.name))).toEqual([]);
    expect(fixture.stats().providerRequests).toBe(0);
  });
  it('does not write completion or failure for drain_required', async () => {
    const { fixture, run } = protectedFixture({ status: 'drain_required' });
    const complete = jest.spyOn(fixture.boundary, 'complete');
    const fail = jest.spyOn(fixture.boundary, 'fail');
    expect(await run()).toEqual({ outcome: 'manual_metadata_required' });
    expect(complete).not.toHaveBeenCalled();
    expect(fail).not.toHaveBeenCalled();
    expect(fixture.stats().providerRequests).toBe(0);
  });
  it('recovers a lost release response with the exact live fence and completes', async () => {
    const { fixture, run } = protectedFixture(undefined, 0, 1);
    const complete = jest.spyOn(fixture.boundary, 'complete');
    expect(await run()).toEqual({ outcome: 'edition_options_available' });
    expect(fixture.calls.filter(call => call.name === release)).toHaveLength(2);
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it('does not replay a returned SQL refusal and writes no failure', async () => {
    const { fixture, run } = protectedFixture();
    const base = fixture.dependencies.serviceClient.rpc;
    let submissions = 0;
    fixture.dependencies.serviceClient.rpc = async (name, parameters) => {
      if (name !== reserve) return base(name, parameters);
      submissions += 1;
      return { data: null, error: { code: 'P0001', message: 'P9_STATE_CONFLICT' } };
    };
    const fail = jest.spyOn(fixture.boundary, 'fail');
    expect(await run()).toEqual({ outcome: 'manual_metadata_required' });
    expect(submissions).toBe(1);
    expect(fail).not.toHaveBeenCalled();
    expect(fixture.stats().providerRequests).toBe(0);
  });
  it('releases best-effort and still returns stale_claim when the claim changes after admission', async () => {
    const { fixture, run } = protectedFixture();
    fixture.controls.beforeContextRead = () => {
      Object.assign(fixture.current(), { queryIdentity: 'changed-after-admission' });
    };
    expect(await run()).toEqual({ outcome: 'stale_claim' });
    expect(fixture.calls.some(call => call.name === release)).toBe(true);
    expect(fixture.calls.some(call => call.name === 'phase9_fail_candidate_edition_options_v1')).toBe(false);
  });
  it('attempts the configuration_required failure exactly once when that write is lost', async () => {
    const { fixture, run } = protectedFixture({ status: 'configuration_required' });
    const fail = jest.spyOn(fixture.boundary, 'fail')
      .mockRejectedValueOnce(new Error('lost failure response'));
    const result = await run();
    expect(fail).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.calls.filter(call => /register_structural_metadata|reserve_metadata_usage/u
      .test(call.name))).toEqual([]);
    expect(fixture.stats().providerRequests).toBe(0);
  });
});
