// RED for AC8-14/AC8-10: the automatic worker still completes through the
// legacy finalize/selection/cover/cache calls instead of the 8a-4 automatic
// transaction. The SQL transaction itself is exercised by the P-suite
// (phase9ProviderAutomaticReview.integration.test.mjs).
import { runMetadataWorkerBatch } from '../../../workers/phase9-metadata-worker';
import { editionWorkerFixture, automaticContext } from './fixtures/phase9/editionOptionsWorker';
import { GOLDEN_CLOCK, GOLDEN_LOOKUP_ID, GOLDEN_ATTEMPT_ID, GOOGLE_AUTOMATIC_V1 }
  from './fixtures/phase9/providerReplacementGoldens';
import { automaticDependencies, JOB_ID, CANDIDATE_ID, STORE_ID, SESSION_ID }
  from './support/automaticWorker';

describe('Phase 9 automatic metadata completion transaction', () => {
  it('submits one p9-metadata-result-v2 command through the automatic completion transaction', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse(GOLDEN_CLOCK));
    try {
      const subject = automaticDependencies();
      const result = await runMetadataWorkerBatch(1, subject.dependencies);
      expect(result.results).toEqual([{ outcome: 'accepted_metadata_match' }]);
      const command = subject.command();
      expect(command).not.toBeNull();
      expect(Object.keys(command!).sort()).toEqual(
        ['attemptId', 'fence', 'lookupId', 'result', 'selectedOptionId', 'source'],
      );
      expect(command).toMatchObject({
        fence: {
          jobId: JOB_ID,
          worker: subject.fixture.dependencies.workerId,
          leaseToken: subject.fixture.current().claimToken,
          claimAttempt: 1,
          candidateId: CANDIDATE_ID,
          storeId: STORE_ID,
          sessionId: SESSION_ID,
          candidateVersion: 1,
          queryIdentity: automaticContext.queryIdentity,
          capturedRequestId: null,
          requestGeneration: 0,
        },
        lookupId: GOLDEN_LOOKUP_ID,
        attemptId: GOLDEN_ATTEMPT_ID,
        selectedOptionId: null,
        source: 'external',
      });
      expect(command!.result).toEqual({
        version: 'p9-metadata-result-v2',
        purpose: 'automatic',
        outcome: GOOGLE_AUTOMATIC_V1,
        rows: null,
        catalogueCompanions: null,
        retention: null,
      });
      // M92 echoes the command's selected binding; a list-less Google result is null.
      expect(subject.receipt()?.selectedOptionId).toBe(command!.selectedOptionId);
      expect(command!.selectedOptionId).toBeNull();
      const names = subject.fixture.calls.map(call => call.name);
      // Positive controls make the negative writes meaningful: the transaction
      // is reached only after the existing cache/coalescing boundary was read.
      expect(names).toEqual(expect.arrayContaining([
        'phase9_metadata_cache_reuse_context',
        'phase9_prepare_automatic_metadata_v1',
      ]));
      expect(names).not.toContain('phase9_finalize_structural_metadata_attempt');
      expect(names).not.toContain('phase9_select_structural_metadata_snapshot');
      // ??4.2?4.3 preserve this private selected-snapshot cache. Full-list
      // caching stays deferred: no rows/companions are passed to that RPC.
      // Pre-existing worker RPC (migration 20260728000015): the selected-only
      // cache effect must exist, otherwise a correct SDD implementation fails.
      const cacheCalls = subject.fixture.calls.filter(
        call => call.name === 'phase9_store_metadata_cache');
      expect(cacheCalls).toHaveLength(1);
      for (const call of cacheCalls) {
        expect(call.parameters.p_outcome).toBe('positive');
        expect(call.parameters.p_normalized_snapshot).toEqual(GOOGLE_AUTOMATIC_V1.selected);
        expect(call.parameters).not.toHaveProperty('rows');
        expect(call.parameters).not.toHaveProperty('catalogueCompanions');
      }
      // M92 phase9_complete_automatic_metadata_v1 publishes/reuses the edition
      // list from the command's own result.rows/catalogueCompanions; no separate
      // worker-callable publication RPC exists for this path. Because the Google
      // result is list-less, the submitted boundary carries no list to publish.
      const completion = subject.fixture.calls.filter(
        call => call.name === 'phase9_complete_automatic_metadata_v1');
      expect(completion).toHaveLength(1);
      expect(completion[0].parameters.p_command).toBe(command);
      expect(command!.result.rows).toBeNull();
      expect(command!.result.catalogueCompanions).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps a local canonical match on the zero-egress path without an automatic command', async () => {
    const subject = automaticDependencies();
    Object.assign(subject.fixture.current(), { localCanonicalEditionId: 'local-winner' });
    const result = await runMetadataWorkerBatch(1, subject.dependencies);
    expect(result.results).toEqual([{ outcome: 'local_canonical_match' }]);
    expect(subject.command()).toBeNull();
    expect(subject.fixture.stats().providerRequests).toBe(0);
  });

  it('keeps explicit edition options off the automatic completion transaction', async () => {
    const fixture = editionWorkerFixture();
    let automatic = 0;
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    const rpc = async (name: string, parameters: Record<string, any>) => {
      if (name === 'phase9_complete_automatic_metadata_v1') automatic += 1;
      return baseRpc(name, parameters);
    };
    const result = await runMetadataWorkerBatch(1, {
      ...fixture.dependencies, serviceClient: { rpc },
    });
    expect(result.results).toEqual([{ outcome: 'edition_options_available' }]);
    expect(automatic).toBe(0);
  });
});
