import { createHash } from 'node:crypto';
import {
  GEMINI_VISION_RESPONSE_SCHEMA,
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
  geometry: null,
  warning_codes: [],
});

const output = (
  observations: readonly unknown[],
  imageOutcome = 'analyzed',
  count: number | null = observations.length,
) => ({
  image_outcome: imageOutcome,
  detected_visible_book_count: count,
  observations,
  warning_codes: [],
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
    }),
    log: (event) => logs.push(event),
    now: () => new Date('2026-07-27T12:00:00.000Z'),
    ...overrides,
  });
  return { analyzer, generateContent, usage, logs };
}

describe('Phase 9 Gemini spine-image analyzer', () => {
  it('maps sanitized image input and a strict structured-output schema for multiple books', async () => {
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
        responseJsonSchema: GEMINI_VISION_RESPONSE_SCHEMA,
        tools: undefined,
      }),
    }));
  });

  it('normalizes empty, language-mismatch, and over-15 responses without changing policy', async () => {
    const empty = setup({ text: JSON.stringify(output([], 'no_books', 0)) });
    await expect(empty.analyzer.analyze(request)).resolves.toMatchObject({
      imageOutcome: 'no_books', observations: [],
    });

    const mismatch = setup({ text: JSON.stringify(output([observation(1, 'hi-Deva')])) });
    const mismatchResult = await mismatch.analyzer.analyze(request);
    expect(evaluateVisionResult(mismatchResult)).toMatchObject({
      outcome: 'language_mismatch', candidates: [],
    });

    const over = setup({ text: JSON.stringify(output([], 'too_many_books', 16)) });
    const overResult = await over.analyzer.analyze(request);
    expect(evaluateVisionResult(overResult)).toMatchObject({
      outcome: 'over_visible_book_limit', candidates: [],
    });
  });

  it.each([
    ['malformed_response', { text: '{"observations":' }],
    ['schema_invalid', { text: JSON.stringify({ ...output([observation(1)]), extra: true }) }],
    ['schema_invalid', { text: JSON.stringify(output([observation(2)])) }],
  ])('classifies %s output without retaining raw response data', async (classification, response) => {
    const { analyzer } = setup(response);
    await expect(analyzer.analyze(request)).rejects.toMatchObject({
      code: 'P9_VISION_SCHEMA_INVALID',
      classification,
      retryable: false,
    });
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
    }]);
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
  it('maps only a matching claimed-job opaque reference to private sanitized bytes', async () => {
    const jobId = '92000000-0000-0000-0000-000000000401';
    const mediaId = '92000000-0000-0000-0000-000000000402';
    const mediaReference = `media_${createHash('sha256')
      .update(`${mediaId}:${jobId}`).digest('hex').slice(0, 48)}`;
    const rows: Record<string, unknown> = {
      image_extraction_jobs: {
        id: jobId,
        entity_id: '92000000-0000-0000-0000-000000000403',
        store_id: '92000000-0000-0000-0000-000000000404',
        job_kind: 'vision_extract',
        status: 'in_progress',
        correlation_id: request.correlationId,
      },
      image_extraction_inputs: {
        id: '92000000-0000-0000-0000-000000000403',
        media_asset_id: mediaId,
        store_id: '92000000-0000-0000-0000-000000000404',
      },
      media_assets: {
        id: mediaId,
        store_id: '92000000-0000-0000-0000-000000000404',
        bucket_id: 'private-sanitized-fixture',
        object_path: 'private/sanitized-fixture.webp',
        detected_mime: 'image/webp',
        purpose: 'scan_input',
        privacy_class: 'private_scan',
        lifecycle_status: 'linked',
        validated_at: '2026-07-27T12:00:00.000Z',
      },
    };
    let selectedTable = '';
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn(() => query),
      single: jest.fn(async () => ({ data: rows[selectedTable], error: null })),
    };
    const download = jest.fn(async () => ({
      data: new Blob([image.bytes], { type: 'image/webp' }),
      error: null,
    }));
    const client = {
      from: jest.fn((table: string) => {
        selectedTable = table;
        return query;
      }),
      storage: { from: jest.fn(() => ({ download })) },
    };
    const resolver = createSupabaseVisionMediaResolver(client);
    const resolverRequest = createSpineAnalysisRequest({
      ...visionRequestInput,
      sanitizedMediaReference: mediaReference,
    });

    await expect(resolver(resolverRequest)).resolves.toEqual(image);
    expect(download).toHaveBeenCalledWith('private/sanitized-fixture.webp');
    await expect(resolver(request)).rejects.toThrow('P9_VISION_MEDIA_UNAVAILABLE');
  });
});
