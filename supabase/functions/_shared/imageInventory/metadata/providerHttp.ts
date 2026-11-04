// U6: ProviderHttpPort — the single production egress path per provider
// descriptor (02c §5.1:669-673). Exactly ONE owner each: this port owns GET
// (send), registration/finalization hook invocation and pacing/breaker
// observation; response validation/parsing here mirrors the Open Library
// transport checks (transport.ts:18-20,52-58 — cited, not widened); the v1
// compatibility bridge (openLibrary/descriptor.ts) keeps transport as its
// owner and never enters this fetch path.
// Fence order per GET (S3/S5): synchronous (stage,sequence) reservation ->
// bounds/URL validation -> pacing wait -> breaker check -> beforeRequest
// (registration + grant) -> fresh cancellation fence -> GET (protection clock
// stamped at start) -> response processing -> exactly-once afterRequest ->
// return/throw. Refusals and pre-grant failures never call afterRequest; a
// cancellation AFTER a confirmed grant records a proven-unsent finalization
// (stale_rejected, egressStarted:false), mirroring transport.ts:26-29.
// grantEpoch (C-U6-1) is an OPTIONAL opaque token (`bigint | null`): threaded
// into same-instance stale comparison only when present, never required, never
// synthesized. Production returns null (SQL fencing stays authoritative;
// M93 stamps/enforces the epoch server-side). afterRequest maps the durable
// finalization's provider_call_id to receiptId (S0); no SQL receiptId field is
// ever required. No backoff/retry/scheduling lives here (M93 owns them).
import {
  acquireStartPermit,
  checkBreaker,
  isBreakerFailure,
  parseProtectionPolicyOrNull,
  parseRetryAfterMs,
  recordBreakerFailure,
  releaseHalfOpenProbe,
  settleHalfOpenProbe,
  useSharedProtectionState,
  ProtectionCancelledError,
  ProviderProtectionRefusal,
} from '../runtime/providerProtection';
import {
  P9_PROVIDER_CONFIGURATION_INVALID,
  type ProviderHttpResponse,
} from './providerDescriptor';
import { OpenLibraryFailure } from './openLibrary/transport';

export type { ProviderHttpResponse };

export type ProviderHttpPhysicalStatus = 'finalized' | 'outcome_unknown' | 'stale_rejected';

export type ProviderHttpCall = Readonly<{
  url: URL;
  stage: string;
  sequence: number;
  signal: AbortSignal;
}>;

export type ProviderHttpGrant = Readonly<{
  callId: string;
  grantEpoch?: bigint | null;
}>;

export type ProviderHttpSettled = Readonly<{
  status: ProviderHttpPhysicalStatus;
  egressStarted: boolean;
  outcome: string;
  retryable: boolean;
  providerRequestId: string | null;
}>;

// Thrown for every non-2xx/transport failure. Carries the actual response
// headers (O1: retention bounding before isolation) and the safe Retry-After
// observation for U5/M93 (no scheduling here). Outcome/retryability mirror the
// transport mapping (transport.ts:46-51,74-76) so existing catches keep working.
export class ProviderHttpError extends Error {
  constructor(
    readonly outcome: string,
    readonly retryable: boolean,
    readonly physicalStatus: ProviderHttpPhysicalStatus,
    readonly egressStarted: boolean,
    readonly headers: Headers | null,
    readonly retryAfterMs: number | null,
  ) {
    super(outcome);
  }
}

