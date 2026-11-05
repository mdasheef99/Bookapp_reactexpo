import { createHash } from 'node:crypto';

const BASE_ENVIRONMENT_NAMES = Object.freeze([
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PHASE9_WORKER_HOST',
  'PHASE9_WORKER_PORT',
  'PHASE9_WORKER_CONCURRENCY',
] as const);

export const SHARED_ENVIRONMENT_NAMES = Object.freeze([
  ...BASE_ENVIRONMENT_NAMES,
  'PHASE9_PEER_WORKER_INGRESS_TOKEN_SHA256',
] as const);

export const MEDIA_ENVIRONMENT_NAMES = Object.freeze([
  ...SHARED_ENVIRONMENT_NAMES,
  'PHASE9_MEDIA_WORKER_ID',
  'PHASE9_MEDIA_WORKER_INGRESS_TOKEN',
  'PHASE9_MEDIA_WORKER_MAGICK_WASM_PATH',
] as const);

export const VISION_ENVIRONMENT_NAMES = Object.freeze([
  ...SHARED_ENVIRONMENT_NAMES,
  'PHASE9_VISION_WORKER_ID',
  'PHASE9_VISION_WORKER_INGRESS_TOKEN',
  'PHASE9_VISION_ANALYZER_MODE',
  'PHASE9_VISION_FIXTURE_CASE',
  'PHASE9_GEMINI_API_KEY',
  'PHASE9_GEMINI_MODEL_ID',
  'PHASE9_GEMINI_TIMEOUT_MS',
] as const);

export const METADATA_ENVIRONMENT_NAMES = Object.freeze([
  ...BASE_ENVIRONMENT_NAMES,
  'PHASE9_METADATA_WORKER_ID',
  'PHASE9_METADATA_WORKER_INGRESS_TOKEN',
  'PHASE9_METADATA_PROVIDER_MODE',
  'PHASE9_GOOGLE_BOOKS_API_KEY',
  'PHASE9_GOOGLE_BOOKS_TIMEOUT_MS',
  'PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES',
  'PHASE9_PROVIDER_CONTACTS',
] as const);
export const PUBLICATION_ENVIRONMENT_NAMES = Object.freeze([
  ...BASE_ENVIRONMENT_NAMES,
  'PHASE9_PUBLICATION_WORKER_ID',
  'PHASE9_PUBLICATION_WORKER_INGRESS_TOKEN',
] as const);

type Environment = Readonly<Record<string, string | undefined>>;

export type WorkerNetworkEnvironment = Readonly<{
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  workerId: string;
  workerAuthToken: string;
  host: string;
  port: number;
  concurrency: 1;
}>;

export type MediaWorkerEnvironment = WorkerNetworkEnvironment & Readonly<{
  magickWasmPath: string;
}>;

export type VisionWorkerEnvironment = WorkerNetworkEnvironment & (
  | Readonly<{ analyzerMode: 'fixture'; fixtureCase: string }>
  | Readonly<{
    analyzerMode: 'gemini';
    apiKey: string;
    modelId: string;
    timeoutMs: number;
  }>
);

export type MetadataWorkerEnvironment = WorkerNetworkEnvironment & (
  | Readonly<{ providerMode: 'fixture'; providerContacts: Readonly<Record<string, string>> }>
  | Readonly<{
    providerMode: 'real';
    apiKey: string | null;
    timeoutMs: number | null;
    maxResponseBytes: number | null;
    providerContacts: Readonly<Record<string, string>>;
  }>
  // Bounded legacy alias for one release: 'google_books' keeps exactly
  // today's meaning — the complete Google set is required with today's
  // bounds — and then boots like `real` with a key. Only `real` may boot
  // keyless (OL-only). The supplied spelling is preserved so existing
  // Google-primary configuration keeps today's behaviour.
  | Readonly<{
    providerMode: 'google_books';
    apiKey: string;
    timeoutMs: number;
    maxResponseBytes: number;
    providerContacts: Readonly<Record<string, string>>;
  }>
);
export type PublicationWorkerEnvironment = WorkerNetworkEnvironment;

const secretPattern = /^[A-Za-z0-9._~+/=-]{32,256}$/u;
const workerIdPattern = /^[A-Za-z0-9._:-]{16,128}$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;
const hostPattern = /^(?:localhost|0\.0\.0\.0|127\.0\.0\.1|::|[A-Za-z0-9.-]{1,253})$/u;
const fixturePattern = /^[a-z][a-z0-9_]{1,63}$/u;
const modelPattern = /^[a-z][a-z0-9._-]{1,63}$/u;
export const APPROVED_PHASE9_SUPABASE_HOSTNAME = 'ahntbtktjjmvfosgkmgn.supabase.co';

function invalid(): never {
  throw new Error('P9_WORKER_CONFIGURATION_INVALID');
}

function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  return value || invalid();
}

function rejectUnknownPhase9Names(environment: Environment, allowed: readonly string[]): void {
  const allowlist = new Set(allowed);
  for (const name of Object.keys(environment)) {
    if ((name.startsWith('PHASE9_') || name.startsWith('SUPABASE_'))
      && !allowlist.has(name)) invalid();
  }
}

function parseUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password
      || parsed.hostname !== APPROVED_PHASE9_SUPABASE_HOSTNAME || parsed.port
      || parsed.pathname !== '/' || parsed.search || parsed.hash) invalid();
    return parsed.toString().replace(/\/$/u, '');
  } catch {
    return invalid();
  }
}

function parsePort(value: string): number {
  if (!/^[1-9][0-9]{0,4}$/u.test(value)) invalid();
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) invalid();
  return port;
}

function validateSecret(value: string): string {
  if (!secretPattern.test(value) || new Set(value).size < 12) invalid();
  return value;
}

// Unit B: server-side contact map for identifying provider User-Agent
// values. ONE variable holding a JSON object {contactId: contact}. Absent
// or whitespace-only means no contacts ({}); an empty object is accepted.
// A present value must parse, with keys matching the registry contactId
// rule and values printable ASCII 0x20-0x7E, 1..200 chars after trim, never
// empty/whitespace-only. The RAW parsed value is checked for printable
// ASCII BEFORE trimming, so leading/trailing CR/LF/TAB are rejected rather
// than trimmed away. Rejects malformed JSON, non-string values,
// Unicode/emoji, CR/LF and control characters.
// The map is built with a NULL prototype so inherited names ('toString',
// 'constructor', ...) can never resolve, and '__proto__' is rejected at
// startup: silently dropping it would fail closed later, while storing it
// would not survive the JSON/spread round-trips the map goes through.
const CONTACT_ID_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/u;
const CONTACT_VALUE_PATTERN = /^[\x20-\x7E]+$/u;

function parseProviderContacts(environment: Environment): Readonly<Record<string, string>> {
  const raw = environment.PHASE9_PROVIDER_CONTACTS?.trim() || null;
  if (raw === null) return Object.freeze(Object.create(null) as Record<string, string>);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return invalid();
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) invalid();
  const result: Record<string, string> = Object.create(null);
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (key === '__proto__' || !CONTACT_ID_PATTERN.test(key)) invalid();
    if (typeof value !== 'string') invalid();
    // F2: printable-ASCII on the RAW value first; trim only afterwards.
    const rawContact = value as string;
    if (!CONTACT_VALUE_PATTERN.test(rawContact)) invalid();
    const contact = rawContact.trim();
    if (contact.length < 1 || contact.length > 200) invalid();
    result[key] = contact;
  }
  return Object.freeze(result);
}

function validateCommon(
  environment: Environment,
  allowed: readonly string[],
  idName: string,
  tokenName: string,
  peerTokenRequired: boolean,
) {
  rejectUnknownPhase9Names(environment, allowed);
  const supabaseUrl = parseUrl(required(environment, 'SUPABASE_URL'));
  const supabaseServiceRoleKey = validateSecret(
    required(environment, 'SUPABASE_SERVICE_ROLE_KEY'),
  );
  const workerId = required(environment, idName);
  const workerAuthToken = validateSecret(required(environment, tokenName));
  const peerTokenHash = peerTokenRequired
    ? required(environment, 'PHASE9_PEER_WORKER_INGRESS_TOKEN_SHA256') : null;
  const host = required(environment, 'PHASE9_WORKER_HOST');
  const port = parsePort(required(environment, 'PHASE9_WORKER_PORT'));
  const concurrency = required(environment, 'PHASE9_WORKER_CONCURRENCY');

  if (!workerIdPattern.test(workerId) || !hostPattern.test(host)
    || concurrency !== '1'
    || (peerTokenRequired && (peerTokenHash === null || !sha256Pattern.test(peerTokenHash)))
    || workerAuthToken === supabaseServiceRoleKey
    || (peerTokenHash !== null
      && createHash('sha256').update(workerAuthToken).digest('hex') === peerTokenHash)) invalid();

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    workerId,
    workerAuthToken,
    host,
    port,
    concurrency: 1 as const,
  };
}

export function loadMediaWorkerEnvironment(
  environment: Environment,
): MediaWorkerEnvironment {
  const common = validateCommon(
    environment,
    MEDIA_ENVIRONMENT_NAMES,
    'PHASE9_MEDIA_WORKER_ID',
    'PHASE9_MEDIA_WORKER_INGRESS_TOKEN',
    true,
  );
  const magickWasmPath = required(environment, 'PHASE9_MEDIA_WORKER_MAGICK_WASM_PATH');
  if (magickWasmPath.includes('\0') || magickWasmPath.length > 1_024) invalid();
  return { ...common, magickWasmPath };
}

