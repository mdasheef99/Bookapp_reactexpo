import {
  buildSearchVariantPersistenceEnvelope,
  persistVisionAnalysisWithSearchVariants,
} from '../_shared/imageInventory/runtime/searchVariantPersistence';
import {
  parseSearchVariantProposalSidecar,
  parseSpineAnalysisResult,
} from '../_shared/imageInventory/contracts';
import {
  kannadaVariantSidecar,
} from './fixtures/phase9/searchVariantFixtures';
import { visionOne } from './fixtures/phase9/visionFixtures';

describe('Phase 9 Unit 5C-2 persistence mapping', () => {
  it('maps validated title and authors to flat provider-neutral proposal rows', () => {
    const envelope = buildSearchVariantPersistenceEnvelope(
      parseSearchVariantProposalSidecar(kannadaVariantSidecar),
    );
    expect(envelope).toMatchObject({
      contract_version: 'p9-contract-v1',
      proposal_schema_version: 'search_variant_proposals_v1',
      generation_source: 'recorded_fixture',
    });
    expect(envelope.proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target_type: 'title',
        author_index: null,
        source_field: 'observation:1:title',
        variant_type: 'primary_roman',
      }),
      expect.objectContaining({
        target_type: 'author',
        author_index: 1,
        source_field: 'observation:1:author:1',
      }),
    ]));
    envelope.proposals.forEach((entry) => {
      expect(entry).not.toHaveProperty('status');
      expect(entry).not.toHaveProperty('search_eligible');
    });
  });

  it('uses the combined fenced RPC and never accepts lifecycle input', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        outcome: 'accepted',
        candidate_count: 1,
        detected_visible_book_count: 1,
        proposal_count: 3,
      },
      error: null,
    });
    const result = await persistVisionAnalysisWithSearchVariants(
      { rpc },
      {
        claim: {
          jobId: '96000000-0000-0000-0000-000000000021',
          worker: 'vision-worker-0000000001',
          leaseToken: 'a'.repeat(64),
          attemptCount: 1,
        },
        vision: parseSpineAnalysisResult(visionOne),
        variants: parseSearchVariantProposalSidecar(kannadaVariantSidecar),
      },
    );
    expect(result.proposal_count).toBe(3);
    expect(rpc).toHaveBeenCalledWith(
      'phase9_persist_vision_analysis_with_variants',
      expect.objectContaining({
        p_job_id: '96000000-0000-0000-0000-000000000021',
        p_worker: 'vision-worker-0000000001',
        p_lease_token: 'a'.repeat(64),
        p_attempt_count: 1,
        p_result: expect.objectContaining({ schema_version: 'p9-vision-v2' }),
        p_variants: expect.objectContaining({
          proposal_schema_version: 'search_variant_proposals_v1',
        }),
      }),
    );
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('approval_method');
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('"active"');
  });

  it('propagates the hardened database boundary error without retry mutation', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'P9_STATE_CONFLICT' },
    });
    await expect(persistVisionAnalysisWithSearchVariants(
      { rpc },
      {
        claim: {
          jobId: '96000000-0000-0000-0000-000000000021',
          worker: 'vision-worker-0000000001',
          leaseToken: 'b'.repeat(64),
          attemptCount: 1,
        },
        vision: parseSpineAnalysisResult(visionOne),
        variants: parseSearchVariantProposalSidecar(kannadaVariantSidecar),
      },
    )).rejects.toThrow('P9_STATE_CONFLICT');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
