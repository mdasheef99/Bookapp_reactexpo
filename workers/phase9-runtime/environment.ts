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
  | Readonly<{ providerMode: 'fixture' }>
  | Readonly<{
    providerMode: 'google_books';
    apiKey: string;
    timeoutMs: number;
    maxResponseBytes: number;
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
  if (providerMode === 'fixture') {
    if (environment.PHASE9_GOOGLE_BOOKS_API_KEY
      || environment.PHASE9_GOOGLE_BOOKS_TIMEOUT_MS
      || environment.PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES) invalid();
    return { ...common, providerMode };
  }
  if (providerMode !== 'google_books') invalid();
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
  return { ...common, providerMode, apiKey, timeoutMs, maxResponseBytes };
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
