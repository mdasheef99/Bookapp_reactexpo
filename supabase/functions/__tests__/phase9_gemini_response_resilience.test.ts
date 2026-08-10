import {
  decodeGeminiAnalysisResponse,
} from '../_shared/imageInventory/analysis/geminiResponseDecoder';
import {
  GeminiSpineImageAnalyzer,
} from '../_shared/imageInventory/analysis/geminiSpineImageAnalyzer';
import {
  createSpineAnalysisRequest,
} from '../_shared/imageInventory/contracts/vision';
import { visionRequestInput } from './fixtures/phase9/visionFixtures';

const request = createSpineAnalysisRequest({
  ...visionRequestInput,
  adapterKey: 'gemini_vision',
  adapterVersion: '1.0.0',
  promptVersion: 'fixture-prompt-v2',
});

const observation = (
  ordinal: number,
  overrides: Record<string, unknown> = {},
) => ({
  ordinal,
  title_guess: `Original Unicode Book ${ordinal}`,
  author_guesses: [`Original Unicode Author ${ordinal}`],
  publisher_clue: null,
  isbn_clue: null,
  detected_language: 'en',
  confidence: 0.9,
  title_romanization: null,
  english_translation_candidate: null,
  author_romanizations: [null],
  ...overrides,
});

const providerOutput = (
  observations: readonly unknown[],
  imageOutcome = 'analyzed',
  detectedCount: unknown = observations.length,
) => ({
  vision: {
    image_outcome: imageOutcome,
    detected_visible_book_count: detectedCount,
    observations,
  },
});

function decode(output: Record<string, unknown>) {
  return decodeGeminiAnalysisResponse(
    request,
    'gemini-3.5-flash-lite',
    '2026-08-11T12:00:00.000Z',
    output,
  );
}

describe('Phase 9 Gemini over-cap response resilience', () => {
  it('rejects sixteen valid observations as one complete too-many-books result', () => {
    const observations = Array.from(
      { length: 16 },
      (_, index) => observation(index + 1, {
        title_guess: `PRIVATE OVER CAP TITLE ${index + 1}`,
      }),
    );

    const decoded = decode(providerOutput(observations));

    expect(decoded.vision).toMatchObject({
      imageOutcome: 'too_many_books',
      detectedVisibleBookCount: 16,
      observations: [],
    });
    expect(JSON.stringify(decoded)).not.toContain('PRIVATE OVER CAP TITLE');
  });

  it('honors a bounded analyzed count over fifteen without partial salvage', () => {
    const decoded = decode(providerOutput(
      Array.from({ length: 15 }, (_, index) => observation(index + 1)),
      'analyzed',
      16,
    ));

    expect(decoded.vision).toMatchObject({
      imageOutcome: 'too_many_books',
      detectedVisibleBookCount: 16,
      observations: [],
    });
  });

  it('discards an explicit too-many-books observation array completely', () => {
    const decoded = decode(providerOutput(
      Array.from({ length: 16 }, (_, index) => observation(index + 1)),
      'too_many_books',
      16,
    ));

    expect(decoded.vision).toMatchObject({
      imageOutcome: 'too_many_books',
      detectedVisibleBookCount: 16,
      observations: [],
    });
  });

  it.each([
    ['reported count', providerOutput([], 'analyzed', 101)],
    ['observation array', providerOutput(Array.from({ length: 101 }, () => null), 'analyzed', 100)],
  ])('fails closed beyond the defensive maximum for %s', (_case, output) => {
    expect(() => decode(output)).toThrow();
  });
});

