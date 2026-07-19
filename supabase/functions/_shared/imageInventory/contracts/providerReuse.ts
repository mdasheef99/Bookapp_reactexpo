import { Phase9ContractError } from '../domain/validation';
import { PHASE9_PROVIDER_REUSE_FIELDS, ProviderFieldReuse } from './registers';

export type ProviderReusePolicy = Readonly<{
  adapterKey: string;
  policyVersion: string;
  fields: readonly ProviderFieldReuse[];
}>;

export type ProviderHostPolicy = Readonly<{
  adapterKey: string;
  policyVersion: string;
  approvedCoverHosts: readonly string[];
}>;

export function assertApprovedProviderHttpsUrl(value: string, policy: ProviderHostPolicy): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Phase9ContractError('cover_reference', 'must be a valid HTTPS URL');
  }
  if (parsed.protocol !== 'https:') throw new Phase9ContractError('cover_reference', 'must use HTTPS');
  if (parsed.username || parsed.password) throw new Phase9ContractError('cover_reference', 'must not contain URL credentials');
  const normalizedHosts = policy.approvedCoverHosts.map((host) => host.trim().toLowerCase());
  if (!normalizedHosts.includes(parsed.hostname.toLowerCase())) {
    throw new Phase9ContractError('cover_reference', 'host is not approved for this provider');
  }
  return parsed.toString();
}

export function validateProviderReusePolicy(policy: ProviderReusePolicy): ProviderReusePolicy {
  if (!policy.adapterKey || !policy.policyVersion) throw new Phase9ContractError('provider_reuse', 'adapter key and policy version are required');
  const seen = new Set<string>();
  for (const rule of policy.fields) {
    if (!PHASE9_PROVIDER_REUSE_FIELDS.includes(rule.field)) {
      throw new Phase9ContractError('provider_reuse.fields', `unsupported field ${rule.field}`);
    }
    if (seen.has(rule.field)) throw new Phase9ContractError('provider_reuse.fields', `duplicate field ${rule.field}`);
    seen.add(rule.field);
    if (!rule.storage && rule.publicDisplay) {
      throw new Phase9ContractError(`provider_reuse.${rule.field}`, 'public display requires storage permission');
    }
    if (rule.field !== 'cover_reference' && rule.imageCache) {
      throw new Phase9ContractError(`provider_reuse.${rule.field}`, 'image cache permission is cover-only');
    }
    if (rule.revalidateAfterSeconds !== null && (!Number.isSafeInteger(rule.revalidateAfterSeconds) || rule.revalidateAfterSeconds < 3600)) {
      throw new Phase9ContractError(`provider_reuse.${rule.field}`, 'revalidation interval must be null or at least one hour');
    }
  }
  return policy;
}

export function mayUseProviderField(
  policy: ProviderReusePolicy,
  field: ProviderFieldReuse['field'],
  use: 'matching' | 'storage' | 'publicDisplay' | 'imageCache',
): boolean {
  return policy.fields.find((rule) => rule.field === field)?.[use] === true;
}
