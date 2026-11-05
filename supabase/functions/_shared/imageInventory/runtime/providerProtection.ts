// U6: registry-derived provider protection (02c §§4.3/5.4, SDD §3.1).
// Every numeric threshold comes from the verified registry protection_policy;
// this module defines NO operating numbers. A NULL policy never reaches here
// (the port runs its legacy fencing-only mode instead); a malformed policy
// throws P9_PROVIDER_CONFIGURATION_INVALID; `shared_db` parses but is refused
// at port construction because 8b approves only the single-instance mechanism
// (M93:264-267 reserve, :432-434 begin). Multi-instance rollout proof that a
// single deployed instance actually holds is NOT established here (S6).
import { P9_PROVIDER_CONFIGURATION_INVALID } from '../metadata/providerDescriptor';

export type ParsedProtectionPolicy = Readonly<{
  version: 'p9-protection-v1';
  minIntervalMs: number;
  storeWindowSeconds: number;
  storeMaxGets: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
  breakerFailures: number;
  breakerWindowSeconds: number;
  breakerCooldownMs: number;
  halfOpenMax: 1;
  mode: 'single_instance' | 'shared_db';
  contactId: string;
}>;

const NUMERIC_KEYS = [
  'minIntervalMs', 'storeWindowSeconds', 'storeMaxGets',
  'backoffBaseMs', 'backoffMaxMs', 'breakerFailures', 'breakerWindowSeconds',
  'breakerCooldownMs', 'halfOpenMax',
] as const;
const MAX_32 = 2147483647;
const CONTACT_ID = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/u;

// NULL in -> NULL out (legacy mode); malformed -> throw. Mirrors the SQL
// bounds (M89 phase9_provider_configuration_valid_v1) and the snapshot parser
// (runtime/providerConfiguration.ts:117-133); nothing stricter is invented.
export function parseProtectionPolicyOrNull(value: unknown): ParsedProtectionPolicy | null {
  if (value === null || value === undefined) return null;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(P9_PROVIDER_CONFIGURATION_INVALID);
  }
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row);
  if (keys.length !== NUMERIC_KEYS.length + 3
    || row.version !== 'p9-protection-v1'
    || (row.mode !== 'single_instance' && row.mode !== 'shared_db')
    || typeof row.contactId !== 'string' || !CONTACT_ID.test(row.contactId as string)) {
    throw new Error(P9_PROVIDER_CONFIGURATION_INVALID);
  }
  for (const key of NUMERIC_KEYS) {
    const entry = row[key];
    if (typeof entry !== 'number' || !Number.isSafeInteger(entry)
      || entry < 1 || entry > MAX_32) {
      throw new Error(P9_PROVIDER_CONFIGURATION_INVALID);
    }
  }
  if (row.halfOpenMax !== 1
    || (row.backoffBaseMs as number) > (row.backoffMaxMs as number)) {
    throw new Error(P9_PROVIDER_CONFIGURATION_INVALID);
  }
  return Object.freeze({ ...(row as unknown as ParsedProtectionPolicy) });
}

// Unit B: resolves a parsed protection policy's contactId against
// worker-server configuration WITHOUT touching the policy object (the
// resolved value never enters registry/DTO/output shapes). NULL policy
// (legacy fencing-only mode) resolves to NULL, selecting the fixed
// literal User-Agent. A non-NULL policy whose contactId has no mapping
// throws P9_PROVIDER_CONFIGURATION_INVALID (fail closed before any fetch).
export function resolveProtectionContact(
  policy: ParsedProtectionPolicy | null,
  contacts: Readonly<Record<string, string>>,
): string | null {
  if (policy === null) return null;
  // F1: own-key lookup only. An inherited name ('toString',
  // 'constructor', ...) must miss even on a plain-object map, and a
  // non-string/empty own value must fail closed like a miss.
  if (typeof policy.contactId !== 'string'
    || !Object.hasOwn(contacts, policy.contactId)) {
    throw new Error(P9_PROVIDER_CONFIGURATION_INVALID);
  }
  const contact = (contacts as Record<string, unknown>)[policy.contactId];
  if (typeof contact !== 'string' || contact.length === 0) {
    throw new Error(P9_PROVIDER_CONFIGURATION_INVALID);
  }
  return contact;
}

