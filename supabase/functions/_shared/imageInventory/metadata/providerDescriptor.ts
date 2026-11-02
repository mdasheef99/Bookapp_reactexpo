import type { CatalogueWriteCompanion } from '../contracts/catalogueWrite';
import type { StoredEditionRow } from '../contracts/ownerEditionPicker';
import type { MetadataQueryIdentity } from './queryIdentity';
import type { MetadataProviderOutcome } from './providerAdapter';
import { createGoogleBooksDescriptor } from './googleBooks/descriptor';
import { createOpenLibraryV1Descriptor } from './openLibrary/descriptor';

export type Purpose = 'automatic' | 'edition_options';
export type RetentionContractId = string;
export type ProviderResultVersion = 'p9-metadata-result-v2';
export const PROVIDER_RESULT_VERSION: ProviderResultVersion = 'p9-metadata-result-v2';

export type ProviderHttpResponse = Readonly<{
  json: unknown;
  headers: Headers;
  receiptId: string;
}>;

export type ProviderHttpPort = Readonly<{
  get(input: Readonly<{
    url: URL;
    stage: string;
    sequence: number;
    signal: AbortSignal;
  }>): Promise<ProviderHttpResponse>;
}>;

export type LookupInput = Readonly<{
  query: MetadataQueryIdentity;
  correlationId: string;
  attemptId: string;
  signal: AbortSignal;
  purpose: Purpose;
  http: ProviderHttpPort;
}>;

export type RetainedList = Readonly<{
  sourceFetchedAt: string;
  permittedDeadlineAt: string;
  policyVersion: number;
  storagePermissionVerified: true;
  retentionContract: RetentionContractId;
}>;

// Trusted output of the installed verifier, bound to the actual response
// headers. It contains no self-asserted permission flag: the result boundary
// requires this evidence before accepting any retained list.
export type VerifiedRetention = Readonly<{
  sourceFetchedAt: string;
  permittedDeadlineAt: string;
  policyVersion: number;
  retentionContract: RetentionContractId;
}>;

export type MetadataResultV2 = Readonly<{
  version: ProviderResultVersion;
  purpose: Purpose;
  outcome: MetadataProviderOutcome;
  rows: readonly StoredEditionRow[] | null;
  catalogueCompanions: readonly CatalogueWriteCompanion[] | null;
  retention: RetainedList | null;
}>;

export type ProviderProtocol =
  | Readonly<{ kind: 'single'; maxGets: 1 }>
  | Readonly<{ kind: 'fanout'; maxGets: 6 }>;

export type ProviderDescriptor = Readonly<{
  adapterKey: string;
  adapterVersion: string;
  capabilityVersion: string;
  normalizerVersion: string;
  payloadSchemaVersion: string;
  lookupSchemaVersion: string;
  validationContract: string;
  hostPolicyVersion: string;
  retentionContract: RetentionContractId | null;
  protocol: ProviderProtocol;
  purposes: readonly Purpose[];
  credentialsReady(): boolean;
  retentionReady(purpose: Purpose): boolean;
  invoke(input: LookupInput): Promise<MetadataResultV2>;
}>;

export const providerManifestKey = (adapterKey: string, adapterVersion: string): string =>
  `${adapterKey}@${adapterVersion}`;

export const PHASE9_METADATA_INSTALLED_PROVIDERS: ReadonlyMap<string, ProviderDescriptor> =
  new Map<string, ProviderDescriptor>([
    [providerManifestKey('google_books', '1.0.0'), createGoogleBooksDescriptor({ adapter: null })],
    [providerManifestKey('open_library', '1.0.0'), createOpenLibraryV1Descriptor({ adapter: null })],
  ]);
