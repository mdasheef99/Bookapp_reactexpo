import {
  createSpineAnalysisRequest,
  parseSpineAnalysisResult,
} from '../_shared/imageInventory/contracts';
import {
  observation,
  visionActiveContent,
  visionEnvelope,
  visionFifteen,
  visionNoBooks,
  visionOne,
  visionPromptInjection,
  visionQualityRejected,
  visionRequestInput,
  visionTooMany,
} from './fixtures/phase9/visionFixtures';

describe('Phase 9 p9-vision-v2 canonical contract', () => {
  it('V4-C01/C02/C03 accepts coherent zero, one, fifteen, and over-limit envelopes', () => {
    expect(parseSpineAnalysisResult(visionNoBooks).detectedVisibleBookCount).toBe(0);
    expect(parseSpineAnalysisResult(visionOne).observations).toHaveLength(1);
    expect(parseSpineAnalysisResult(visionFifteen).observations).toHaveLength(15);
    expect(parseSpineAnalysisResult(visionTooMany)).toMatchObject({
      imageOutcome: 'too_many_books',
      detectedVisibleBookCount: 16,
      observations: [],
    });
    expect(parseSpineAnalysisResult(visionQualityRejected).detectedVisibleBookCount).toBeNull();
  });

  it('creates an authority-free request using only the opaque sanitized media reference', () => {
    const request = createSpineAnalysisRequest(visionRequestInput);
    expect(request).toMatchObject({
      contractVersion: 'p9-contract-v1',
      schemaVersion: 'p9-vision-v2',
      maxVisibleBooks: 15,
      expectedLanguage: 'en',
    });
    expect(request).not.toHaveProperty('storeId');
    expect(request).not.toHaveProperty('storagePath');
    expect(request).not.toHaveProperty('signedUrl');
  });

  it('V4-C04 rejects count/coherence mismatches and unknown outcomes or keys', () => {
    expect(() => parseSpineAnalysisResult({
      ...visionOne, detected_visible_book_count: 2,
    })).toThrow(/observation length/i);
    expect(() => parseSpineAnalysisResult({
      ...visionOne, image_outcome: 'accepted',
    })).toThrow(/unsupported image outcome/i);
    expect(() => parseSpineAnalysisResult({
      ...visionOne, provider_request_id: 'secret',
    })).toThrow(/unknown keys/i);
  });

  it('V4-C05 rejects missing, duplicate, unordered, or noncontiguous ordinals', () => {
    expect(() => parseSpineAnalysisResult(visionEnvelope([
      observation(2),
    ]))).toThrow(/ordered from 1/i);
    expect(() => parseSpineAnalysisResult(visionEnvelope([
      observation(1), observation(1),
    ]))).toThrow(/ordered from 1/i);
    expect(() => parseSpineAnalysisResult(visionEnvelope([
      observation(2), observation(1),
    ]))).toThrow(/ordered from 1/i);
  });

  it('V4-C06 rejects non-finite/out-of-range confidence and geometry', () => {
    expect(() => parseSpineAnalysisResult(visionEnvelope([
      observation(1, { confidence: Number.NaN }),
    ]))).toThrow(/finite number/i);
    expect(() => parseSpineAnalysisResult(visionEnvelope([
      observation(1, { geometry: { x: 0.9, y: 0, width: 0.2, height: 1, rotation: 0 } }),
    ]))).toThrow(/outside the normalized image/i);
  });

  it.each(visionActiveContent)('V4-C07 rejects active content throughout evidence', (fixture) => {
    expect(() => parseSpineAnalysisResult(fixture)).toThrow(/active or operational content/i);
  });

  it.each([
    { field: 'title', value: { title_guess: '/private/scan.webp' } },
    { field: 'author', value: { author_guesses: ['\\\\server\\share\\scan.webp'] } },
    { field: 'publisher', value: { publisher_clue: 'C:\\private\\scan.webp' } },
    { field: 'traversal', value: { title_guess: '../../private/scan.webp' } },
  ])('rejects $field path-shaped canonical evidence', ({ value }) => {
    expect(() => parseSpineAnalysisResult(visionEnvelope([
      observation(1, value),
    ]))).toThrow(/active or operational content/i);
  });

  it('accepts ordinary punctuation and slash prose that is not path-shaped', () => {
    expect(parseSpineAnalysisResult(visionEnvelope([
      observation(1, {
        title_guess: 'War/Peace: Notes & Essays',
        author_guesses: ['A/B Collective'],
        publisher_clue: 'Books/Ideas Press',
      }),
    ])).observations[0].titleGuess).toBe('War/Peace: Notes & Essays');
  });

  it('rejects authority/tool/provider fields recursively and the full payload above 256 KiB', () => {
    expect(() => parseSpineAnalysisResult({
      ...visionOne,
      observations: [{ ...visionOne.observations[0], tool_call: { name: 'write_inventory' } }],
    })).toThrow(/unknown keys/i);
    expect(() => parseSpineAnalysisResult({
      ...visionOne, store_id: '92000000-0000-0000-0000-000000000001',
    })).toThrow(/unknown keys/i);
    expect(() => parseSpineAnalysisResult({
      ...visionOne, warning_codes: ['x'.repeat(262145)],
    })).toThrow(/exceeds 262144 bytes/i);
    expect(() => parseSpineAnalysisResult(visionPromptInjection)).toThrow(/active or operational content/i);
  });

  it('accepts publisher clues, nullable titles, und language, and closed warnings only', () => {
    const parsed = parseSpineAnalysisResult(visionEnvelope([
      observation(1, {
        title_guess: null,
        detected_language: 'und',
        warning_codes: ['low_contrast'],
      }),
    ]));
    expect(parsed.observations[0]).toMatchObject({
      titleGuess: null,
      publisherClue: 'Fixture Publisher 1',
      detectedLanguage: 'und',
    });
    expect(() => parseSpineAnalysisResult(visionEnvelope([
      observation(1, { warning_codes: ['provider said maybe'] }),
    ]))).toThrow(/unsupported warning/i);
  });
});
