import { decodeGeminiAnalysisResponse } from '../_shared/imageInventory/analysis/geminiResponseDecoder';
import { createSpineAnalysisRequest } from '../_shared/imageInventory/contracts/vision';

test('diagnoses the real simplified Gemini payload', () => {
  const request = createSpineAnalysisRequest({
    pipelineVersion: 'phase9-v1',
    promptVersion: 'fixture-prompt-v2',
    adapterKey: 'google_gemini',
    adapterVersion: 'phase9-gemini-v1',
    jobReference: 'job_8bf664bb5afa41f7ad2cd86d9b2de2e8',
    attemptNumber: 5,
    correlationId: '8bf664bb-5afa-41f7-ad2c-d86d9b2de2e8',
    requestedAt: '2026-08-09T18:38:03.015Z',
    expectedLanguage: 'en',
    sanitizedMediaReference: 'media_cfc95938edce49449b55d5659e8548f9',
  });
  const providerOutput = {
    vision: {
      image_outcome: 'success',
      detected_visible_book_count: 8,
      observations: [
        { ordinal: 1, title_guess: 'The Black Swan', author_guesses: ['Nassim Nicholas Taleb'], publisher_clue: 'Penguin', isbn_clue: null, detected_language: 'en', confidence: 0.95, title_romanization: null, english_translation_candidate: null, author_romanizations: [null] },
        { ordinal: 2, title_guess: 'A Hundred Years of Philosophy', author_guesses: ['John Passmore'], publisher_clue: null, isbn_clue: '0 14 02 0927 1', detected_language: 'en', confidence: 0.95, title_romanization: null, english_translation_candidate: null, author_romanizations: [null] },
        { ordinal: 3, title_guess: 'False Dawn', author_guesses: ['John Gray'], publisher_clue: null, isbn_clue: null, detected_language: 'en', confidence: 0.95, title_romanization: null, english_translation_candidate: null, author_romanizations: [null] },
        { ordinal: 4, title_guess: 'Antifragile', author_guesses: ['Nassim Nicholas Taleb'], publisher_clue: 'Random House', isbn_clue: null, detected_language: 'en', confidence: 0.95, title_romanization: null, english_translation_candidate: null, author_romanizations: [null] },
        { ordinal: 5, title_guess: 'Concise Encyclopedia of Western Philosophy & Philosophers', author_guesses: ['J. O. Urmson', 'Jonathan Rée'], publisher_clue: 'Routledge', isbn_clue: null, detected_language: 'en', confidence: 0.9, title_romanization: null, english_translation_candidate: null, author_romanizations: [null, null] },
        { ordinal: 6, title_guess: 'Charles Peirce', author_guesses: ['Knight'], publisher_clue: null, isbn_clue: null, detected_language: 'en', confidence: 0.85, title_romanization: null, english_translation_candidate: null, author_romanizations: [null] },
        { ordinal: 7, title_guess: 'Unended Quest', author_guesses: ['Karl Popper'], publisher_clue: null, isbn_clue: null, detected_language: 'en', confidence: 0.95, title_romanization: null, english_translation_candidate: null, author_romanizations: [null] },
        { ordinal: 8, title_guess: null, author_guesses: [], publisher_clue: null, isbn_clue: null, detected_language: null, confidence: 0.2, title_romanization: null, english_translation_candidate: null, author_romanizations: [] },
      ],
    },
  };

  expect(() => decodeGeminiAnalysisResponse(
    request,
    'gemini-3.5-flash-lite',
    '2026-08-09T18:38:07.427Z',
    providerOutput,
  )).not.toThrow();
});

test('projects harmless Gemini JSON variation into the canonical contract', () => {
  const request = createSpineAnalysisRequest({
    pipelineVersion: 'phase9-v1',
    promptVersion: 'fixture-prompt-v2',
    adapterKey: 'google_gemini',
    adapterVersion: 'phase9-gemini-v1',
    jobReference: 'job_8bf664bb5afa41f7ad2cd86d9b2de2e8',
    attemptNumber: 5,
    correlationId: '8bf664bb-5afa-41f7-ad2c-d86d9b2de2e8',
    requestedAt: '2026-08-09T18:38:03.015Z',
    expectedLanguage: 'en',
    sanitizedMediaReference: 'media_cfc95938edce49449b55d5659e8548f9',
  });

  const decoded = decodeGeminiAnalysisResponse(
    request,
    'gemini-3.5-flash-lite',
    '2026-08-09T18:38:07.427Z',
    {
      vision: {
        image_outcome: 'success',
        detected_visible_book_count: 2,
        observations: [{
          ordinal: 1,
          title_guess: 'A Hundred Years of Philosophy',
          author_guesses: ['John Passmore'],
          publisher_clue: null,
          isbn_clue: 'ISBN 0-14-02-0927-1',
          detected_language: 'English',
          confidence: 0.95,
          title_romanization: null,
          english_translation_candidate: null,
          author_romanizations: [null],
        }],
      },
    },
  );

  expect(decoded.vision).toMatchObject({
    imageOutcome: 'analyzed',
    detectedVisibleBookCount: 1,
    observations: [{
      isbnClue: '0-14-02-0927-1',
      detectedLanguage: 'en',
    }],
  });
});
