// Explicit test-only policy. OQ8-1/3 production operating values stay unset.
export const TEST_ONLY_PROTECTION_POLICY = Object.freeze({
  version: 'p9-protection-v1', minIntervalMs: 1000, storeWindowSeconds: 60,
  storeMaxGets: 6, backoffBaseMs: 100, backoffMaxMs: 400,
  breakerFailures: 2, breakerWindowSeconds: 60, breakerCooldownMs: 30000,
  halfOpenMax: 1, mode: 'single_instance' as const, contactId: 'fixture-contact',
});

// Unit B: fake server-side contact map for the fixture contactId. Fake
// values only; never a real email.
export const TEST_ONLY_PROVIDER_CONTACTS = Object.freeze({
  'fixture-contact': 'ops@example.invalid',
});

export function fakeClock(start = 0) {
  let current = start;
  return { now: () => current,
    sleep: async (delayMs: number) => { current += delayMs; },
    advance: (delayMs: number) => { current += delayMs; } };
}
