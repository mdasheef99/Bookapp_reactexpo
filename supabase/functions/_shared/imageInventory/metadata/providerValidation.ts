import type { ProviderHostPolicy } from '../contracts/providerReuse';
import { GOOGLE_BOOKS_PROVIDER_VALIDATION } from './googleBooks/validation';
import { OPEN_LIBRARY_PROVIDER_VALIDATION, OPEN_LIBRARY_V2_PROVIDER_VALIDATION } from './openLibrary/validation';

// 02c §3.2: adding a provider installs its own validator/dispatcher entry.
// The generic result boundary only dispatches this port; it never enumerates
// provider names or grammars.
export type ProviderOwnedValidation = Readonly<{
  adapterKey: string;
  adapterVersion: string;
  validationContract: string;
  hostPolicyVersion: string;
  hostPolicy: ProviderHostPolicy;
  validProviderRecordId(value: string): boolean;
  validBookUrl(value: string, providerRecordId: string): boolean;
  validCoverReference(value: string | null, providerRecordId: string): boolean;
  validCompanionRecord(
    providerRecordId: string,
    workExternalId: string | null,
  ): boolean;
}>;

export const PHASE9_PROVIDER_VALIDATIONS: readonly ProviderOwnedValidation[] =
  Object.freeze([
    GOOGLE_BOOKS_PROVIDER_VALIDATION,
    OPEN_LIBRARY_PROVIDER_VALIDATION,
    OPEN_LIBRARY_V2_PROVIDER_VALIDATION,
  ]);

export function installedProviderValidation(
  adapterKey: string,
  adapterVersion: string,
  validationContract: string,
  hostPolicyVersion: string,
): ProviderOwnedValidation | undefined {
  return PHASE9_PROVIDER_VALIDATIONS.find((validation) =>
    validation.adapterKey === adapterKey
    && validation.adapterVersion === adapterVersion
    && validation.validationContract === validationContract
    && validation.hostPolicyVersion === hostPolicyVersion);
}
