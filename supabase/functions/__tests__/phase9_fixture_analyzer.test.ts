import {
  FixtureAnalyzerError,
  FixtureSpineImageAnalyzer,
} from '../_shared/imageInventory/analysis/fixtureSpineImageAnalyzer';
import { createSpineAnalysisRequest } from '../_shared/imageInventory/contracts';
import {
  visionOne,
  visionRequestInput,
} from './fixtures/phase9/visionFixtures';

describe('Phase 9 fixture spine-image analyzer', () => {
  const request = createSpineAnalysisRequest(visionRequestInput);

  it('V4-A01 returns a strictly parsed recorded multimodal fixture', async () => {
    const analyzer = new FixtureSpineImageAnalyzer({
      media_fixture_reference_0001: visionOne,
    });
    await expect(analyzer.analyze(request)).resolves.toMatchObject({
      schemaVersion: 'p9-vision-v2',
      providerKey: 'recorded_fixture',
    });
  });

  it('maps configured timeout/unavailability without provider fallback', async () => {
    await expect(new FixtureSpineImageAnalyzer({
      media_fixture_reference_0001: { error: 'timeout' },
    }).analyze(request)).rejects.toMatchObject({ code: 'P9_VISION_ANALYZER_TIMEOUT' });
    await expect(new FixtureSpineImageAnalyzer({}).analyze(request))
      .rejects.toMatchObject({ code: 'P9_VISION_ANALYZER_UNAVAILABLE' });
  });

  it('maps malformed fixture output to the stable schema error', async () => {
    const analyzer = new FixtureSpineImageAnalyzer({
      media_fixture_reference_0001: { ...visionOne, raw_response: 'forbidden' },
    });
    await expect(analyzer.analyze(request)).rejects.toEqual(
      expect.any(FixtureAnalyzerError),
    );
    await expect(analyzer.analyze(request))
      .rejects.toMatchObject({ code: 'P9_VISION_SCHEMA_INVALID', retryable: false });
  });
});
