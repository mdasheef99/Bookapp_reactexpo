export const PHASE9_RED_IMPLEMENTATION_GATES = [
  { id: 'P9-RED-TENANT-01', targetUnit: 2, requirement: 'Store A cannot access Store B sessions, candidates, jobs, or media.' },
  { id: 'P9-RED-UPLOAD-01', targetUnit: 3, requirement: 'Stale upload authority and cross-purpose media identifiers fail closed.' },
  { id: 'P9-RED-VISION-01', targetUnit: 4, requirement: 'One whole-image fallback maximum with no provider call in CI.' },
  { id: 'P9-RED-METADATA-01', targetUnit: 5, requirement: 'Local-first coherent metadata selection never stitches editions.' },
  { id: 'P9-RED-COMMIT-01', targetUnit: 7, requirement: 'Idempotent commit preserves quantity buckets and private inventory on publication failure.' },
  { id: 'P9-RED-MARKET-01', targetUnit: 8, requirement: 'Store-group pagination returns every eligible store once without private fields.' },
  { id: 'P9-RED-PHOTO-01', targetUnit: 9, requirement: 'Request photos remain private and cannot affect duplicate identity.' },
  { id: 'P9-RED-LIFECYCLE-01', targetUnit: 10, requirement: 'Cleanup is idempotent, hold-aware, and leaves non-content deletion evidence.' },
] as const;

export type Phase9RedGateId = typeof PHASE9_RED_IMPLEMENTATION_GATES[number]['id'];
