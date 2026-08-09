import {
  GeminiAnalyzerError,
  GeminiSpineImageAnalyzer,
  GeminiUsageEvidence,
} from '../_shared/imageInventory/analysis/geminiSpineImageAnalyzer';
import { createSpineAnalysisRequest } from '../_shared/imageInventory/contracts';
import { evaluateVisionResult } from '../_shared/imageInventory/domain/visionPolicy';
import {
  createSupabaseVisionMediaResolver,
} from '../../../workers/phase9-vision-analysis-worker/supabaseVisionMediaResolver';
import { visionRequestInput } from './fixtures/phase9/visionFixtures';

const request = createSpineAnalysisRequest({
  ...visionRequestInput,
  adapterKey: 'gemini_vision',
  adapterVersion: '1.0.0',
  promptVersion: 'gemini-spine-v1',
});

const image = {
  bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x01, 0x02, 0x03]),
  mimeType: 'image/webp' as const,
};

const observation = (ordinal: number, language = 'en') => ({
  ordinal,
  title_guess: `Sanitized Book ${ordinal}`,
  author_guesses: [`Sanitized Author ${ordinal}`],
  publisher_clue: null,
  isbn_clue: null,
  detected_language: language,
  confidence: 0.9,
  title_romanization: null,
  english_translation_candidate: null,
  author_romanizations: [null],
});

const output = (
  observations: readonly unknown[],
  imageOutcome = 'analyzed',
  count: number | null = observations.length,
) => ({
  vision: {
    image_outcome: imageOutcome,
    detected_visible_book_count: count,
    observations,
  },
});

function setup(response: unknown, overrides: Record<string, unknown> = {}) {
  const generateContent = jest.fn().mockResolvedValue(response);
  const usage: GeminiUsageEvidence[] = [];
  const logs: unknown[] = [];
  const analyzer = new GeminiSpineImageAnalyzer({
    client: { models: { generateContent } },
    modelId: 'gemini-3.5-flash-lite',
    timeoutMs: 10_000,
    resolveMedia: jest.fn().mockResolvedValue(image),
    recordUsage: (evidence) => usage.push(evidence),
    calculateCostUnits: (evidence) => ({
      costUnits: evidence.totalTokens / 1_000,
      policyVersion: 'mock-cost-policy-v1',
      pricingInput: {
        currency: 'USD',
        input_basis: 'mocked_provider_response',
        pricing_source_version: 'mock-v1',
        input_unit_cost: 0.001,
      },
    }),
    log: (event) => logs.push(event),
    now: () => new Date('2026-07-27T12:00:00.000Z'),
    ...overrides,
  });
  return { analyzer, generateContent, usage, logs };
}