// Process-local observation state. Durable multi-instance correctness is NOT
// claimed here (SDD §5.4:756-758); 8b runs the approved single-instance
// mechanism only. Production shares ONE state object per provider across
// concurrent claims (worker-owned, wired by explicitHttp.sharedProtection);
// tests share it via `breakerState`.
export type ProtectionState = {
  lastGetStartMs: number | null;
  failureAtMs: number[];
  breakerOpenedAtMs: number | null;
  halfOpenProbeInFlight: boolean;
  // U6 fix1 (F3): atomic start-permit chain. `startTail` resolves when the
  // current start owner records its actual fetch start (never waits for the
  // response). U6 fix2 (G2): the tail carries ORDER only; spacing is computed
  // from the predecessor's ACTUAL start after it settles.
  startTail?: Promise<void>;
};

export function createProtectionState(): ProtectionState {
  return { lastGetStartMs: null, failureAtMs: [], breakerOpenedAtMs: null,
    halfOpenProbeInFlight: false, startTail: Promise.resolve() };
}

// Normalizes a caller-supplied shared object (e.g. the test `breakerState`
// `{}`) into live state WITHOUT copying, so concurrent claims observe each
// other. Missing fields are initialized in place.
export function useSharedProtectionState(existing?: object | null): ProtectionState {
  const state = (existing ?? {}) as Partial<ProtectionState>;
  if (state.lastGetStartMs === undefined) state.lastGetStartMs = null;
  if (!Array.isArray(state.failureAtMs)) state.failureAtMs = [];
  if (state.breakerOpenedAtMs === undefined) state.breakerOpenedAtMs = null;
  if (state.halfOpenProbeInFlight === undefined) state.halfOpenProbeInFlight = false;
  if (!(state.startTail instanceof Promise)) state.startTail = Promise.resolve();
  return state as ProtectionState;
}

export class ProviderProtectionRefusal extends Error {
  constructor(readonly outcome: 'circuit_breaker_open') {
    super(outcome);
  }
}

// Pacing wait interrupted by cancellation. The port maps this to a
// 'cancelled' outcome (never a breaker refusal: denials keep identity).
export class ProtectionCancelledError extends Error {
  constructor() {
    super('cancelled');
  }
}

function pruneFailures(policy: ParsedProtectionPolicy, state: ProtectionState, nowMs: number): void {
  const windowMs = policy.breakerWindowSeconds * 1000;
  state.failureAtMs = state.failureAtMs.filter((at) => nowMs - at < windowMs);
}

// U6 fix1 (F3): atomic provider-scoped start permit. The reservation is
// ENQUEUED synchronously (tail chain; spacing from the actual start) before any
// await, so concurrent claims observe each other's permits. Ownership is held
// through pacing, the existing limiter, registration and the final
// fresh/cancellation checks; the caller records the ACTUAL fetch start and
// releases at fetch invocation (never waiting for the response). Pre-send
// exits release without recording. Cancellation interrupts pacing waits.
// This replaces fire-and-forget timestamp waits; no second limiter.
export type StartPermit = Readonly<{
  done: (started: boolean) => void;
}>;

async function abortableSleep(
  ms: number,
  sleep: (ms: number) => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  if (ms <= 0) return;
  let onAbort: (() => void) | null = null;
  try {
    await Promise.race([
      sleep(ms),
      new Promise<never>((_, reject) => {
        onAbort = () => reject(new ProtectionCancelledError());
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
      }),
    ]);
  } finally {
    if (onAbort !== null) signal.removeEventListener('abort', onAbort);
  }
  if (signal.aborted) throw new ProtectionCancelledError();
}