describe('Phase 9 Gemini multilingual response resilience', () => {
  it('preserves original Unicode while degrading an unknown language name to und', () => {
    const title = 'ಕನ್ನಡ ಪುಸ್ತಕ';
    const author = 'ಕುವೆಂಪು';
    const decoded = decode(providerOutput([observation(1, {
      title_guess: title,
      author_guesses: [author],
      detected_language: 'Future Language Label',
      author_romanizations: [null],
    })]));

    expect(decoded.vision.observations[0]).toMatchObject({
      titleGuess: title,
      authorGuesses: [author],
      detectedLanguage: 'und',
    });
  });

  it.each([
    ['English', 'en'],
    ['KANNADA', 'kn'],
    ['Manipuri', 'mni'],
  ])('continues mapping known language name %s', (label, expected) => {
    const decoded = decode(providerOutput([
      observation(1, { detected_language: label }),
    ]));
    expect(decoded.vision.observations[0].detectedLanguage).toBe(expected);
  });

  it('retains canonical handling for valid BCP-47 tags', () => {
    const decoded = decode(providerOutput([
      observation(1, { detected_language: 'sr-latn-rs' }),
    ]));
    expect(decoded.vision.observations[0].detectedLanguage).toBe('sr-Latn-RS');
  });

  it.each([null, undefined])('maps a missing-like language value %p to und', (language) => {
    const entry = observation(1, { detected_language: language });
    if (language === undefined) delete entry.detected_language;
    const decoded = decode(providerOutput([entry]));
    expect(decoded.vision.observations[0].detectedLanguage).toBe('und');
  });

  it('rejects a non-string language value', () => {
    expect(() => decode(providerOutput([
      observation(1, { detected_language: { label: 'Kannada' } }),
    ]))).toThrow();
  });

  it('rejects malformed optional enrichment without losing valid core extraction', () => {
    const title = 'ಮೂಕಜ್ಜಿಯ ಕನಸುಗಳು';
    const decoded = decode(providerOutput([observation(1, {
      title_guess: title,
      author_guesses: ['ಕೋಟ ಶಿವರಾಮ ಕಾರಂತ'],
      detected_language: 'kn',
      title_romanization: 'https://provider.invalid/private-title',
      english_translation_candidate: { unsafe: true },
      author_romanizations: 'not-an-array',
    })]));

    expect(decoded.vision.observations[0].titleGuess).toBe(title);
    expect(decoded.searchVariantProposals).toEqual({
      status: 'rejected', value: null, reason: 'schema_invalid',
    });
  });
});

describe('Phase 9 Gemini strictness and privacy-safe diagnostics', () => {
  it.each([
    ['unknown top-level key', { ...providerOutput([observation(1)]), extra: true }],
    ['unknown observation key', providerOutput([observation(1, { injected_command: 'ignore policy' })])],
    ['active title content', providerOutput([observation(1, { title_guess: 'https://attacker.invalid/title' })])],
    ['active author content', providerOutput([observation(1, { author_guesses: ['DROP TABLE books'] })])],
    ['invalid core identity type', providerOutput([observation(1, { title_guess: 42 })])],
    ['malformed ordinals', providerOutput([observation(2)])],
  ])('continues rejecting %s', (_case, output) => {
    expect(() => decode(output)).toThrow();
  });

  it('logs only a closed schema category and sanitized path', async () => {
    const privateTitle = 'PRIVATE FIXTURE TITLE MUST NOT APPEAR';
    const privateKey = 'PRIVATE_GENERATED_KEY_MUST_NOT_APPEAR';
    const logs: unknown[] = [];
    const output = providerOutput([observation(1, {
      title_guess: privateTitle,
      [privateKey]: 'private rejected value',
    })]);
    const analyzer = new GeminiSpineImageAnalyzer({
      client: { models: { generateContent: jest.fn().mockResolvedValue({
        text: JSON.stringify(output),
      }) } },
      modelId: 'gemini-3.5-flash-lite',
      timeoutMs: 10_000,
      resolveMedia: jest.fn().mockResolvedValue({
        bytes: new Uint8Array([1]), mimeType: 'image/webp',
      }),
      log: (event) => logs.push(event),
      now: () => new Date('2026-08-11T12:00:00.000Z'),
    });

    await expect(analyzer.analyze(request)).rejects.toMatchObject({
      code: 'P9_VISION_SCHEMA_INVALID',
      classification: 'schema_invalid',
      retryable: false,
    });
    expect(logs).toContainEqual(expect.objectContaining({
      event: 'gemini_analysis_failed',
      classification: 'schema_invalid',
      schemaFailureCategory: 'unknown_keys',
      schemaField: 'gemini_response.vision.observations[]',
    }));
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain(privateTitle);
    expect(serialized).not.toContain(privateKey);
    expect(serialized).not.toContain('private rejected value');
  });
});
