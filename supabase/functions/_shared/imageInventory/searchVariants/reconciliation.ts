export type SearchVariantSourceIdentity = Readonly<{
  field: string;
  observationId: string;
  text: string;
  language: string;
  script: string;
}>;

export type SearchVariantReconciliationOutcome =
  | 'equivalent'
  | 'materially_changed'
  | 'not_confirmed'
  | 'conflicting'
  | 'invalid_source_reference';

export type SearchVariantReconciliation = Readonly<{
  outcome: SearchVariantReconciliationOutcome;
}>;

export function normalizeVariantComparisonText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('und')
    .replace(/\p{P}+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function classifySearchVariantSource(
  observed: SearchVariantSourceIdentity,
  confirmed: SearchVariantSourceIdentity | null,
): SearchVariantReconciliation {
  if (!confirmed) return { outcome: 'not_confirmed' };
  if (observed.field !== confirmed.field
    || observed.observationId !== confirmed.observationId) {
    return { outcome: 'invalid_source_reference' };
  }
  if (observed.language !== confirmed.language
    || observed.script !== confirmed.script) {
    return { outcome: 'conflicting' };
  }
  return {
    outcome: normalizeVariantComparisonText(observed.text)
        === normalizeVariantComparisonText(confirmed.text)
      ? 'equivalent'
      : 'materially_changed',
  };
}
