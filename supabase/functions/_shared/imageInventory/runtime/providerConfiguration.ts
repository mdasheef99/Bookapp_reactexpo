// U2: strict parser for the M89 service read
// `public.phase9_provider_configuration_v1()` into a RegistrySnapshot.
// Unknown/missing keys or bad values throw P9_PROVIDER_CONFIGURATION_INVALID;
// a partial snapshot is never returned.
import type {
  RegistryProviderRow,
  RegistrySnapshot,
} from '../metadata/providerDescriptor';
import { P9_PROVIDER_CONFIGURATION_INVALID } from '../metadata/providerDescriptor';

const VERSION_IDENTIFIER = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/u;
const CONTRACT_IDENTIFIER = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/u;
// M89:279-290 DTO keys; M89:41-128 validator bounds; M01:4-16 column bounds.
// Every bound below cites its SQL source; nothing stricter is invented.
// - adapter_key/adapter_version: text, no pattern (M01:4-7 PRIMARY KEY, no
//   CHECK; M89:41-128 imposes no key pattern, only the accepted-version
//   regex M89:68 and active-version inclusion M89:90-93).
// - provider_kind: 'vision'|'metadata'|'alias' (M01:6 CHECK).
// - revalidation_seconds: nullable, positive when present (M01:14 CHECK).
// - raw_retention_seconds: integer >= 0, NOT NULL (M01:15).
// - policy_version: integer > 0 (M01:16).
// - options_retention_seconds: nullable integer 1..86400 (M89:104-106).
// - integer columns stay within PostgreSQL integer range (M01:14-16;
//   M89:119-124 caps protection numerics at 2^31-1).
const PG_INT_MAX = 2147483647;const DNS_NAME =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/u;
const NUMERIC_HOST = /^[0-9.]+$/u;
const CONTACT_ID = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/u;
const MAX_SAFE_32 = 2147483647;

const CONTRACT_TUPLE_KEYS = [
  'validationContract', 'hostPolicyVersion', 'capabilityVersion',
  'normalizerVersion', 'payloadSchemaVersion', 'lookupSchemaVersion',
] as const;

const PROTECTION_KEYS = [
  'version', 'minIntervalMs', 'storeWindowSeconds', 'storeMaxGets',
  'backoffBaseMs', 'backoffMaxMs', 'breakerFailures', 'breakerWindowSeconds',
  'breakerCooldownMs', 'halfOpenMax', 'mode', 'contactId',
] as const;

const NUMERIC_PROTECTION_KEYS = [
  'minIntervalMs', 'storeWindowSeconds', 'storeMaxGets',
  'backoffBaseMs', 'backoffMaxMs', 'breakerFailures', 'breakerWindowSeconds',
  'breakerCooldownMs', 'halfOpenMax',
] as const;

// The exact 30 service-read DTO keys (M89:279-290). The old seven-key context
// policy and eight-key source-policy DTOs remain exact and untouched.
const ROW_KEYS = [
  'adapterKey', 'providerKind', 'adapterVersion', 'enabled', 'matchingAllowed',
  'storageAllowed', 'publicDisplayAllowed', 'imageCacheAllowed',
  'attributionRequired', 'revalidationSeconds', 'rawRetentionSeconds',
  'policyVersion', 'sharedSourceNote', 'automaticLookupAllowed',
  'explicitSearchAllowed', 'sharedCatalogueAllowed', 'automaticRole',
  'explicitRole', 'automaticOrder', 'explicitOrder', 'acceptedAdapterVersions',
  'versionContracts', 'validationContract', 'hostPolicyVersion',
  'approvedRequestHosts', 'approvedBookHosts', 'approvedCoverHosts',
  'optionsRetentionSeconds', 'displayLabel', 'protectionPolicy',
] as const;

