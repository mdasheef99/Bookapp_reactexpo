import {
  assertSpineAnalysisIdentity,
  parseSpineAnalysisResult,
  SpineAnalysisRequest,
  SpineAnalysisResult,
  SpineImageAnalyzer,
} from '../../supabase/functions/_shared/imageInventory/contracts/vision';
import {
  FixtureAnalyzerError,
} from '../../supabase/functions/_shared/imageInventory/analysis/fixtureSpineImageAnalyzer';

export const DEPLOYMENT_FIXTURE_CASES = Object.freeze([
  'one_book',
  'repeated_books',
  'no_books',
  'over_15',
  'mixed_language',
  'all_language_mismatch',
  'identity_insufficient',
  'schema_invalid',
  'retryable_failure',
] as const);

export type DeploymentFixtureCase = typeof DEPLOYMENT_FIXTURE_CASES[number];

const fixtureCaseSet = new Set<string>(DEPLOYMENT_FIXTURE_CASES);

export function parseDeploymentFixtureCase(value: string): DeploymentFixtureCase {
  if (!fixtureCaseSet.has(value)) throw new Error('P9_WORKER_CONFIGURATION_INVALID');
  return value as DeploymentFixtureCase;
}

function mismatchLanguage(expectedLanguage: string): string {
  return expectedLanguage.split('-')[0] === 'en' ? 'hi-Deva' : 'en';
}

function observation(
  ordinal: number,
  language: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    ordinal,
    title_guess: `Deployment Fixture Book ${ordinal}`,
    author_guesses: [`Deployment Fixture Author ${ordinal}`],
    publisher_clue: 'Deployment Fixture Publisher',
    isbn_clue: null,
    detected_language: language,
    confidence: 0.9,
    geometry: {
      x: Math.min(0.9, (ordinal - 1) * 0.05),
      y: 0,
      width: 0.05,
      height: 0.9,
      rotation: 0,
    },
    warning_codes: [],
    ...overrides,
  };
}

function envelope(
  request: SpineAnalysisRequest,
  observations: readonly unknown[],
  imageOutcome: 'analyzed' | 'no_books' | 'too_many_books' | 'quality_rejected',
  detectedVisibleBookCount: number | null,
) {
  return {
    contract_version: request.contractVersion,
    schema_version: request.schemaVersion,
    pipeline_version: request.pipelineVersion,
    prompt_version: request.promptVersion,
    adapter_key: request.adapterKey,
    adapter_version: request.adapterVersion,
    job_reference: request.jobReference,
    attempt_number: request.attemptNumber,
    correlation_id: request.correlationId,
    expected_language: request.expectedLanguage,
    provider_key: 'recorded_fixture',
    model_key: 'fixture_multimodal',
    model_version: 'deployment-v1',
    received_at: request.requestedAt,
    image_outcome: imageOutcome,
    detected_visible_book_count: detectedVisibleBookCount,
    observations,
    warning_codes: [],
  };
}

function fixtureEnvelope(
  fixtureCase: Exclude<DeploymentFixtureCase, 'retryable_failure'>,
  request: SpineAnalysisRequest,
): unknown {
  const expected = request.expectedLanguage;
  const mismatch = mismatchLanguage(expected);
  switch (fixtureCase) {
    case 'one_book':
      return envelope(request, [observation(1, expected)], 'analyzed', 1);
    case 'repeated_books':
      return envelope(request, [
        observation(1, expected, { title_guess: 'Repeated Deployment Fixture' }),
        observation(2, expected, { title_guess: 'Repeated Deployment Fixture' }),
      ], 'analyzed', 2);
    case 'no_books':
      return envelope(request, [], 'no_books', 0);
    case 'over_15':
      return envelope(request, [], 'too_many_books', 16);
    case 'mixed_language':
      return envelope(request, [
        observation(1, expected),
        observation(2, mismatch),
        observation(3, 'und'),
      ], 'analyzed', 3);
    case 'all_language_mismatch':
      return envelope(request, [
        observation(1, mismatch),
        observation(2, 'und'),
      ], 'analyzed', 2);
    case 'identity_insufficient':
      return envelope(request, [
        observation(1, expected, { title_guess: null }),
        observation(2, expected),
      ], 'analyzed', 2);
    case 'schema_invalid':
      return {
        ...envelope(request, [observation(1, expected)], 'analyzed', 1),
        raw_response: 'forbidden',
      };
  }
}

class DeploymentFixtureAnalyzer implements SpineImageAnalyzer {
  constructor(private readonly fixtureCase: DeploymentFixtureCase) {}

  async analyze(request: SpineAnalysisRequest): Promise<SpineAnalysisResult> {
    if (this.fixtureCase === 'retryable_failure') {
      throw new FixtureAnalyzerError('P9_VISION_ANALYZER_TIMEOUT', true);
    }
    try {
      const result = parseSpineAnalysisResult(fixtureEnvelope(this.fixtureCase, request));
      assertSpineAnalysisIdentity(request, result);
      return result;
    } catch {
      throw new FixtureAnalyzerError('P9_VISION_SCHEMA_INVALID', false);
    }
  }
}

export function createDeploymentFixtureAnalyzer(
  fixtureCase: DeploymentFixtureCase,
): SpineImageAnalyzer {
  return new DeploymentFixtureAnalyzer(parseDeploymentFixtureCase(fixtureCase));
}