export async function acquireStartPermit(
  policy: ParsedProtectionPolicy,
  state: ProtectionState,
  now: () => number,
  sleep: (ms: number) => Promise<void>,
  signal: AbortSignal,
): Promise<StartPermit> {
  // Synchronous enqueue: chain behind the current tail before any await.
  // The tail carries ORDER only; the spacing target is computed after the
  // predecessor actually starts (state.lastGetStartMs), never reserved at
  // enqueue (a delayed predecessor cannot let its successor start early).
  const predecessor = state.startTail ?? Promise.resolve();
  let releaseTail!: () => void;
  state.startTail = new Promise<void>((resolve) => { releaseTail = resolve; });
  let settled = false;
  const release = (): void => {
    if (settled) return;
    settled = true;
    releaseTail();
  };
  const done = (started: boolean): void => {
    if (settled) return;
    if (started) state.lastGetStartMs = now();
    release();
  };
  // An aborted waiter still interrupts its own caller immediately, but it
  // must not release its successors past a predecessor that has not settled:
  // chain the release to the predecessor (G2).
  const releaseAfterPredecessor = (): void => {
    void predecessor.then(() => release());
  };
  if (signal.aborted) {
    releaseAfterPredecessor();
    throw new ProtectionCancelledError();
  }
  let onAbort: (() => void) | null = null;
  try {
    await Promise.race([
      predecessor,
      new Promise<never>((_, reject) => {
        onAbort = () => reject(new ProtectionCancelledError());
        signal.addEventListener('abort', onAbort, { once: true });
      }),
    ]);
  } catch (error) {
    releaseAfterPredecessor();
    throw error;
  } finally {
    if (onAbort !== null) signal.removeEventListener('abort', onAbort);
  }
  // The predecessor has settled: pace from its ACTUAL start (never an
  // enqueue-time reservation). Abort here is safe to release immediately.
  const lastStart = state.lastGetStartMs;
  const startAt = Math.max(now(),
    lastStart === null ? Number.NEGATIVE_INFINITY : lastStart + policy.minIntervalMs);
  try {
    await abortableSleep(startAt - now(), sleep, signal);
  } catch (error) {
    release();
    throw error;
  }
  return { done };
}

// Breaker observation. A refusal throws BEFORE registration so no dangling
// call is left behind. On admission after cooldown, exactly one half-open
// probe is released (halfOpenMax is validated 1); concurrent contenders refuse.
// Returns true when THIS call was released as the probe (F4: the caller must
// settle it as failure only on actual provider contact, and release it
// without counting a failure on pre-send refusal).
export function checkBreaker(
  policy: ParsedProtectionPolicy,
  state: ProtectionState,
  nowMs: number,
): boolean {
  pruneFailures(policy, state, nowMs);
  if (state.breakerOpenedAtMs === null) {
    if (state.failureAtMs.length >= policy.breakerFailures) {
      state.breakerOpenedAtMs = nowMs;
      return false;
    }
    return false;
  }
  if (nowMs - state.breakerOpenedAtMs < policy.breakerCooldownMs) {
    throw new ProviderProtectionRefusal('circuit_breaker_open');
  }
  if (state.halfOpenProbeInFlight) {
    throw new ProviderProtectionRefusal('circuit_breaker_open');
  }
  state.halfOpenProbeInFlight = true;
  return true;
}

// Releases a half-open probe WITHOUT counting a failure (F4): pre-send
// refusals (validator, bounds, registration denial, cancellation before send)
// never contacted the provider, so the outage must not extend.
export function releaseHalfOpenProbe(state: ProtectionState): void {
  state.halfOpenProbeInFlight = false;
}

// 02c §5.4: rate limiting has its own pacing; only transport/server outages trip the breaker.
export function isBreakerFailure(outcome: string): boolean {
  return outcome === 'provider_unavailable' || outcome === 'network_failure' || outcome === 'timeout';
}

export function settleHalfOpenProbe(state: ProtectionState, ok: boolean, nowMs: number): void {
  state.halfOpenProbeInFlight = false;
  if (ok) {
    state.breakerOpenedAtMs = null;
    state.failureAtMs = [];
  } else {
    state.breakerOpenedAtMs = nowMs;
  }
}

// A failed GET observes the breaker. Success (including probe success) clears
// through settleHalfOpenProbe at the call site; plain successes leave state alone.
export function recordBreakerFailure(
  policy: ParsedProtectionPolicy,
  state: ProtectionState,
  nowMs: number,
): void {
  state.failureAtMs.push(nowMs);
  pruneFailures(policy, state, nowMs);
  if (state.breakerOpenedAtMs === null && state.failureAtMs.length >= policy.breakerFailures) {
    state.breakerOpenedAtMs = nowMs;
  }
}

// Safe Retry-After floor for U5/M93. Returns an absolute epoch ms, or null
// when the value is malformed, unsafe or unrepresentable. There is deliberately
// NO upper clamp: the policy upper bound stays Owner-gated (tracker 39:127).
// Past dates are forwarded as-is (M93 takes max(bounded step, floor)).
export function parseRetryAfterMs(value: unknown, nowMs: number): number | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text.length === 0 || text[0] === '-') return null;
  if (/^\d+$/u.test(text)) {
    const seconds = Number(text);
    const ms = seconds * 1000;
    if (!Number.isSafeInteger(ms)) return null;
    return nowMs + ms;
  }
  const at = Date.parse(text);
  if (!Number.isFinite(at)) return null;
  return at;
}