export type ProviderHttpPortConfig = Readonly<{
  adapterKey: string;
  adapterVersion: string;
  // Raw registry protection_policy (or null). Numbers come ONLY from here;
  // null selects the legacy fencing-only mode (no pacing/breaker). `shared_db`
  // is refused: 8b approves the single-instance mechanism only.
  policy: unknown;
  maxGets: number;
  timeoutMs: number;
  maxResponseBytes: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  fetcher?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  beforeRequest: (call: Readonly<{
    url: URL; stage: string; sequence: number; signal: AbortSignal;
    lookupId: string; attemptId: string;
    claim: Readonly<{ jobId: string; worker: string; leaseToken: string; claimAttempt: number }>;
  }>) => Promise<ProviderHttpGrant>;
  afterRequest: (callId: string, settled: ProviderHttpSettled) => Promise<{ receiptId: string }>;
  lookupId: string;
  attemptId: string;
  claim: Readonly<{ jobId: string; worker: string; leaseToken: string; claimAttempt: number }>;
  // Shared process-local protection state across concurrent claims (S6).
  // Tests share it via `breakerState`; production wires one object per provider.
  breakerState?: object | null;
  sharedProtection?: object | null;
  // U6: the verified registry row policy version for retention binding,
  // carried (worker-supplied from route.policyVersions) and exposed on the
  // port object for port-native invokes (automatic.ts). This is identity, not
  // protection numbers; null means unbound (retention stays not ready).
  retentionPolicyVersion?: number | null;
  // Compiled request-host intersection. When absent, the default Open Library
  // origin grammar applies (transport.ts:18 — cited existing trust, not new).
  requestHosts?: readonly string[];
  // Injected request validator (R1/S1: test-owned, descriptor-bound). Takes
  // precedence over the default grammar; identifiers/hosts alone never define
  // compiled trust.
  requestValidator?: (url: URL, stage: string, sequence: number) => void;
  // S3 v1 bridge: transport-owned send+parse. When present, the port keeps
  // bounds/validator/limiter-acquire/registration/fence/finalization and
  // delegates ONLY the send+parse to transport (no second limiter, no
  // duplicate hooks). The permit is acquired via acquireLimiter BEFORE
  // registration (S3 order) and ownership transfers to transportSend, which
  // must route it through getOpenLibraryJson (released at GET start there).
  // Requires acquireLimiter; forbidden without it.
  acquireLimiter?: (signal: AbortSignal) => Promise<(egressStarted: boolean) => void>;
  transportSend?: (
    url: URL,
    call: Readonly<{ stage: string; sequence: number; signal: AbortSignal }>,
    permit: (egressStarted: boolean) => void,
    onSendStart: () => void,
  ) => Promise<{ json: unknown; headers: Headers }>;
}>;

// Default compiled request trust: the existing Open Library origin/path
// grammar (transport.ts:18-20), intersected with configured request hosts
// when supplied. HTTPS only, no credentials, no port, no fragment.
// U6 fix1 (F11): allowed (path, stage, sequence) combinations are bound
// locally before limiter acquisition or registration (M91 grammar, fetch.ts):
// search/0, editions|edition/1, author:KEY/2-5 with the path key matching.
function defaultRequestValidator(
  requestHosts: readonly string[] | undefined,
  url: URL, stage: string, sequence: number,
): void {
  const insufficient = (): ProviderHttpError =>
    new ProviderHttpError('insufficient_query', false, 'stale_rejected', false, null, null);
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== ''
    || url.port !== '' || url.hash !== '') {
    throw insufficient();
  }
  if (url.origin !== 'https://openlibrary.org') throw insufficient();
  let combination = false;
  if (url.pathname === '/search.json') {
    combination = stage === 'search' && sequence === 0;
  } else if (/^\/works\/OL[1-9][0-9]*W\/editions\.json$/u.test(url.pathname)) {
    combination = stage === 'editions' && sequence === 1;
  } else if (/^\/books\/OL[1-9][0-9]*M\.json$/u.test(url.pathname)) {
    combination = stage === 'edition' && sequence === 1;
  } else {
    const author = /^\/authors\/(OL[1-9][0-9]*A)\.json$/u.exec(url.pathname);
    combination = author !== null && stage === `author:${author[1]}`
      && sequence >= 2 && sequence <= 5;
  }
  if (!combination) throw insufficient();
  if (requestHosts !== undefined && !requestHosts.includes(url.hostname)) {
    throw insufficient();
  }
}

