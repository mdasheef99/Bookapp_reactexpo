// Wire fixture for public.phase9_provider_configuration_v1() (M89 read).
// Shape: {version:'p9-provider-configuration-v1',providers:[...]} ordered by
// adapter_key; every row carries the exact 30 service-read keys. Values model
// the reviewed 8a transition rows from M73/M89 and the fixture preflight, not
// live state.
import { providerManifestKey } from '../../support/providerModules';

export const PROVIDER_CONFIGURATION_VERSION = 'p9-provider-configuration-v1' as const;

// Recorded M83:1355 note. Exported so a drift guard can compare it to the live
// migration value instead of silently accepting a null fixture note.
export const OPEN_LIBRARY_SHARED_SOURCE_NOTE =
  'Open Library; normalized bibliographic facts retained for shared public reuse; attribution: Open Library; no raw response or image file retained.';

const contract = (adapterKey: string, adapterVersion: string) => ({
  validationContract: adapterKey === 'google_books'
    ? 'google-books-v1' : `open-library-v${adapterVersion.startsWith('2') ? '2' : '1'}`,
  hostPolicyVersion: `${adapterKey.replace(/_/gu, '-')}-hosts-v1`,
  capabilityVersion: `${adapterKey.replace(/_/gu, '-')}-capability-v${adapterVersion.startsWith('2') ? '2' : '1'}`,
  normalizerVersion: 'p9-bibliographic-normalizer-v1',
  payloadSchemaVersion: 'p9-metadata-v1',
  lookupSchemaVersion: 'p9-metadata-foundation-v1',
});

const google = {
  providerKind: 'metadata',
  enabled: true,
  matchingAllowed: true,
  storageAllowed: true,
  publicDisplayAllowed: false,
  imageCacheAllowed: false,
  attributionRequired: false,
  revalidationSeconds: 86400,
  rawRetentionSeconds: 604800,
  policyVersion: 1,
  sharedSourceNote: null,
  automaticLookupAllowed: true,
  explicitSearchAllowed: false,
  sharedCatalogueAllowed: false,
  automaticRole: 'primary',
  explicitRole: null,
  automaticOrder: 1,
  explicitOrder: null,
  acceptedAdapterVersions: ['1.0.0'],
  versionContracts: {'1.0.0': contract('google_books', '1.0.0')},
  validationContract: 'google-books-v1',
  hostPolicyVersion: 'google-books-hosts-v1',
  approvedRequestHosts: ['www.googleapis.com'],
  approvedBookHosts: ['books.google.com'],
  approvedCoverHosts: ['books.google.com'],
  optionsRetentionSeconds: null,
  displayLabel: 'Google Books',
  protectionPolicy: null,
} as const;

const openLibraryV1 = {
  providerKind: 'metadata',
  enabled: true,
  matchingAllowed: true,
  storageAllowed: true,
  publicDisplayAllowed: true,
  imageCacheAllowed: false,
  attributionRequired: true,
  revalidationSeconds: 86400,
  rawRetentionSeconds: 0,
  policyVersion: 1,
  sharedSourceNote: OPEN_LIBRARY_SHARED_SOURCE_NOTE,
  automaticLookupAllowed: false,
  explicitSearchAllowed: true,
  sharedCatalogueAllowed: true,
  automaticRole: null,
  explicitRole: 'primary',
  automaticOrder: null,
  explicitOrder: 1,
  acceptedAdapterVersions: ['1.0.0'],
  versionContracts: {'1.0.0': contract('open_library', '1.0.0')},
  validationContract: 'open-library-v1',
  hostPolicyVersion: 'open-library-hosts-v1',
  approvedRequestHosts: ['openlibrary.org'],
  approvedBookHosts: ['openlibrary.org'],
  approvedCoverHosts: ['covers.openlibrary.org'],
  optionsRetentionSeconds: 86400,
  displayLabel: 'Open Library',
  protectionPolicy: null,
} as const;

