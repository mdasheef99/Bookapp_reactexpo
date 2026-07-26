import { createSpineAnalysisRequest } from '../_shared/imageInventory/contracts';
import { FixtureSpineImageAnalyzer } from '../_shared/imageInventory/analysis/fixtureSpineImageAnalyzer';
import { runVisionAnalysisWorker } from '../_shared/imageInventory/runtime/visionAnalysisWorker';
import {
  visionMixedLanguage,
  visionOne,
  visionRequestInput,
} from './fixtures/phase9/visionFixtures';

const rpc = jest.fn();
const client: any = { rpc };
const workerRequest = {
  contractVersion: 'phase9-v1' as const,
  leaseOwner: 'vision-worker-0000000001',
  batchSize: 1,
};
const claim = {
  id: '94000000-0000-4000-8000-000000000001',
  attempt_count: 1,
  lease_token: 'a'.repeat(64),
};
const context = {
  contract_version: 'p9-contract-v1',
  schema_version: 'p9-vision-v2',
  pipeline_version: 'phase9-v1',
  prompt_version: 'fixture-prompt-v2',
  adapter_key: 'fixture_adapter',
  adapter_version: '1.0.0',
  job_reference: 'job_fixture_reference_0001',
  correlation_id: '93000000-0000-4000-8000-000000000001',
  expected_language: 'en',
  sanitized_media_reference: 'media_fixture_reference_0001',
};

beforeEach(() => jest.resetAllMocks());