// U6 fix1 (F14): registry-host intersection applied AFTER any custom
// validator, on both branches. Identifiers and custom trust alone never
// define it.
function intersectRegistryHosts(requestHosts: readonly string[] | undefined, url: URL): void {
  if (requestHosts !== undefined && !requestHosts.includes(url.hostname)) {
    throw new ProviderHttpError('insufficient_query', false, 'stale_rejected', false, null, null);
  }
}

const KNOWN_SETTLE_STATUSES: readonly string[] = ['finalized', 'outcome_unknown', 'stale_rejected'];

// U6 fix2 (G9): explicit pre-registration proof. A beforeRequest refusal that
// is known to have performed NO registration RPC may release its
// (stage,sequence) reservation; `!granted` alone is not proof (the
// post-registration fresh check also fails before a grant). The hook owns the
// proof and marks only the never-registered paths.
export const PROVIDER_HTTP_UNREGISTERED = Symbol.for('bookconnect.p9.providerHttp.unregistered');

export function markProviderHttpUnregistered<T>(error: T): T {
  if (error !== null && (typeof error === 'object' || typeof error === 'function')) {
    try {
      Object.defineProperty(error, PROVIDER_HTTP_UNREGISTERED,
        { value: true, configurable: true });
    } catch { /* frozen error: no marker, the reservation is retained */ }
  }
  return error;
}

export function isProviderHttpUnregistered(error: unknown): boolean {
  return error !== null && typeof error === 'object'
    && (error as Record<symbol, unknown>)[PROVIDER_HTTP_UNREGISTERED] === true;
}

