import {
  GeminiSpineImageAnalyzer,
} from '../_shared/imageInventory/analysis/geminiSpineImageAnalyzer';
import {
  createSpineAnalysisRequest,
  parseSearchVariantProposalSidecar,
  parseSpineAnalysisResult,
} from '../_shared/imageInventory/contracts';
import { runVisionAnalysisWorker } from '../_shared/imageInventory/runtime/visionAnalysisWorker';
import { visionOne, visionRequestInput } from './fixtures/phase9/visionFixtures';
import { kannadaVariantSidecar } from './fixtures/phase9/searchVariantFixtures';

const request = createSpineAnalysisRequest({
  ...visionRequestInput,
  adapterKey: 'gemini_vision',
  adapterVersion: '1.0.0',
  promptVersion: 'gemini-spine-v1',
});

const providerVision = {
  image_outcome: 'analyzed',
  detected_visible_book_count: 1,
  observations: [{
    ordinal: 1,
    title_guess: 'ಮೂಕಜ್ಜಿಯ ಕನಸುಗಳು',
    author_guesses: ['ಕೋಟ ಶಿವರಾಮ ಕಾರಂತ'],
    publisher_clue: null,
    isbn_clue: null,
    detected_language: 'kn',
    confidence: 0.91,
  }],
};

function analyzerFor(responseBody: unknown) {
  const generateContent = jest.fn().mockResolvedValue({
    text: JSON.stringify(responseBody),
    responseId: 'response-1',
  });
  const analyzer = new GeminiSpineImageAnalyzer({
    client: { models: { generateContent } },
    modelId: 'gemini-3.5-flash-lite',
    timeoutMs: 10_000,
    resolveMedia: async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/webp',
    }),
    now: () => new Date('2026-07-29T06:00:00.000Z'),
  });
  return { analyzer, generateContent };
}