export function loadVisionWorkerEnvironment(
  environment: Environment,
): VisionWorkerEnvironment {
  const common = validateCommon(
    environment,
    VISION_ENVIRONMENT_NAMES,
    'PHASE9_VISION_WORKER_ID',
    'PHASE9_VISION_WORKER_INGRESS_TOKEN',
    true,
  );
  const analyzerMode = environment.PHASE9_VISION_ANALYZER_MODE?.trim() || 'fixture';
  if (analyzerMode === 'fixture') {
    const fixtureCase = required(environment, 'PHASE9_VISION_FIXTURE_CASE');
    if (!fixturePattern.test(fixtureCase)
      || environment.PHASE9_GEMINI_API_KEY
      || environment.PHASE9_GEMINI_MODEL_ID
      || environment.PHASE9_GEMINI_TIMEOUT_MS) invalid();
    return { ...common, analyzerMode, fixtureCase };
  }
  if (analyzerMode !== 'gemini' || environment.PHASE9_VISION_FIXTURE_CASE) invalid();
  const apiKey = validateSecret(required(environment, 'PHASE9_GEMINI_API_KEY'));
  const modelId = required(environment, 'PHASE9_GEMINI_MODEL_ID');
  const timeoutText = required(environment, 'PHASE9_GEMINI_TIMEOUT_MS');
  if (!modelPattern.test(modelId) || !/^[1-9][0-9]{2,5}$/u.test(timeoutText)) invalid();
  const timeoutMs = Number(timeoutText);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000) invalid();
  return { ...common, analyzerMode, apiKey, modelId, timeoutMs };
}

export function loadMetadataWorkerEnvironment(
  environment: Environment,
): MetadataWorkerEnvironment {
  const common = validateCommon(
    environment,
    METADATA_ENVIRONMENT_NAMES,
    'PHASE9_METADATA_WORKER_ID',
    'PHASE9_METADATA_WORKER_INGRESS_TOKEN',
    false,
  );
  const providerMode = environment.PHASE9_METADATA_PROVIDER_MODE?.trim() || 'fixture';
  // F4: parse and validate the contact map BEFORE branching on provider
  // mode, so a malformed value fails in fixture mode too. Absence still
  // boots ({}) in every mode.
  const providerContacts = parseProviderContacts(environment);
  if (providerMode === 'fixture') {
    if (environment.PHASE9_GOOGLE_BOOKS_API_KEY
      || environment.PHASE9_GOOGLE_BOOKS_TIMEOUT_MS
      || environment.PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES) invalid();
    return { ...common, providerMode, providerContacts };
  }
  // Bounded legacy alias (Owner ruling, U3 fix pass 1): 'google_books' keeps
  // exactly today's meaning — the complete Google set (key + timeout +
  // max-bytes, today's bounds) is required — and then boots like `real` with
  // a key. Only `real` may boot keyless (OL-only): an absent key means Google
  // is not ready (no Google egress) without preventing startup. A whitespace-
  // only Google value counts as absent. No OL env names: an OL-only boot uses
  // the bootstrap's OL-only operational defaults (bootstrap.ts).
  if (providerMode === 'google_books') {
    const apiKey = validateSecret(required(environment, 'PHASE9_GOOGLE_BOOKS_API_KEY'));
    const timeoutText = required(environment, 'PHASE9_GOOGLE_BOOKS_TIMEOUT_MS');
    const bytesText = required(environment, 'PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES');
    if (!/^[1-9][0-9]{2,5}$/u.test(timeoutText)
      || !/^[1-9][0-9]{4,6}$/u.test(bytesText)) invalid();
    const timeoutMs = Number(timeoutText);
    const maxResponseBytes = Number(bytesText);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000
      || !Number.isInteger(maxResponseBytes)
      || maxResponseBytes < 16_384 || maxResponseBytes > 2_000_000) invalid();
    return { ...common, providerMode, apiKey, timeoutMs, maxResponseBytes,
      providerContacts: parseProviderContacts(environment) };
  }
  if (providerMode !== 'real') invalid();
  const rawApiKey = environment.PHASE9_GOOGLE_BOOKS_API_KEY?.trim() || null;
  const rawTimeoutText = environment.PHASE9_GOOGLE_BOOKS_TIMEOUT_MS?.trim() || null;
  const rawBytesText = environment.PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES?.trim() || null;
  if (rawApiKey === null) {
    if (rawTimeoutText !== null || rawBytesText !== null) invalid();
    return { ...common, providerMode, apiKey: null, timeoutMs: null, maxResponseBytes: null,
      providerContacts: parseProviderContacts(environment) };
  }
  if (rawTimeoutText === null || rawBytesText === null) invalid();
  const apiKey = validateSecret(rawApiKey);
  if (!/^[1-9][0-9]{2,5}$/u.test(rawTimeoutText)
    || !/^[1-9][0-9]{4,6}$/u.test(rawBytesText)) invalid();
  const timeoutMs = Number(rawTimeoutText);
  const maxResponseBytes = Number(rawBytesText);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000
    || !Number.isInteger(maxResponseBytes)
    || maxResponseBytes < 16_384 || maxResponseBytes > 2_000_000) invalid();
  return { ...common, providerMode, apiKey, timeoutMs, maxResponseBytes,
    providerContacts: parseProviderContacts(environment) };
}

export function loadPublicationWorkerEnvironment(
  environment: Environment,
): PublicationWorkerEnvironment {
  return validateCommon(
    environment,
    PUBLICATION_ENVIRONMENT_NAMES,
    'PHASE9_PUBLICATION_WORKER_ID',
    'PHASE9_PUBLICATION_WORKER_INGRESS_TOKEN',
    false,
  );
}