export function createProviderHttpPort(config: ProviderHttpPortConfig): Readonly<{
  get(input: ProviderHttpCall): Promise<ProviderHttpResponse>;
}> & Readonly<{ retentionPolicyVersion: number | null }> {
  const policy = parseProtectionPolicyOrNull(config.policy);
  if (policy !== null && policy.mode !== 'single_instance') {
    throw new Error(P9_PROVIDER_CONFIGURATION_INVALID);
  }
  if (!Number.isSafeInteger(config.maxGets) || config.maxGets < 1 || config.maxGets > 6) {
    throw new Error(P9_PROVIDER_CONFIGURATION_INVALID);
  }
  if (config.transportSend !== undefined && config.acquireLimiter === undefined) {
    throw new Error(P9_PROVIDER_CONFIGURATION_INVALID);
  }
  const retentionPolicyVersion = typeof config.retentionPolicyVersion === 'number'
    && Number.isSafeInteger(config.retentionPolicyVersion) && config.retentionPolicyVersion > 0
    ? config.retentionPolicyVersion : null;
  const now = config.now ?? Date.now;
  const sleep = config.sleep ?? ((ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));
  const fetcher = config.fetcher ?? fetch;
  const state = useSharedProtectionState(
    (config.sharedProtection ?? config.breakerState ?? null) as object | null,
  );
  // S5: reused sequence OR reused stage refuses — each tracked independently,
  // reserved synchronously at entry before any asynchronous work so concurrent
  // calls cannot both pass. A (stage,sequence) pair set alone is insufficient.
  const usedSequences = new Set<number>();
  const usedStages = new Set<string>();
  let servedGets = 0;
  let lastGrantEpoch: bigint | null = null;

  const checkBounds = (stage: string, sequence: number): void => {
    if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence > 5
      || typeof stage !== 'string' || stage.length < 1 || stage.length > 128) {
      throw new ProviderHttpError('insufficient_query', false, 'stale_rejected', false, null, null);
    }
  };

  async function get(input: ProviderHttpCall): Promise<ProviderHttpResponse> {
    // Synchronous reservation first (S5). Inside an async function a throw
    // still surfaces as a rejection; no await precedes these lines.
    checkBounds(input.stage, input.sequence);
    if (usedSequences.has(input.sequence) || usedStages.has(input.stage)) {
      throw new ProviderHttpError('insufficient_query', false, 'stale_rejected', false, null, null);
    }
    usedSequences.add(input.sequence);
    usedStages.add(input.stage);
    // U6 fix1: per-call tracking shared down the fence chain. `granted`
    // flips once the grant is confirmed (F13: a post-grant proven-unsent
    // cancellation keeps its reservation because the SQL row exists);
    // `contacted` flips at actual send (F4: only provider contact settles
    // the half-open probe as failure).
    const track = { granted: false, contacted: false, unregistered: false, hookEntered: false };
    try {
      return await serve(input, track);
    } catch (error) {
      // A refused (never-granted, never-sent) call must not hold its
      // reservation: only a granted call consumes the slot. Once
      // beforeRequest has been entered a SQL row may exist (a malformed or
      // stale grant is still a registration), so from there only the hook's
      // explicit unregistered proof releases it (G9).
      if (!track.granted && (track.unregistered || (!track.hookEntered
        && error instanceof ProviderHttpError && error.egressStarted === false
        && error.physicalStatus === 'stale_rejected'))) {
        usedSequences.delete(input.sequence);
        usedStages.delete(input.stage);
      }
      throw error;
    }
  }

  async function serve(
    input: ProviderHttpCall, track: { granted: boolean; contacted: boolean; unregistered: boolean; hookEntered: boolean },
  ): Promise<ProviderHttpResponse> {
    if (policy === null) {
      return serveFenced(input, track, () => {});
    }
    // U6 fix1 (F3): atomic provider-scoped start permit, held through
    // pacing, limiter, registration and final checks until fetch invocation.
    let permit: { done: (started: boolean) => void };
    try {
      permit = await acquireStartPermit(policy, state, now, sleep, input.signal);
    } catch (error) {
      if (error instanceof ProtectionCancelledError) {
        throw new ProviderHttpError('cancelled', false, 'stale_rejected', false, null, null);
      }
      throw error;
    }
    try {
      let isProbe = false;
      try {
        const response = await serveFenced(input, track, () => permit.done(true), () => {
          // FIX2 D4: the legacy limiter may wait while another request opens the breaker.
          try { isProbe = checkBreaker(policy, state, now()); }
          catch (error) {
            if (error instanceof ProviderProtectionRefusal) {
              throw new ProviderHttpError('circuit_breaker_open', false, 'stale_rejected', false, null, null);
            }
            throw error;
          }
        });
        if (isProbe) settleHalfOpenProbe(state, true, now());
        return response;
      } catch (error) {
        // F4: a pre-send refusal releases the probe WITHOUT counting a
        // failure; only provider contact settles it as failure.
        if (isProbe) {
          if (track.contacted) settleHalfOpenProbe(state,
            error instanceof ProviderHttpError && !isBreakerFailure(error.outcome), now());
          else releaseHalfOpenProbe(state);
        }
        throw error;
      }
    } finally {
      permit.done(false);
    }
  }

  async function serveFenced(
    input: ProviderHttpCall, track: { granted: boolean; contacted: boolean; unregistered: boolean; hookEntered: boolean },
    markStarted: () => void,
    beforeRegister: () => void = () => {},
  ): Promise<ProviderHttpResponse> {
    // Compiled request trust (S1/F14): the injected validator decides first,
    // but configured registry hosts are ALWAYS intersected afterwards — a
    // custom validator can never widen registry trust. With no validator, the
    // default origin grammar decides (then hosts).
    if (config.requestValidator !== undefined) {
      config.requestValidator(input.url, input.stage, input.sequence);
      intersectRegistryHosts(config.requestHosts, input.url);
    } else {
      defaultRequestValidator(config.requestHosts, input.url, input.stage, input.sequence);
    }
    if (servedGets >= config.maxGets) {
      throw new ProviderHttpError('insufficient_query', false, 'stale_rejected', false, null, null);
    }
    // S3 order: limiter acquisition precedes registration. The held permit is
    // released on every pre-send exit; on the transportSend path ownership
    // transfers to transport (released at GET start there, transport.ts:44).
    const permitBox: { permit: ((egressStarted: boolean) => void) | null } = { permit: null };
    try {
      if (config.acquireLimiter !== undefined) {
        permitBox.permit = await config.acquireLimiter(input.signal);
      }
      beforeRegister();
      return await serveRegistered(input, permitBox, track, markStarted);
    } finally {
      permitBox.permit?.(false);
    }
  }

  async function serveRegistered(
    input: ProviderHttpCall,
    permitBox: { permit: ((egressStarted: boolean) => void) | null },
    track: { granted: boolean; contacted: boolean; unregistered: boolean; hookEntered: boolean },
    markStarted: () => void,
  ): Promise<ProviderHttpResponse> {
    let grant: ProviderHttpGrant;
    track.hookEntered = true;
    try {
      grant = await config.beforeRequest({
        url: input.url, stage: input.stage, sequence: input.sequence, signal: input.signal,
        lookupId: config.lookupId, attemptId: config.attemptId, claim: config.claim,
      });
    } catch (error) {
      // G9: the hook's explicit pre-registration proof survives the wrapping
      // below; it is the only thing that may release the reservation for a
      // beforeRequest refusal.
      if (isProviderHttpUnregistered(error)) track.unregistered = true;
      // S7: fencing/operator refusal codes (stale claim, admission pause, RPC
      // failure identity) propagate unchanged — never collapsed into a
      // retryable transport outcome. Fence denials (e.g. provider_disabled
      // from a fresh claim/policy check) keep their outcome and nonretryable
      // identity; nothing was sent. Only transport-level failures are mapped.
      if (error instanceof ProviderHttpError) throw error;
      if (error instanceof Error && error.message.startsWith('P9_')) throw error;
      if (error instanceof OpenLibraryFailure) {
        throw new ProviderHttpError(error.outcome, error.retryable,
          'outcome_unknown', false, error.headers, null);
      }
      throw new ProviderHttpError('provider_unavailable', true, 'outcome_unknown', false, null, null);
    }
    if (grant === null || typeof grant !== 'object' || typeof grant.callId !== 'string'
      || grant.callId.length === 0) {
      throw new ProviderHttpError('provider_unavailable', false, 'stale_rejected', false, null, null);
    }
    // C-U6-1: optional opaque token. Compared only when present; never
    // required, never synthesized. A differing non-null epoch in the same
    // instance means a stale grant ordering: refuse without egress.
    const epoch = grant.grantEpoch === undefined ? null : grant.grantEpoch;
    if (epoch !== null && typeof epoch !== 'bigint') {
      throw new ProviderHttpError('provider_unavailable', false, 'stale_rejected', false, null, null);
    }
    if (epoch !== null) {
      if (lastGrantEpoch !== null && lastGrantEpoch !== epoch) {
        throw new ProviderHttpError('provider_unavailable', false, 'stale_rejected', false, null, null);
      }
      lastGrantEpoch = epoch;
    }
    // F13: the grant is confirmed from here on — the reservation is retained
    // even for proven-unsent outcomes (the SQL row exists).
    track.granted = true;
    // Fresh cancellation fence after the grant, before any GET.
    if (input.signal.aborted) {
      await finalize(grant.callId, {
        status: 'stale_rejected', egressStarted: false, outcome: 'cancelled',
        retryable: false, providerRequestId: null,
      });
      throw new ProviderHttpError('cancelled', false, 'stale_rejected', false, null, null);
    }
    servedGets += 1;
    // S3 bridge: transport-owned send+parse. Ownership of the held permit
    // transfers to transportSend (it must route it through getOpenLibraryJson,
    // released at GET start there — never a second limiter, never relocation).
    // G4: contact and the actual-start clock flip are recorded by the transport
    // callback immediately before it invokes the fetcher, never here.
    if (config.transportSend !== undefined && permitBox.permit !== null) {
      const held = permitBox.permit;
      permitBox.permit = null;
      return await serveViaTransport(input, grant.callId, held, () => {
        track.contacted = true;
        markStarted();
      });
    }
    // Single send. Any send failure below is durably marked outcome_unknown
    // (no invented receipt, no GET retry); the original classification is
    // preserved and breaker-observed.
    // U6 fix1 (F5): one abort/timeout scope spans fetch AND body consumption
    // (overall GET deadline). The timer/listener stay alive until the body is
    // fully consumed; a stalled read or caller abort interrupts the pending
    // read, cancels the reader, and settles exactly once via the catches below.
    const scope = createGetScope(input.signal, config.timeoutMs);
    try {
    let response: Response;
    try {
      track.contacted = true;
      markStarted();
      response = await fetchOnce(input, scope);
      } catch (error) {
        const failure = toSendFailure(error, input, scope);
        if (policy !== null && isBreakerFailure(failure.outcome)) {
          recordBreakerFailure(policy, state, now());
        }
        await finalize(grant.callId, {
          status: 'outcome_unknown', egressStarted: true, outcome: failure.outcome,
          retryable: failure.retryable, providerRequestId: null,
        });
        throw failure;
      }
      // Response processing (never throws past finalize): every branch below
      // finalizes exactly once before returning or throwing.
      let processed: { json?: unknown; headers: Headers; error: ProviderHttpError | null };
      try {
        processed = await processResponse(input, response, scope);
      } catch (error) {
        const failure = error instanceof ProviderHttpError ? error
          : new ProviderHttpError(input.signal.aborted ? 'cancelled' : 'network_failure',
            !input.signal.aborted, 'finalized', true, response.headers, null);
        if (policy !== null && isBreakerFailure(failure.outcome)) {
          recordBreakerFailure(policy, state, now());
        }
        await finalize(grant.callId, {
          status: 'finalized', egressStarted: true, outcome: failure.outcome,
          retryable: failure.retryable, providerRequestId: null,
        });
        throw failure;
      }
      if (processed.error !== null) {
        const failure = processed.error;
        if (policy !== null && isBreakerFailure(failure.outcome)) {
          recordBreakerFailure(policy, state, now());
        }
        const finalized = await finalize(grant.callId, {
          status: 'finalized', egressStarted: true, outcome: failure.outcome,
          retryable: failure.retryable, providerRequestId: null,
        });
        void finalized;
        throw failure;
      }
      const finalized = await finalize(grant.callId, {
        // Neutral per-GET success outcome, mirroring transport.ts:80-81: the
        // logical attempt outcome is finalized later at the attempt level.
        status: 'finalized', egressStarted: true, outcome: 'no_acceptable_match',
        retryable: false, providerRequestId: null,
      });
      void finalized;
      return { json: processed.json, headers: processed.headers, receiptId: finalized.receiptId,
        retentionPolicyVersion };
    } finally {
      scope.dispose();
    }
  }

  // Transport-owned send+parse (S3 bridge). Registration/finalization stay
  // port-owned around it. OpenLibraryFailure outcome/retryability/headers are
  // preserved (S2) so author-isolation catches keep working; 429 also carries
  // the safe Retry-After observation for U5.
  async function serveViaTransport(
    input: ProviderHttpCall,
    callId: string,
    permit: (egressStarted: boolean) => void,
    onSendStart: () => void,
  ): Promise<ProviderHttpResponse> {
    let produced: { json: unknown; headers: Headers };
    try {
      produced = await config.transportSend!(input.url,
        { stage: input.stage, sequence: input.sequence, signal: input.signal }, permit,
        onSendStart);
    } catch (error) {
      const failure = mapTransportFailure(error, input);
      if (policy !== null && isBreakerFailure(failure.outcome)) {
        recordBreakerFailure(policy, state, now());
      }
      // F2: the transport-reported physical status decides finalization:
      // proven-unsent and unknown-send are recorded truthfully, never as
      // finalized egress. egressStarted is false only when nothing was sent.
      // SQL constrains unsent finalization to (stale_rejected, cancelled,
      // false) — coerce the DURABLE record there (the thrown error keeps the
      // true outcome for the caller).
      const unsent = failure.egressStarted === false;
      await finalize(callId, {
        status: failure.physicalStatus, egressStarted: failure.egressStarted,
        outcome: unsent && failure.outcome !== 'cancelled' ? 'cancelled' : failure.outcome,
        retryable: unsent ? false : failure.retryable, providerRequestId: null,
      });
      throw failure;
    }
    const finalized = await finalize(callId, {
      status: 'finalized', egressStarted: true, outcome: 'no_acceptable_match',
      retryable: false, providerRequestId: null,
    });
    void finalized;
    return { json: produced.json, headers: produced.headers, receiptId: finalized.receiptId,
      retentionPolicyVersion };
  }

  function mapTransportFailure(error: unknown, input: ProviderHttpCall): ProviderHttpError {
    if (error instanceof ProviderHttpError) return error;
    // U6 fix1 (F2): the transport reports fetch-started/response-arrived, so
    // the bridge finalizes exactly like the native path — pre-send
    // cancellation or validation failure as proven-unsent, post-start but
    // response-less as outcome-unknown, received responses as finalized —
    // preserving outcome/retryability identity in every case.
    if (error instanceof OpenLibraryFailure) {
      const retryAfterMs = error.outcome === 'rate_limited'
        ? parseRetryAfterMs(error.headers?.get('retry-after') ?? null, now())
        : null;
      if (!error.fetchStarted) {
        return new ProviderHttpError(error.outcome, error.retryable,
          'stale_rejected', false, error.headers, retryAfterMs);
      }
      if (!error.responseReceived) {
        return new ProviderHttpError(error.outcome, error.retryable,
          'outcome_unknown', true, error.headers, retryAfterMs);
      }
      return new ProviderHttpError(error.outcome, error.retryable, 'finalized', true,
        error.headers, retryAfterMs);
    }
    if (input.signal.aborted) {
      return new ProviderHttpError('cancelled', false, 'outcome_unknown', true, null, null);
    }
    return new ProviderHttpError('network_failure', true, 'outcome_unknown', true, null, null);
  }

  function toSendFailure(
    error: unknown, input: ProviderHttpCall, scope: GetScope,
  ): ProviderHttpError {
    if (error instanceof ProviderHttpError) {
      return new ProviderHttpError(error.outcome, error.retryable, 'outcome_unknown', true,
        error.headers, error.retryAfterMs);
    }
    if (input.signal.aborted) {
      return new ProviderHttpError('cancelled', false, 'outcome_unknown', true, null, null);
    }
    if (scope.timedOut()) {
      return new ProviderHttpError('timeout', true, 'outcome_unknown', true, null, null);
    }
    return new ProviderHttpError('network_failure', true, 'outcome_unknown', true, null, null);
  }

  async function finalize(
    callId: string, settled: ProviderHttpSettled,
  ): Promise<{ receiptId: string }> {
    if (!KNOWN_SETTLE_STATUSES.includes(settled.status)) {
      throw new ProviderHttpError('provider_unavailable', false, settled.status, settled.egressStarted, null, null);
    }
    const result = await config.afterRequest(callId, settled);
    // S0: map the durable finalization's provider_call_id to receiptId,
    // validating identity/status. No SQL receiptId field is ever required:
    // without a non-empty string receipt the port refuses instead of
    // inventing one.
    const receiptId = (result !== null && typeof result === 'object'
      && typeof (result as { receiptId?: unknown }).receiptId === 'string'
      && ((result as { receiptId: string }).receiptId.length > 0))
      ? (result as { receiptId: string }).receiptId
      : null;
    if (receiptId === null) {
      throw new ProviderHttpError('provider_unavailable', false, settled.status, settled.egressStarted, null, null);
    }
    return { receiptId };
  }

  // U6 fix1 (F5): one abort/timeout scope per GET, spanning fetch headers AND
  // body consumption (overall GET deadline). Exactly one owner: created here,
  // disposed in serveRegistered's finally after finalization.
  type GetScope = Readonly<{
    signal: AbortSignal;
    timedOut: () => boolean;
    dispose: () => void;
  }>;

  function createGetScope(signal: AbortSignal, timeoutMs: number): GetScope {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const onAbort = (): void => controller.abort();
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
    return {
      signal: controller.signal,
      timedOut: () => timedOut,
      dispose: () => { clearTimeout(timer); signal.removeEventListener('abort', onAbort); },
    };
  }

  async function fetchOnce(input: ProviderHttpCall, scope: GetScope): Promise<Response> {
    return fetcher(input.url, {
      signal: scope.signal, redirect: 'error',
      headers: { Accept: 'application/json', 'User-Agent': 'BookConnect edition lookup' },
    });
  }

  async function processResponse(
    input: ProviderHttpCall, response: Response, scope: GetScope,
  ): Promise<{ json?: unknown; headers: Headers; error: ProviderHttpError | null }> {
    const headers = response.headers;
    const status = response.status;
    if (status === 429 || status >= 500 || status === 404 || !response.ok) {
      void response.body?.cancel().catch(() => {});
      const retryAfterMs = status === 429 ? parseRetryAfterMs(headers.get('retry-after'), now()) : null;
      if (status === 429) {
        return { headers, error: new ProviderHttpError('rate_limited', true, 'finalized', true, headers, retryAfterMs) };
      }
      if (status >= 500) {
        return { headers, error: new ProviderHttpError('provider_unavailable', true, 'finalized', true, headers, retryAfterMs) };
      }
      if (status === 404) {
        return { headers, error: new ProviderHttpError('no_acceptable_match', false, 'finalized', true, headers, null) };
      }
      return { headers, error: new ProviderHttpError('authentication_configuration_failure', false, 'finalized', true, headers, null) };
    }
    if (!/^application\/json(?:\s*;|$)/iu.test(headers.get('content-type') ?? '')) {
      void response.body?.cancel().catch(() => {});
      return { headers, error: new ProviderHttpError('unsupported_content_type', false, 'finalized', true, headers, null) };
    }
    const length = headers.get('content-length');
    if (length !== null && (!/^\d+$/u.test(length) || Number(length) > config.maxResponseBytes)) {
      void response.body?.cancel().catch(() => {});
      return { headers, error: new ProviderHttpError('response_too_large', false, 'finalized', true, headers, null) };
    }
    const reader = response.body?.getReader();
    if (reader === undefined || reader === null) {
      return { headers, error: new ProviderHttpError('malformed_response', false, 'finalized', true, headers, null) };
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    // U6 fix1 (F5): the scope abort (timeout or caller cancel) interrupts a
    // pending read; exactly one listener lives for this body and is removed
    // in the finally below.
    const scopeError = (): ProviderHttpError => scope.timedOut() && !input.signal.aborted
      ? new ProviderHttpError('timeout', true, 'finalized', true, headers, null)
      : new ProviderHttpError('cancelled', false, 'finalized', true, headers, null);
    let onScopeAbort: (() => void) | null = null;
    const scopeAborted = new Promise<never>((_, reject) => {
      onScopeAbort = () => reject(scopeError());
      if (scope.signal.aborted) onScopeAbort();
      else scope.signal.addEventListener('abort', onScopeAbort, { once: true });
    });
    // `void` keeps the rejection handled if the read wins first.
    scopeAborted.catch(() => {});
    try {
      for (;;) {
        if (scope.signal.aborted) {
          void reader.cancel().catch(() => {});
          throw scopeError();
        }
        const chunk = await Promise.race([reader.read(), scopeAborted]);
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > config.maxResponseBytes) {
          void reader.cancel().catch(() => {});
          return { headers, error: new ProviderHttpError('response_too_large', false, 'finalized', true, headers, null) };
        }
        chunks.push(chunk.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      try {
        const json: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        return { json, headers, error: null };
      } catch {
        return { headers, error: new ProviderHttpError('malformed_response', false, 'finalized', true, headers, null) };
      }
    } finally {
      if (onScopeAbort !== null) scope.signal.removeEventListener('abort', onScopeAbort);
      void reader.cancel().catch(() => {});
    }
  }

  return { get, retentionPolicyVersion };
}