const openLibraryV2 = {
  ...openLibraryV1,
  automaticLookupAllowed: true,
  automaticRole: 'primary',
  automaticOrder: 1,
  acceptedAdapterVersions: ['1.0.0', '2.0.0'],
  versionContracts: {
    '1.0.0': contract('open_library', '1.0.0'),
    '2.0.0': contract('open_library', '2.0.0'),
  },
  validationContract: 'open-library-v2',
} as const;

const defaults = (adapterKey: string, adapterVersion: string) => {
  if (adapterKey === 'google_books') return google;
  if (adapterKey === 'open_library' && adapterVersion === '2.0.0') return openLibraryV2;
  return openLibraryV1;
};

export type ProviderConfigurationRow = Readonly<Record<string, unknown>>;

export function providerConfigurationRow(
  adapterKey: string,
  adapterVersion: string,
  overrides: Readonly<Record<string, unknown>> = {},
): ProviderConfigurationRow {
  return Object.freeze({
    adapterKey,
    ...defaults(adapterKey, adapterVersion),
    adapterVersion,
    ...overrides,
  });
}

export function providerConfigurationSnapshot(
  rows: readonly ProviderConfigurationRow[],
): Readonly<{version: typeof PROVIDER_CONFIGURATION_VERSION; providers: readonly ProviderConfigurationRow[]}> {
  return Object.freeze({
    version: PROVIDER_CONFIGURATION_VERSION,
    providers: Object.freeze([...rows].sort((left, right) =>
      String(left.adapterKey).localeCompare(String(right.adapterKey)))),
  });
}

const purposesFor = (adapterKey: string, adapterVersion: string) => {
  // The v1 OL adapter's lookup() throws P9_OPEN_LIBRARY_AUTOMATIC_LOOKUP_FORBIDDEN;
  // automatic support starts only with the proposed 2.0.0 descriptor.
  if (adapterKey === 'open_library' && adapterVersion === '1.0.0') {
    return ['edition_options'] as const;
  }
  return ['automatic', 'edition_options'] as const;
};

const descriptor = (
  adapterKey: string,
  adapterVersion: string,
  overrides: Readonly<Record<string, unknown>> = {},
) => ({
  adapterKey,
  adapterVersion,
  capabilityVersion: `${adapterKey.replace(/_/gu, '-')}-capability-v${adapterVersion.startsWith('2') ? '2' : '1'}`,
  normalizerVersion: 'p9-bibliographic-normalizer-v1',
  payloadSchemaVersion: 'p9-metadata-v1',
  lookupSchemaVersion: 'p9-metadata-foundation-v1',
  validationContract: adapterKey === 'google_books'
    ? 'google-books-v1' : `open-library-v${adapterVersion.startsWith('2') ? '2' : '1'}`,
  hostPolicyVersion: `${adapterKey.replace(/_/gu, '-')}-hosts-v1`,
  retentionContract: adapterKey === 'open_library' ? 'open-library-options-v1' : null,
  protocol: adapterKey === 'open_library'
    ? {kind: 'fanout', maxGets: 6} : {kind: 'single', maxGets: 1},
  purposes: purposesFor(adapterKey, adapterVersion),
  credentialsReady: () => true,
  retentionReady: () => true,
  invoke: async () => { throw new Error('route fixture descriptor does not invoke'); },
  ...overrides,
});

export function installedProviderDescriptor(
  adapterKey: string,
  adapterVersion: string,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return descriptor(adapterKey, adapterVersion, overrides);
}

export function installedProviderDescriptors() {
  return new Map<string, ReturnType<typeof descriptor>>([
    [providerManifestKey('google_books', '1.0.0'), descriptor('google_books', '1.0.0')],
    [providerManifestKey('open_library', '1.0.0'), descriptor('open_library', '1.0.0')],
    [providerManifestKey('open_library', '2.0.0'), descriptor('open_library', '2.0.0')],
  ]);
}
