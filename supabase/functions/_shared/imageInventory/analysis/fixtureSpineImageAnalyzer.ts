import {
  assertSpineAnalysisIdentity,
  parseSpineAnalysisResult,
  SpineAnalysisRequest,
  SpineAnalysisResult,
  SpineImageAnalyzer,
} from '../contracts/vision';

export type FixtureAnalyzerErrorCode =
  | 'P9_VISION_ANALYZER_TIMEOUT'
  | 'P9_VISION_ANALYZER_UNAVAILABLE'
  | 'P9_VISION_SCHEMA_INVALID';

export class FixtureAnalyzerError extends Error {
  constructor(
    readonly code: FixtureAnalyzerErrorCode,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = 'FixtureAnalyzerError';
  }
}

type FixtureFailure = Readonly<{ error: 'timeout' | 'unavailable' }>;
type FixtureEntry = unknown | FixtureFailure;

function isFailure(value: unknown): value is FixtureFailure {
  return Boolean(value && typeof value === 'object'
    && Object.keys(value as object).length === 1
    && ['timeout', 'unavailable'].includes((value as FixtureFailure).error));
}

/** Deterministic recorded-fixture adapter. It performs no network or metadata calls. */
export class FixtureSpineImageAnalyzer implements SpineImageAnalyzer {
  constructor(private readonly fixtures: Readonly<Record<string, FixtureEntry>>) {}

  async analyze(request: SpineAnalysisRequest): Promise<SpineAnalysisResult> {
    const fixture = this.fixtures[request.sanitizedMediaReference];
    if (fixture === undefined || (isFailure(fixture) && fixture.error === 'unavailable')) {
      throw new FixtureAnalyzerError('P9_VISION_ANALYZER_UNAVAILABLE', true);
    }
    if (isFailure(fixture) && fixture.error === 'timeout') {
      throw new FixtureAnalyzerError('P9_VISION_ANALYZER_TIMEOUT', true);
    }
    try {
      const result = parseSpineAnalysisResult(fixture);
      assertSpineAnalysisIdentity(request, result);
      return result;
    } catch {
      throw new FixtureAnalyzerError('P9_VISION_SCHEMA_INVALID', false);
    }
  }
}
