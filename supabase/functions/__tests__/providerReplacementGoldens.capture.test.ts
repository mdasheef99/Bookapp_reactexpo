import {
  captureProviderGoldens,
  GOLDEN_CLOCK,
  GOLDEN_LOOKUP_ID,
  GOLDEN_ATTEMPT_ID,
} from './support/captureProviderGoldens';
import {
  GOOGLE_AUTOMATIC_V1,
  GOOGLE_EXPLICIT_V1,
  OL_V1_EXPLICIT_V1,
} from './fixtures/phase9/providerReplacementGoldens';

const optionIds = (prefix: string) => Array.from({ length: 10 }, (_, index) =>
  `${prefix}-8333-${String(index + 1).padStart(12, '0')}`);

it('keeps the captured v1 goldens equal to the committed packets', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(Date.parse(GOLDEN_CLOCK));
  try {
    const captured = await captureProviderGoldens({
      googleExplicitOptionIds: optionIds('33333333-3333-4333'),
      openLibraryOptionIds: optionIds('44444444-4444-4444'),
    });
    expect(captured.GOOGLE_AUTOMATIC_V1).toEqual(GOOGLE_AUTOMATIC_V1);
    expect(captured.GOOGLE_EXPLICIT_V1).toEqual(GOOGLE_EXPLICIT_V1);
    expect(captured.OL_V1_EXPLICIT_V1).toEqual(OL_V1_EXPLICIT_V1);
    expect(GOOGLE_AUTOMATIC_V1.selected.correlationId).toBe(GOLDEN_LOOKUP_ID);
    expect(GOOGLE_AUTOMATIC_V1.selected.attemptId).toBe(GOLDEN_ATTEMPT_ID);
  } finally {
    jest.useRealTimers();
  }
});
