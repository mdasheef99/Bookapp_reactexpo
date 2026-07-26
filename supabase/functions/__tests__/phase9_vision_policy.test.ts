import {
  evaluateVisionResult,
  parseSpineAnalysisResult,
} from '../_shared/imageInventory/contracts';
import {
  visionAllWrongLanguage,
  visionIdentityInsufficient,
  visionMixedLanguage,
  visionNoBooks,
  visionRepeatedSpines,
  visionTooMany,
} from './fixtures/phase9/visionFixtures';

const evaluate = (value: unknown) => evaluateVisionResult(parseSpineAnalysisResult(value));

describe('Phase 9 platform-owned vision policy', () => {
  it('V4-P01/P02 gives zero books and over-limit exact zero-candidate outcomes', () => {
    expect(evaluate(visionNoBooks)).toMatchObject({
      outcome: 'no_books', candidates: [], inputState: 'skipped', jobStatus: 'resolved_noop',
    });
    expect(evaluate(visionTooMany)).toMatchObject({
      outcome: 'over_visible_book_limit', candidates: [], inputState: 'failed', jobStatus: 'resolved',
    });
  });

  it('V4-P03 preserves repeated identical observations at distinct ordinals', () => {
    const result = evaluate(visionRepeatedSpines);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].titleGuess).toBe(result.candidates[1].titleGuess);
    expect(result.candidates.map((candidate) => candidate.observationOrdinal)).toEqual([1, 2]);
  });

  it('V4-P04 retains mixed-language evidence and accepts only expected-language titles', () => {
    const result = evaluate(visionMixedLanguage);
    expect(result.outcome).toBe('accepted_with_language_skips');
    expect(result.candidates.map((candidate) => candidate.observationOrdinal)).toEqual([1]);
    expect(result.observations.map((entry) => entry.disposition))
      .toEqual(['candidate', 'language_mismatch', 'unknown_language']);
  });

  it('V4-P05 resolves all mismatching/unknown observations without candidates', () => {
    expect(evaluate(visionAllWrongLanguage)).toMatchObject({
      outcome: 'language_mismatch',
      candidates: [],
      inputState: 'skipped',
      jobStatus: 'resolved_noop',
    });
  });

  it('V4-P06 retains nullable-title evidence but creates the valid candidate', () => {
    const result = evaluate(visionIdentityInsufficient);
    expect(result.candidates).toHaveLength(1);
    expect(result.observations[0].disposition).toBe('identity_insufficient');
    expect(result.observations[1].disposition).toBe('candidate');
  });
});