function invalid(): never {
  throw new Error(P9_PROVIDER_CONFIGURATION_INVALID);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasOnly = (row: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(row).length === keys.length && keys.every((key) => key in row);

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

// M01:14-16: integer columns within PostgreSQL integer range.
const isIntInRange = (value: unknown, min: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value)
  && value >= min && value <= PG_INT_MAX;

const isRole = (value: unknown): value is 'primary' | 'secondary' | null =>
  value === null || value === 'primary' || value === 'secondary';

const isOrder = (value: unknown): value is 1 | 2 | null =>
  value === null || value === 1 || value === 2;

function parseHosts(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 8) invalid();
  const hosts = [...value];
  if (hosts.some((host) => typeof host !== 'string'
    || host.length > 253 || !DNS_NAME.test(host) || NUMERIC_HOST.test(host))
    || new Set(hosts).size !== hosts.length) invalid();
  return Object.freeze(hosts as string[]);
}

function parseVersionContracts(
  value: unknown,
  accepted: readonly string[],
): RegistryProviderRow['versionContracts'] {
  if (!isRecord(value)) invalid();
  const keys = Object.keys(value);
  if (keys.length !== accepted.length
    || keys.some((key) => !accepted.includes(key))) invalid();
  const contracts: Record<string, Record<string, string>> = {};
  for (const key of keys) {
    const tuple = value[key];
    if (!isRecord(tuple) || !hasOnly(tuple, CONTRACT_TUPLE_KEYS)) invalid();
    const parsed: Record<string, string> = {};
    for (const field of CONTRACT_TUPLE_KEYS) {
      const entry = (tuple as Record<string, unknown>)[field];
      if (typeof entry !== 'string' || !CONTRACT_IDENTIFIER.test(entry)) invalid();
      parsed[field] = entry as string;
    }
    contracts[key] = Object.freeze(parsed);
  }
  return Object.freeze(contracts);
}

function parseProtectionPolicy(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  if (!isRecord(value) || !hasOnly(value, PROTECTION_KEYS)) invalid();
  if (value.version !== 'p9-protection-v1'
    || (value.mode !== 'single_instance' && value.mode !== 'shared_db')
    || typeof value.contactId !== 'string' || !CONTACT_ID.test(value.contactId)) {
    invalid();
  }
  for (const key of NUMERIC_PROTECTION_KEYS) {
    const entry = value[key];
    if (typeof entry !== 'number' || !Number.isSafeInteger(entry)
      || entry < 1 || entry > MAX_SAFE_32) invalid();
  }
  if (value.halfOpenMax !== 1
    || (value.backoffBaseMs as number) > (value.backoffMaxMs as number)) invalid();
  return Object.freeze({ ...value });
}

function parseRow(value: unknown): RegistryProviderRow {
  if (!isRecord(value) || !hasOnly(value, ROW_KEYS)) invalid();
  const {
    adapterKey, providerKind, adapterVersion, enabled, matchingAllowed,
    storageAllowed, publicDisplayAllowed, imageCacheAllowed, attributionRequired,
    revalidationSeconds, rawRetentionSeconds, policyVersion, sharedSourceNote,
    automaticLookupAllowed, explicitSearchAllowed, sharedCatalogueAllowed,
    automaticRole, explicitRole, automaticOrder, explicitOrder,
    acceptedAdapterVersions, versionContracts, validationContract,
    hostPolicyVersion, approvedRequestHosts, approvedBookHosts,
    approvedCoverHosts, optionsRetentionSeconds, displayLabel, protectionPolicy,
  } = value;
  if (typeof adapterKey !== 'string'
    || typeof providerKind !== 'string'
    || !['vision', 'metadata', 'alias'].includes(providerKind)
    || typeof adapterVersion !== 'string'
    || !isBoolean(enabled) || !isBoolean(matchingAllowed)
    || !isBoolean(storageAllowed) || !isBoolean(publicDisplayAllowed)
    || !isBoolean(imageCacheAllowed) || !isBoolean(attributionRequired)
    || !isIntInRange(revalidationSeconds ?? 1, 1)
    || !isIntInRange(rawRetentionSeconds, 0)
    || !isIntInRange(policyVersion, 1)
    || (sharedSourceNote !== null && typeof sharedSourceNote !== 'string')
    || !isBoolean(automaticLookupAllowed) || !isBoolean(explicitSearchAllowed)
    || !isBoolean(sharedCatalogueAllowed)
    || !isRole(automaticRole) || !isRole(explicitRole)
    || !isOrder(automaticOrder) || !isOrder(explicitOrder)
    || (automaticRole === null) !== (automaticOrder === null)
    || (explicitRole === null) !== (explicitOrder === null)
    || (automaticRole === 'primary' && automaticOrder !== 1)
    || (automaticRole === 'secondary' && automaticOrder !== 2)
    || (explicitRole === 'primary' && explicitOrder !== 1)
    || (explicitRole === 'secondary' && explicitOrder !== 2)
    || (automaticRole !== null && automaticLookupAllowed !== true)
    || (explicitRole !== null && explicitSearchAllowed !== true)
    || !Array.isArray(acceptedAdapterVersions)
    || acceptedAdapterVersions.length > 8
    || acceptedAdapterVersions.some((version) =>
      typeof version !== 'string' || !VERSION_IDENTIFIER.test(version))
    || new Set(acceptedAdapterVersions).size !== acceptedAdapterVersions.length) {
    invalid();
  }
  const accepted = Object.freeze(
    [...(acceptedAdapterVersions as string[])],
  ) as readonly string[];
  const contracts = parseVersionContracts(versionContracts, accepted);
  if (accepted.length === 0) {
    // M89:134-140: an unconfigured row acquires no new permission or route.
    if (automaticLookupAllowed === true || explicitSearchAllowed === true
      || sharedCatalogueAllowed === true
      || validationContract !== null || hostPolicyVersion !== null) invalid();
  } else {
    if (!(accepted as readonly string[]).includes(adapterVersion as string)
      || validationContract
        !== (contracts[adapterVersion as string] as Record<string, string> | undefined)
          ?.validationContract
      || hostPolicyVersion
        !== (contracts[adapterVersion as string] as Record<string, string> | undefined)
          ?.hostPolicyVersion) {
      invalid();
    }
  }
  if (validationContract !== null && typeof validationContract !== 'string') invalid();
  if (hostPolicyVersion !== null && typeof hostPolicyVersion !== 'string') invalid();
  const requestHosts = parseHosts(approvedRequestHosts);
  const bookHosts = parseHosts(approvedBookHosts);
  const coverHosts = parseHosts(approvedCoverHosts);
  if (accepted.length === 0
    && (requestHosts.length > 0 || bookHosts.length > 0 || coverHosts.length > 0)) {
    invalid();
  }
  if (optionsRetentionSeconds !== null
    && (!isIntInRange(optionsRetentionSeconds, 1)
      || optionsRetentionSeconds > 86400)) invalid();
  if (displayLabel !== null
    && (typeof displayLabel !== 'string' || displayLabel.length < 1
      || displayLabel.length > 80 || displayLabel.trim().length === 0
      // M89:106-107: no control characters, angle brackets or backslashes.
      || /[<>\\]/u.test(displayLabel)
      || /[\u0000-\u001f\u007f-\u009f]/u.test(displayLabel))) invalid();
  return Object.freeze({
    adapterKey: adapterKey as string,
    providerKind: providerKind as string,
    adapterVersion: adapterVersion as string,
    enabled: enabled as boolean,
    matchingAllowed: matchingAllowed as boolean,
    storageAllowed: storageAllowed as boolean,
    automaticLookupAllowed: automaticLookupAllowed as boolean,
    explicitSearchAllowed: explicitSearchAllowed as boolean,
    automaticRole: automaticRole as 'primary' | 'secondary' | null,
    explicitRole: explicitRole as 'primary' | 'secondary' | null,
    automaticOrder: automaticOrder as 1 | 2 | null,
    explicitOrder: explicitOrder as 1 | 2 | null,
    acceptedAdapterVersions: accepted,
    versionContracts: contracts,
    policyVersion: policyVersion as number,
  });
}

export function parseProviderConfigurationSnapshot(value: unknown): RegistrySnapshot {
  if (!isRecord(value)) invalid();
  if (value.version !== 'p9-provider-configuration-v1'
    || !Array.isArray(value.providers)) invalid();
  // Extra top-level keys are rejected: the worker must never act on a DTO it
  // does not fully understand.
  if (!hasOnly(value, ['version', 'providers'])) invalid();
  const providers = (value.providers as unknown[]).map(parseRow);
  return Object.freeze({
    version: 'p9-provider-configuration-v1',
    providers: Object.freeze(providers),
  });
}