describe('Phase 9 Unit 5C-3 Gemini companion integration', () => {
  it('attaches server provenance to compact multilingual enrichment', async () => {
    const { analyzer, generateContent } = analyzerFor({
      vision: providerVision,
      multilingual_search_enrichment: [{
        observation_ordinal: 1,
        title: {
          source_language: 'kn',
          source_script: 'Knda',
          title_romanization: 'Mookajjiya Kanasugalu',
          english_translation_candidate: "Mookajji's Dreams",
        },
        authors: [{
          author_ordinal: 1,
          source_language: 'kn',
          source_script: 'Knda',
          author_romanization: 'Kota Shivarama Karantha',
        }],
      }],
    });
    await expect(analyzer.analyzeWithCompanion(request)).resolves.toMatchObject({
      vision: { schemaVersion: 'p9-vision-v2', observations: [{ ordinal: 1 }] },
      searchVariantProposals: {
        status: 'accepted',
        value: {
          schemaVersion: 'search_variant_proposals_v1',
          analysisReference: request.correlationId,
          providerKey: 'google_gemini',
          titles: [{ proposals: [
            { type: 'primary_roman', text: 'Mookajjiya Kanasugalu' },
            { type: 'translation_candidate', text: "Mookajji's Dreams" },
          ] }],
          authors: [{ proposals: [
            { type: 'primary_roman', text: 'Kota Shivarama Karantha' },
          ] }],
        },
      },
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
    const requestBody = JSON.stringify(generateContent.mock.calls[0]);
    expect(requestBody).toContain('multilingual_search_enrichment');
    expect(requestBody).not.toContain('analysis_reference');
    expect(requestBody).not.toContain('maxItems\":300');
  });

  it('rejects malformed compact enrichment without invalidating vision', async () => {
    const { analyzer } = analyzerFor({
      vision: providerVision,
      multilingual_search_enrichment: [{
        observation_ordinal: 1,
        title: {
          source_language: 'kn',
          source_script: 'Knda',
          title_romanization: 'Mookajjiya Kanasugalu',
          english_translation_candidate: null,
        },
        authors: [{
          author_ordinal: 6,
          source_language: 'kn',
          source_script: 'Knda',
          author_romanization: 'Missing Author',
        }],
      }],
    });
    await expect(analyzer.analyzeWithCompanion(request)).resolves.toMatchObject({
      vision: { imageOutcome: 'analyzed' },
      searchVariantProposals: {
        status: 'rejected', value: null, reason: 'schema_invalid',
      },
    });
  });

  it.each([
    ['duplicate', [1, 1]],
    ['dangling', [2]],
  ])('rejects %s enrichment author ordinals without invalidating vision', async (
    _label,
    ordinals,
  ) => {
    const { analyzer } = analyzerFor({
      vision: providerVision,
      multilingual_search_enrichment: [{
        observation_ordinal: 1,
        title: null,
        authors: ordinals.map((authorOrdinal) => ({
          author_ordinal: authorOrdinal,
          source_language: 'kn',
          source_script: 'Knda',
          author_romanization: 'Kota Shivarama Karantha',
        })),
      }],
    });
    await expect(analyzer.analyzeWithCompanion(request)).resolves.toMatchObject({
      vision: { imageOutcome: 'analyzed' },
      searchVariantProposals: {
        status: 'rejected', value: null, reason: 'schema_invalid',
      },
    });
  });

  it.each([
    ['missing', undefined],
    ['empty', []],
    ['malformed', [{ unexpected: true }]],
    ['oversized', Array.from({ length: 16 }, (_, index) => ({
      observation_ordinal: index + 1,
      title: null,
      authors: [],
    }))],
  ])('keeps ordinary vision successful when compact enrichment is %s', async (_label, enrichment) => {
    const body = enrichment === undefined
      ? { vision: providerVision }
      : { vision: providerVision, multilingual_search_enrichment: enrichment };
    const { analyzer, generateContent } = analyzerFor(body);
    const result = await analyzer.analyzeWithCompanion(request);
    expect(result.vision.imageOutcome).toBe('analyzed');
    expect(result.searchVariantProposals.status).not.toBe('accepted');
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('rejects direct legacy p9-vision-v2 provider output', async () => {
    const { analyzer } = analyzerFor(providerVision);
    await expect(analyzer.analyzeWithCompanion(request)).rejects.toMatchObject({
      code: 'P9_VISION_SCHEMA_INVALID',
      classification: 'schema_invalid',
    });
  });
});

describe('Phase 9 Unit 5C-3 worker persistence handoff', () => {
  it('routes an accepted companion through M18/M19 and persists no raw provider response', async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce({
        data: [{
          id: '94000000-0000-4000-8000-000000000001',
          attempt_count: 1,
          lease_token: 'a'.repeat(64),
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
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
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { outcome: 'accepted', candidate_count: 1, proposal_count: 3 },
        error: null,
      });
    const accepted = parseSearchVariantProposalSidecar(kannadaVariantSidecar);
    const vision = parseSpineAnalysisResult(visionOne);
    const accept = jest.fn();
    const analyzeClaim = jest.fn().mockResolvedValue({
      result: vision,
      providerAttemptId: 'attempt-1',
      searchVariantProposals: { status: 'accepted', value: accepted },
      accept,
      reject: jest.fn(),
    });
    await runVisionAnalysisWorker(
      { contractVersion: 'phase9-v1', leaseOwner: 'vision-worker-0000000001', batchSize: 1 },
      { rpc },
      { analyze: async () => vision, analyzeClaim } as any,
    );
    expect(rpc).toHaveBeenNthCalledWith(
      3,
      'phase9_persist_vision_analysis_with_variants',
      expect.objectContaining({
        p_variants: expect.objectContaining({
          proposal_schema_version: 'search_variant_proposals_v1',
        }),
      }),
    );
    expect(JSON.stringify(rpc.mock.calls[2])).not.toContain('raw_provider');
    expect(accept).toHaveBeenCalledTimes(1);
  });

  it('routes a rejected companion through ordinary vision persistence only', async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce({
        data: [{
          id: '94000000-0000-4000-8000-000000000001',
          attempt_count: 1,
          lease_token: 'a'.repeat(64),
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
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
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { outcome: 'accepted', candidate_count: 1 },
        error: null,
      });
    const vision = parseSpineAnalysisResult(visionOne);
    const analyzeClaim = jest.fn().mockResolvedValue({
      result: vision,
      providerAttemptId: 'attempt-1',
      searchVariantProposals: {
        status: 'rejected',
        value: null,
        reason: 'schema_invalid',
      },
      accept: jest.fn(),
      reject: jest.fn(),
    });
    await runVisionAnalysisWorker(
      { contractVersion: 'phase9-v1', leaseOwner: 'vision-worker-0000000001', batchSize: 1 },
      { rpc },
      { analyze: async () => vision, analyzeClaim } as any,
    );
    expect(rpc).toHaveBeenNthCalledWith(
      3,
      'phase9_persist_vision_analysis',
      expect.not.objectContaining({ p_variants: expect.anything() }),
    );
  });
});