describe('Phase 9 vision-analysis worker orchestration', () => {
  it('V4-W01 claims only through the vision-specific RPC and obtains authoritative context', async () => {
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({ data: { outcome: 'accepted', candidate_count: 1 }, error: null });
    const analyzer = new FixtureSpineImageAnalyzer({
      media_fixture_reference_0001: visionOne,
    });
    const result = await runVisionAnalysisWorker(workerRequest, client, analyzer, {
      now: () => new Date('2026-07-26T00:00:00.000Z'),
    });
    expect(result).toEqual({
      claimed: 1,
      results: [{ jobId: claim.id, outcome: 'accepted', candidateCount: 1 }],
    });
    expect(rpc).toHaveBeenNthCalledWith(1, 'claim_phase9_vision_jobs', {
      p_batch_size: 1,
      p_worker: workerRequest.leaseOwner,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'phase9_vision_job_context', expect.objectContaining({
      p_job_id: claim.id,
      p_attempt_count: 1,
      p_lease_token: claim.lease_token,
    }));
  });

  it('persists the strict canonical result and platform policy without private media authority', async () => {
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({ data: { outcome: 'accepted_with_language_skips', candidate_count: 1 }, error: null });
    await runVisionAnalysisWorker(workerRequest, client, new FixtureSpineImageAnalyzer({
      media_fixture_reference_0001: visionMixedLanguage,
    }));
    const persistArgs = rpc.mock.calls[2][1];
    expect(rpc.mock.calls[2][0]).toBe('phase9_persist_vision_analysis');
    expect(persistArgs.p_result).toMatchObject({
      schema_version: 'p9-vision-v2',
      detected_visible_book_count: 3,
    });
    expect(persistArgs.p_result.observations).toHaveLength(3);
    expect(persistArgs).not.toHaveProperty('p_storage_path');
    expect(persistArgs).not.toHaveProperty('p_signed_url');
    expect(persistArgs).not.toHaveProperty('p_lease_token_hash');
  });

  it('V4-W04 schedules retry for analyzer timeout without persisting evidence', async () => {
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({ data: 'retry_scheduled', error: null });
    const result = await runVisionAnalysisWorker(workerRequest, client, new FixtureSpineImageAnalyzer({
      media_fixture_reference_0001: { error: 'timeout' },
    }));
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_vision_job', expect.objectContaining({
      p_safe_error_code: 'P9_VISION_ANALYZER_TIMEOUT',
    }));
    expect(rpc.mock.calls[2][1]).not.toHaveProperty('p_retryable');
    expect(result.results[0].outcome).toBe('retry_scheduled');
    expect(rpc.mock.calls.some(([name]) => name === 'phase9_persist_vision_analysis')).toBe(false);
  });

  it('rejects malformed context before invoking the analyzer', async () => {
    const analyzer = { analyze: jest.fn() };
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: { ...context, storage_path: 'forged/path' }, error: null })
      .mockResolvedValueOnce({ data: 'resolved', error: null });
    await runVisionAnalysisWorker(workerRequest, client, analyzer);
    expect(analyzer.analyze).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_vision_job', expect.objectContaining({
      p_safe_error_code: 'P9_VISION_SCHEMA_INVALID',
    }));
  });

  it('rejects a structurally valid analyzer result with mismatched request identity', async () => {
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({ data: 'resolved', error: null });
    const analyzer = {
      analyze: jest.fn().mockResolvedValue({
        ...createSpineAnalysisRequest(visionRequestInput),
        jobReference: 'job_mismatched_reference_0001',
        providerKey: 'recorded_fixture',
        modelKey: 'fixture_multimodal',
        modelVersion: '2026-07-26',
        receivedAt: '2026-07-26T00:00:01.000Z',
        imageOutcome: 'no_books',
        detectedVisibleBookCount: 0,
        observations: [],
        warningCodes: [],
      }),
    };
    await runVisionAnalysisWorker(workerRequest, client, analyzer);
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_vision_job', expect.objectContaining({
      p_safe_error_code: 'P9_VISION_SCHEMA_INVALID',
    }));
    expect(rpc.mock.calls.some(([name]) => name === 'phase9_persist_vision_analysis')).toBe(false);
  });

  it('treats a failed persist/fail fence as a stale lease with no raw error echo', async () => {
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'private db detail' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'P9_STATE_CONFLICT' } });
    const result = await runVisionAnalysisWorker(workerRequest, client, new FixtureSpineImageAnalyzer({
      media_fixture_reference_0001: visionOne,
    }));
    expect(result.results).toEqual([{ outcome: 'stale_attempt' }]);
    expect(JSON.stringify(result)).not.toContain('private db detail');
  });

  it('reports persistence conflict without invoking the fail transition', async () => {
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'P9_VISION_PERSISTENCE_CONFLICT' },
      });
    const result = await runVisionAnalysisWorker(workerRequest, client, new FixtureSpineImageAnalyzer({
      media_fixture_reference_0001: visionOne,
    }));
    expect(result.results).toEqual([{ outcome: 'persistence_reconciliation_required' }]);
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it('does not retry explicit media or authorization rejection', async () => {
    for (const [message, outcome] of [
      ['P9_MEDIA_NOT_APPROVED', 'relationship_reconciliation_required'],
      ['P9_OWNER_NOT_AUTHORIZED', 'security_rejected'],
    ]) {
      rpc.mockReset();
      rpc
        .mockResolvedValueOnce({ data: [claim], error: null })
        .mockResolvedValueOnce({ data: null, error: { message } });
      const result = await runVisionAnalysisWorker(
        workerRequest,
        client,
        new FixtureSpineImageAnalyzer({}),
      );
      expect(result.results).toEqual([{ outcome }]);
      expect(rpc).toHaveBeenCalledTimes(2);
    }
  });

  it('maps an explicit state conflict to stale_attempt without calling fail', async () => {
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'P9_STATE_CONFLICT' } });
    const result = await runVisionAnalysisWorker(workerRequest, client, new FixtureSpineImageAnalyzer({
      media_fixture_reference_0001: visionOne,
    }));
    expect(result.results).toEqual([{ outcome: 'stale_attempt' }]);
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it('keeps an unknown resolved fail error permanent and distinct from stale', async () => {
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'network unavailable' } });
    const result = await runVisionAnalysisWorker(workerRequest, client, new FixtureSpineImageAnalyzer({
      media_fixture_reference_0001: { error: 'timeout' },
    }));
    expect(result.results).toEqual([{ outcome: 'internal_permanent' }]);
  });

  it('keeps a transient persistence outage retryable', async () => {
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'P9_VISION_DATABASE_RETRYABLE' } })
      .mockResolvedValueOnce({ data: 'retry_scheduled', error: null });
    const result = await runVisionAnalysisWorker(workerRequest, client, new FixtureSpineImageAnalyzer({
      media_fixture_reference_0001: visionOne,
    }));
    expect(result.results[0].outcome).toBe('retry_scheduled');
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_vision_job', expect.objectContaining({
      p_safe_error_code: 'P9_VISION_DATABASE_RETRYABLE',
    }));
  });

  it('maps rejected context and persist promises to bounded retryable failures', async () => {
    for (const boundary of ['context', 'persist']) {
      rpc.mockReset();
      rpc.mockResolvedValueOnce({ data: [claim], error: null });
      if (boundary === 'context') {
        rpc.mockRejectedValueOnce(new Error('private context transport detail'));
      } else {
        rpc
          .mockResolvedValueOnce({ data: context, error: null })
          .mockRejectedValueOnce(new Error('private persist transport detail'));
      }
      rpc.mockResolvedValueOnce({ data: 'retry_scheduled', error: null });
      const result = await runVisionAnalysisWorker(workerRequest, client, new FixtureSpineImageAnalyzer({
        media_fixture_reference_0001: visionOne,
      }));
      expect(result.results[0].outcome).toBe('retry_scheduled');
      expect(rpc).toHaveBeenLastCalledWith('phase9_fail_vision_job', expect.objectContaining({
        p_safe_error_code: 'P9_VISION_DATABASE_RETRYABLE',
      }));
      expect(JSON.stringify(result)).not.toContain('private');
    }
  });

  it('maps a rejected fail promise to database_retryable rather than stale or invalid', async () => {
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockRejectedValueOnce(new Error('private fail transport detail'));
    const result = await runVisionAnalysisWorker(workerRequest, client, new FixtureSpineImageAnalyzer({
      media_fixture_reference_0001: { error: 'timeout' },
    }));
    expect(result.results).toEqual([{ outcome: 'database_retryable' }]);
    expect(JSON.stringify(result)).not.toContain('private');
  });

  it('terminalizes an unknown resolved database failure as bounded internal permanent', async () => {
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'private constraint detail' } })
      .mockResolvedValueOnce({ data: 'resolved', error: null });
    const result = await runVisionAnalysisWorker(
      workerRequest,
      client,
      new FixtureSpineImageAnalyzer({}),
    );
    expect(result.results[0].outcome).toBe('resolved');
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_vision_job', expect.objectContaining({
      p_safe_error_code: 'P9_VISION_INTERNAL_PERMANENT',
    }));
    expect(JSON.stringify(result)).not.toContain('private constraint detail');
  });

  it('classifies an arbitrary malformed analyzer value as permanent schema failure', async () => {
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({ data: 'resolved', error: null });
    const analyzer = { analyze: jest.fn().mockResolvedValue({ observations: null }) };
    const result = await runVisionAnalysisWorker(workerRequest, client, analyzer);
    expect(result.results[0].outcome).toBe('resolved');
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_vision_job', expect.objectContaining({
      p_safe_error_code: 'P9_VISION_SCHEMA_INVALID',
    }));
  });

  it('returns a bounded job-only reconciliation result without a raw job ID', async () => {
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({
        data: {
          outcome: 'relationship_reconciliation_required',
          safe_error_code: 'P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED',
        },
        error: null,
      });
    const result = await runVisionAnalysisWorker(workerRequest, client, new FixtureSpineImageAnalyzer({}));
    expect(result.results).toEqual([{ outcome: 'relationship_reconciliation_required' }]);
    expect(JSON.stringify(result)).not.toContain(claim.id);
  });

  it('builds analyzer requests from authoritative context and current claim attempt', async () => {
    const request = createSpineAnalysisRequest(visionRequestInput);
    const analyzer = { analyze: jest.fn().mockResolvedValue({
      ...request,
      providerKey: 'recorded_fixture',
      modelKey: 'fixture_multimodal',
      modelVersion: '2026-07-26',
      receivedAt: '2026-07-26T00:00:01.000Z',
      imageOutcome: 'no_books',
      detectedVisibleBookCount: 0,
      observations: [],
      warningCodes: [],
    }) };
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({ data: { outcome: 'no_books', candidate_count: 0 }, error: null });
    await runVisionAnalysisWorker(workerRequest, client, analyzer);
    expect(analyzer.analyze).toHaveBeenCalledWith(expect.objectContaining({
      attemptNumber: claim.attempt_count,
      sanitizedMediaReference: context.sanitized_media_reference,
    }));
  });
});
