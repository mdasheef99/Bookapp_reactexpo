import {
  createDeploymentFixtureAnalyzer,
  DEPLOYMENT_FIXTURE_CASES,
} from '../../../workers/phase9-vision-analysis-worker/deploymentFixtures';
import { createSpineAnalysisRequest } from '../_shared/imageInventory/contracts';

const request = createSpineAnalysisRequest({
  adapterKey: 'fixture_adapter',
  adapterVersion: '1.0.0',
  pipelineVersion: 'phase9-v1',
  promptVersion: 'fixture-prompt-v2',
  jobReference: 'job_dynamic_reference_0001',
  attemptNumber: 3,
  correlationId: '93000000-0000-4000-8000-000000000099',
  requestedAt: '2026-07-26T01:02:03.000Z',
  expectedLanguage: 'en',
  sanitizedMediaReference: 'media_dynamic_reference_0001',
});

const semantics = {
  one_book: { outcome: 'analyzed', count: 1, observations: 1 },
  repeated_books: { outcome: 'analyzed', count: 2, observations: 2 },
  no_books: { outcome: 'no_books', count: 0, observations: 0 },
  over_15: { outcome: 'too_many_books', count: 16, observations: 0 },
  mixed_language: { outcome: 'analyzed', count: 3, observations: 3 },
  all_language_mismatch: { outcome: 'analyzed', count: 2, observations: 2 },
  identity_insufficient: { outcome: 'analyzed', count: 2, observations: 2 },
} as const;

describe('Phase 9 deployment fixtures', () => {
  it.each(DEPLOYMENT_FIXTURE_CASES)(
    'supports allowlisted fixture %s with distinct semantics and authoritative identity',
    async (fixtureCase) => {
      const analyzer = createDeploymentFixtureAnalyzer(fixtureCase);
      if (fixtureCase === 'schema_invalid' || fixtureCase === 'retryable_failure') {
        await expect(analyzer.analyze(request)).rejects.toMatchObject({
          code: fixtureCase === 'schema_invalid'
            ? 'P9_VISION_SCHEMA_INVALID'
            : 'P9_VISION_ANALYZER_TIMEOUT',
        });
        return;
      }
      const result = await analyzer.analyze(request);
      expect(result).toMatchObject({
        contractVersion: request.contractVersion,
        schemaVersion: request.schemaVersion,
        pipelineVersion: request.pipelineVersion,
        promptVersion: request.promptVersion,
        adapterKey: request.adapterKey,
        adapterVersion: request.adapterVersion,
        jobReference: request.jobReference,
        correlationId: request.correlationId,
        attemptNumber: request.attemptNumber,
        expectedLanguage: request.expectedLanguage,
      });
      const expected = semantics[fixtureCase];
      expect(result).toMatchObject({
        imageOutcome: expected.outcome,
        detectedVisibleBookCount: expected.count,
      });
      expect(result.observations).toHaveLength(expected.observations);
      if (fixtureCase === 'repeated_books') {
        expect(result.observations[0].titleGuess).toBe(result.observations[1].titleGuess);
        expect(result.observations.map((item) => item.ordinal)).toEqual([1, 2]);
      }
      if (fixtureCase === 'mixed_language') {
        expect(new Set(result.observations.map((item) => item.detectedLanguage)).size).toBe(3);
      }
      if (fixtureCase === 'all_language_mismatch') {
        expect(result.observations.every(
          (item) => item.detectedLanguage !== request.expectedLanguage,
        )).toBe(true);
      }
      if (fixtureCase === 'identity_insufficient') {
        expect(result.observations.some((item) => item.titleGuess === null)).toBe(true);
      }
    },
  );

  it('rejects arbitrary fixture selection', () => {
    expect(() => createDeploymentFixtureAnalyzer('store/private/path' as never))
      .toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });
});
