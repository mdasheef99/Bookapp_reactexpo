import {
  GeminiSpineImageAnalyzer,
} from '../_shared/imageInventory/analysis/geminiSpineImageAnalyzer';
import { createSpineAnalysisRequest } from '../_shared/imageInventory/contracts';
import { visionRequestInput } from './fixtures/phase9/visionFixtures';
import { runVisionAnalysisWorker } from '../_shared/imageInventory/runtime/visionAnalysisWorker';

const request = createSpineAnalysisRequest({
  ...visionRequestInput,
  adapterKey: 'gemini_vision',
  adapterVersion: '1.0.0',
  promptVersion: 'gemini-spine-v1',
});
const claim = {
  jobId: '94000000-0000-4000-8000-000000000001',
  leaseOwner: 'vision-worker-0000000001',
  leaseToken: 'a'.repeat(64),
  attemptNumber: 1,
};

describe('Phase 9 Gemini final egress fence', () => {
  it('registers and validates the current claim before download and provider invocation', async () => {
    const order: string[] = [];
    const generateContent = jest.fn(async () => {
      order.push('provider');
      return {
        text: JSON.stringify({
          image_outcome: 'no_books',
          detected_visible_book_count: 0,
          observations: [],
          warning_codes: [],
        }),
        responseId: 'provider-request-1',
        usageMetadata: { totalTokenCount: 2 },
      };
    });
    const analyzer = new GeminiSpineImageAnalyzer({
      client: { models: { generateContent } },
      modelId: 'gemini-3.5-flash-lite',
      timeoutMs: 10_000,
      providerAttempts: {
        register: jest.fn(async () => {
          order.push('register');
          return { attemptId: 'attempt-1', mediaAuthorization: 'authorization-1' };
        }),
        finalize: jest.fn(async () => { order.push('finalize'); }),
        mark: jest.fn(async () => { order.push('mark'); }),
      },
      resolveMedia: jest.fn(async (_request, authorization) => {
        expect(authorization).toBe('authorization-1');
        order.push('download');
        return { bytes: new Uint8Array([1]), mimeType: 'image/webp' as const };
      }),
    });
    const completed = await analyzer.analyzeClaim(request, claim);
    expect(completed.providerAttemptId).toBe('attempt-1');
    expect(order).toEqual(['register', 'download', 'provider', 'finalize']);
  });

  it('performs zero download and provider calls when final claim validation fails', async () => {
    const resolveMedia = jest.fn();
    const generateContent = jest.fn();
    const analyzer = new GeminiSpineImageAnalyzer({
      client: { models: { generateContent } },
      modelId: 'gemini-3.5-flash-lite',
      timeoutMs: 10_000,
      providerAttempts: {
        register: jest.fn().mockRejectedValue(new Error('P9_STATE_CONFLICT')),
        finalize: jest.fn(),
        mark: jest.fn(),
      },
      resolveMedia,
    });
    await expect(analyzer.analyzeClaim(request, claim)).rejects.toMatchObject({
      code: 'P9_VISION_MEDIA_UNAVAILABLE',
    });
    expect(resolveMedia).not.toHaveBeenCalled();
    expect(generateContent).not.toHaveBeenCalled();
  });
});

describe('Phase 9 provider-attempt completion fencing', () => {
  const context = {
    contract_version: 'p9-contract-v1',
    schema_version: 'p9-vision-v2',
    pipeline_version: 'phase9-v1',
    prompt_version: 'gemini-spine-v1',
    adapter_key: 'gemini_vision',
    adapter_version: '1.0.0',
    job_reference: request.jobReference,
    correlation_id: request.correlationId,
    expected_language: 'en',
    sanitized_media_reference: request.sanitizedMediaReference,
  };
  const result = {
    contractVersion: request.contractVersion,
    schemaVersion: request.schemaVersion,
    pipelineVersion: request.pipelineVersion,
    promptVersion: request.promptVersion,
    adapterKey: request.adapterKey,
    adapterVersion: request.adapterVersion,
    jobReference: request.jobReference,
    attemptNumber: request.attemptNumber,
    correlationId: request.correlationId,
    expectedLanguage: request.expectedLanguage,
    providerKey: 'google_gemini',
    modelKey: 'gemini-3.5-flash-lite',
    modelVersion: 'gemini-3.5-flash-lite',
    receivedAt: '2026-07-27T12:00:00.000Z',
    imageOutcome: 'no_books' as const,
    detectedVisibleBookCount: 0,
    observations: [],
    warningCodes: [],
  };

  it('associates only after the analysis result is durably accepted', async () => {
    const accept = jest.fn();
    const reject = jest.fn();
    const analyzer = {
      analyze: jest.fn(),
      analyzeClaim: jest.fn().mockResolvedValue({
        result, providerAttemptId: 'attempt-1', accept, reject,
      }),
    };
    const rpc = jest.fn()
      .mockResolvedValueOnce({
        data: [{
          id: claim.jobId,
          attempt_count: claim.attemptNumber,
          lease_token: claim.leaseToken,
        }],
        error: null,
      })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({
        data: { outcome: 'no_books', candidate_count: 0 },
        error: null,
      });
    await runVisionAnalysisWorker({
      contractVersion: 'phase9-v1',
      leaseOwner: claim.leaseOwner,
      batchSize: 1,
    }, { rpc }, analyzer);
    expect(accept).toHaveBeenCalledTimes(1);
    expect(reject).not.toHaveBeenCalled();
  });

  it('marks a stale completion and never associates it as accepted', async () => {
    const accept = jest.fn();
    const reject = jest.fn();
    const analyzer = {
      analyze: jest.fn(),
      analyzeClaim: jest.fn().mockResolvedValue({
        result, providerAttemptId: 'attempt-1', accept, reject,
      }),
    };
    const rpc = jest.fn()
      .mockResolvedValueOnce({
        data: [{
          id: claim.jobId,
          attempt_count: claim.attemptNumber,
          lease_token: claim.leaseToken,
        }],
        error: null,
      })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'P9_STATE_CONFLICT' } });
    await runVisionAnalysisWorker({
      contractVersion: 'phase9-v1',
      leaseOwner: claim.leaseOwner,
      batchSize: 1,
    }, { rpc }, analyzer);
    expect(accept).not.toHaveBeenCalled();
    expect(reject).toHaveBeenCalledWith('stale_rejected', 'completion_stale');
  });
});