describe('Phase 9 Gemini spine-image analyzer', () => {
  it('maps sanitized image input through simple JSON mode and validates locally', async () => {
    const { analyzer, generateContent } = setup({
      text: JSON.stringify(output([observation(1), observation(2)])),
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 },
    });

    await expect(analyzer.analyze(request)).resolves.toMatchObject({
      providerKey: 'google_gemini',
      modelKey: 'gemini-3.5-flash-lite',
      modelVersion: 'gemini-3.5-flash-lite',
      adapterKey: 'gemini_vision',
      adapterVersion: '1.0.0',
      promptVersion: 'gemini-spine-v1',
      schemaVersion: 'p9-vision-v2',
      observations: [{ ordinal: 1 }, { ordinal: 2 }],
    });
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3.5-flash-lite',
      contents: [{
        role: 'user',
        parts: [
          expect.objectContaining({ text: expect.any(String) }),
          { inlineData: { mimeType: 'image/webp', data: 'UklGRgECAw==' } },
        ],
      }],
      config: expect.objectContaining({
        responseMimeType: 'application/json',
        tools: undefined,
      }),
    }));
    const config = generateContent.mock.calls[0][0].config;
    const prompt = generateContent.mock.calls[0][0].contents[0].parts[0].text;
    expect(prompt).toContain('Optional language hint: en');
    expect(prompt).toContain('Do not exclude other languages');
    expect(prompt).not.toContain(request.correlationId);
    expect(prompt).not.toContain(request.jobReference);
    expect(config).not.toHaveProperty('temperature');
    expect(config).not.toHaveProperty('candidateCount');
    expect(config).not.toHaveProperty('responseJsonSchema');
    expect(prompt).toContain('title_romanization');
    expect(prompt).toContain('author_romanizations');
    expect(prompt).toContain('english_translation_candidate');
    expect(prompt).not.toContain('multilingual_search_enrichment');
  });

  it('normalizes empty, cross-language, and over-15 responses with language as a hint', async () => {
    const empty = setup({ text: JSON.stringify(output([], 'no_books', 0)) });
    await expect(empty.analyzer.analyze(request)).resolves.toMatchObject({
      imageOutcome: 'no_books', observations: [],
    });

    const mismatch = setup({ text: JSON.stringify(output([observation(1, 'hi-Deva')])) });
    const mismatchResult = await mismatch.analyzer.analyze(request);
    expect(evaluateVisionResult(mismatchResult)).toMatchObject({
      outcome: 'accepted', candidates: [{ detectedLanguage: 'hi-Deva' }],
    });

    const over = setup({ text: JSON.stringify(output([], 'too_many_books', 16)) });
    const overResult = await over.analyzer.analyze(request);
    expect(evaluateVisionResult(overResult)).toMatchObject({
      outcome: 'over_visible_book_limit', candidates: [],
    });
  });

  it('normalizes Gemini JSON-mode success and null detected language', async () => {
    const providerObservation = {
      ...observation(1),
      title_guess: null,
      author_guesses: [],
      detected_language: null,
      confidence: 0.3,
      author_romanizations: [],
    };
    const proof = setup({
      text: JSON.stringify(output([providerObservation], 'success', 1)),
    });

    await expect(proof.analyzer.analyze(request)).resolves.toMatchObject({
      imageOutcome: 'analyzed',
      detectedVisibleBookCount: 1,
      observations: [{ detectedLanguage: 'und' }],
    });
  });

  it.each([
    ['malformed_response', { text: '{"observations":' }],
    ['schema_invalid', { text: JSON.stringify({ ...output([observation(1)]), extra: true }) }],
    ['schema_invalid', { text: JSON.stringify(output([observation(2)])) }],
    ['schema_invalid', { text: JSON.stringify({
      vision: {
        ...output([observation(1)]).vision,
        observations: [{
          ...observation(1),
          author_guesses: ['A', 'B', 'C', 'D', 'E', 'F'],
        }],
      },
    }) }],
    ['schema_invalid', { text: JSON.stringify({
      ...output([observation(1)]),
      search_variant_proposals: { proposals: [] },
    }) }],
  ])('classifies %s output without retaining raw response data', async (classification, response) => {
    const { analyzer } = setup(response);
    await expect(analyzer.analyze(request)).rejects.toMatchObject({
      code: 'P9_VISION_SCHEMA_INVALID',
      classification,
      retryable: false,
    });
  });

  it('logs only bounded provider error evidence', async () => {
    const failure = {
      status: 400,
      requestId: 'gemini-request-17',
      error: {
        code: 400,
        status: 'INVALID_ARGUMENT',
        message: 'private provider body and key-adjacent detail',
      },
    };
    const { analyzer, logs } = setup({}, {
      client: { models: { generateContent: jest.fn().mockRejectedValue(failure) } },
    });
    await expect(analyzer.analyze(request)).rejects.toMatchObject({
      code: 'P9_VISION_ANALYZER_UNAVAILABLE',
      classification: 'provider_error',
      retryable: true,
    });
    expect(logs).toContainEqual(expect.objectContaining({
      event: 'gemini_analysis_failed',
      httpStatus: 400,
      providerErrorCode: 'INVALID_ARGUMENT',
      providerErrorCategory: 'malformed_request',
      providerRequestId: 'gemini-request-17',
      safeMessage: 'provider rejected the request shape',
    }));
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain('private provider body');
    expect(serialized).not.toContain('key-adjacent');
  });

  it('redacts privileged values from bounded provider identifiers', async () => {
    const apiKey = 'AIzaSySecretKeyMaterial123456789';
    const providerCodeSecret = 'PRIVATE_PROVIDER_SECRET_123456789';
    const failure = {
      status: 400,
      requestId: apiKey,
      error: { status: providerCodeSecret },
    };
    const { analyzer, logs } = setup({}, {
      client: { models: { generateContent: jest.fn().mockRejectedValue(failure) } },
      privilegedValues: [apiKey, providerCodeSecret],
    });
    await expect(analyzer.analyze(request)).rejects.toMatchObject({
      code: 'P9_VISION_ANALYZER_UNAVAILABLE',
      classification: 'provider_error',
      retryable: true,
    });
    expect(logs).toContainEqual(expect.objectContaining({
      event: 'gemini_analysis_failed',
      providerErrorCode: null,
      providerRequestId: null,
    }));
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain(apiKey);
    expect(serialized).not.toContain(providerCodeSecret);
  });

  it.each([
    ['timeout', { name: 'AbortError' }, 'P9_VISION_ANALYZER_TIMEOUT'],
    ['rate_limited', { status: 429, message: 'quota with private detail' }, 'P9_VISION_ANALYZER_UNAVAILABLE'],
    ['provider_error', { status: 503, message: 'provider with private detail' }, 'P9_VISION_ANALYZER_UNAVAILABLE'],
  ])('classifies %s provider failures to bounded runtime codes', async (
    classification,
    failure,
    code,
  ) => {
    const generateContent = jest.fn().mockRejectedValue(failure);
    const { analyzer } = setup({}, { client: { models: { generateContent } } });
    await expect(analyzer.analyze(request)).rejects.toMatchObject({
      code,
      classification,
      retryable: true,
    });
  });

  it('extracts bounded usage and injected cost evidence with complete lineage', async () => {
    const { analyzer, usage } = setup({
      text: JSON.stringify(output([observation(1)])),
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 25,
        totalTokenCount: 125,
        cachedContentTokenCount: 5,
        thoughtsTokenCount: 10,
        providerPrivateField: 'ignored',
      },
    });
    await analyzer.analyze(request);
    expect(usage).toEqual([{
      providerKey: 'google_gemini',
      modelId: 'gemini-3.5-flash-lite',
      adapterKey: 'gemini_vision',
      adapterVersion: '1.0.0',
      promptVersion: 'gemini-spine-v1',
      schemaVersion: 'p9-vision-v2',
      promptTokens: 100,
      outputTokens: 25,
      totalTokens: 125,
      cachedTokens: 5,
      thinkingTokens: 10,
      costUnits: 0.125,
      costPolicyVersion: 'mock-cost-policy-v1',
      pricingInput: {
        currency: 'USD',
        input_basis: 'mocked_provider_response',
        pricing_source_version: 'mock-v1',
        input_unit_cost: 0.001,
      },
    }]);
  });

  it.each([
    [{ unknown: 'value' }],
    [{ currency: 'usd', input_basis: 'mock', pricing_source_version: 'v1' }],
    [{ currency: 'USD', input_basis: 'https://pricing.invalid', pricing_source_version: 'v1' }],
    [{ currency: 'USD', input_basis: 'mock', pricing_source_version: 'v1', input_unit_cost: -1 }],
    [{ currency: 'USD', input_basis: 'mock', pricing_source_version: 'v1', input_unit_cost: '1' }],
    [{ currency: 'USD', input_basis: 'mock', pricing_source_version: 'v1', input_unit_cost: 1_000_001 }],
    [{ currency: 'USD', input_basis: 'mock', pricing_source_version: 'x'.repeat(65) }],
  ])('rejects semantically unsafe injected pricing evidence %#', async (pricingInput) => {
    const { analyzer, usage } = setup({
      text: JSON.stringify(output([], 'no_books', 0)),
      usageMetadata: { totalTokenCount: 1 },
    }, {
      calculateCostUnits: () => ({
        costUnits: 0.001,
        policyVersion: 'mock-cost-policy-v1',
        pricingInput,
      }),
    });
    await analyzer.analyze(request);
    expect(usage[0]).toMatchObject({
      costUnits: null,
      costPolicyVersion: null,
      pricingInput: null,
    });
  });

  it('keeps credentials, images, prompts, and raw responses outside logs and errors', async () => {
    const apiKey = 'gemini-private-key-A7z.49_xYp';
    const privateResponse = 'private raw provider response';
    const { analyzer, logs } = setup(
      { text: privateResponse },
      { privilegedValues: [apiKey] },
    );
    let error: unknown;
    try {
      await analyzer.analyze(request);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GeminiAnalyzerError);
    const serialized = JSON.stringify({ logs, error: String(error) });
    expect(serialized).not.toContain(apiKey);
    expect(serialized).not.toContain(privateResponse);
    expect(serialized).not.toContain('UklGRgECAw==');
    expect(serialized).not.toContain('Analyze every visible book spine');
  });
});

describe('Phase 9 Gemini sanitized-media resolver', () => {
  it('downloads only a claim-validated media authorization', async () => {
    const download = jest.fn(async () => ({
      data: new Blob([image.bytes], { type: 'image/webp' }),
      error: null,
    }));
    const client = {
      storage: { from: jest.fn(() => ({ download })) },
    };
    const resolver = createSupabaseVisionMediaResolver(client);
    await expect(resolver(request, {
      mediaBucket: 'private-sanitized-fixture',
      mediaPath: 'private/sanitized-fixture.webp',
      mediaMime: 'image/webp',
    })).resolves.toEqual(image);
    expect(download).toHaveBeenCalledWith('private/sanitized-fixture.webp');
    await expect(resolver(request, {
      mediaBucket: 'private-sanitized-fixture',
      mediaPath: '../private/forged.webp',
      mediaMime: 'image/webp',
    })).rejects.toThrow('P9_VISION_MEDIA_UNAVAILABLE');
  });
});
