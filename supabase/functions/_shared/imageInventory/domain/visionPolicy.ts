import { SpineAnalysisResult, SpineObservation } from '../contracts/vision';

export type VisionObservationDisposition =
  | 'candidate'
  | 'language_mismatch'
  | 'unknown_language'
  | 'identity_insufficient';
export type VisionPolicyOutcome =
  | 'accepted'
  | 'accepted_with_language_skips'
  | 'no_books'
  | 'language_mismatch'
  | 'over_visible_book_limit'
  | 'quality_rejected';
export type VisionPolicyObservation = Readonly<{
  observation: SpineObservation;
  disposition: VisionObservationDisposition;
}>;
export type VisionPolicyCandidate = Readonly<SpineObservation & {
  candidateIndex: number;
  observationOrdinal: number;
}>;
export type VisionPolicyResult = Readonly<{
  outcome: VisionPolicyOutcome;
  inputState: 'ready' | 'skipped' | 'failed';
  jobStatus: 'resolved' | 'resolved_noop';
  safeErrorCode: string | null;
  observations: readonly VisionPolicyObservation[];
  candidates: readonly VisionPolicyCandidate[];
}>;

export function evaluateVisionResult(result: SpineAnalysisResult): VisionPolicyResult {
  if (result.imageOutcome === 'no_books') {
    return terminal('no_books', 'skipped', 'resolved_noop', 'P9_VISION_NO_BOOKS');
  }
  if (result.imageOutcome === 'too_many_books') {
    return terminal('over_visible_book_limit', 'failed', 'resolved', 'P9_VISION_OVER_LIMIT');
  }
  if (result.imageOutcome === 'quality_rejected') {
    return terminal('quality_rejected', 'failed', 'resolved', 'P9_VISION_QUALITY_REJECTED');
  }

  const observations: VisionPolicyObservation[] = result.observations.map((entry) => {
    let disposition: VisionObservationDisposition;
    if (entry.detectedLanguage === 'und') disposition = 'unknown_language';
    else if (entry.titleGuess === null) disposition = 'identity_insufficient';
    else disposition = 'candidate';
    return { observation: entry, disposition };
  });
  const candidates = observations
    .filter((entry) => entry.disposition === 'candidate')
    .map((entry, index) => ({
      ...entry.observation,
      candidateIndex: index + 1,
      observationOrdinal: entry.observation.ordinal,
    }));
  const allLanguageUnknown = observations.every(
    (entry) => entry.disposition === 'unknown_language',
  );
  if (allLanguageUnknown) {
    return {
      outcome: 'language_mismatch',
      inputState: 'skipped',
      jobStatus: 'resolved_noop',
      safeErrorCode: 'P9_VISION_LANGUAGE_MISMATCH',
      observations,
      candidates: [],
    };
  }
  const hasSkips = observations.some((entry) => entry.disposition !== 'candidate');
  return {
    outcome: hasSkips ? 'accepted_with_language_skips' : 'accepted',
    inputState: candidates.length > 0 ? 'ready' : 'skipped',
    jobStatus: candidates.length > 0 ? 'resolved' : 'resolved_noop',
    safeErrorCode: null,
    observations,
    candidates,
  };
}

function terminal(
  outcome: VisionPolicyOutcome,
  inputState: 'skipped' | 'failed',
  jobStatus: 'resolved' | 'resolved_noop',
  safeErrorCode: string,
): VisionPolicyResult {
  return {
    outcome, inputState, jobStatus, safeErrorCode, observations: [], candidates: [],
  };
}
