import type { MetadataProviderAdapter } from '../metadata/providerAdapter';
import { OpenLibraryEditionOptionsAdapter } from '../metadata/openLibrary';
import type { EditionHttpHooks } from '../metadata/openLibrary/transport';
export type EditionOptionsAdapter = MetadataProviderAdapter & {
  lookupEditionOptions(input: Parameters<MetadataProviderAdapter['lookup']>[0] & {
    httpHooks?: EditionHttpHooks;
  }): Promise<EditionOptionsProviderResult>;
};
import { resolveOptionsDeadline } from '../metadata/googleBooks/editionOptions';
import { parseNormalizedMetadataEdition } from '../contracts/metadata';
import { fetchedAtMicros } from '../contracts/catalogueWrite';
import { projectStoredEditionRow } from '../contracts/ownerEditionPicker';
import { GOOGLE_BOOKS_EDITION_HOST_POLICY } from '../metadata/googleBooks/decoder';
import type { EditionOptionsProviderResult } from '../metadata/contracts';
import type { MetadataJobContext } from './metadataJobContext';
import { decideMetadataProductionPolicy } from './metadataProductionComposition';
import type { MetadataProductionGateway } from './metadataProductionComposition';
import type { EditionOptionsFence, EditionOptionsCompletion } from './metadataEditionOptionsBoundary';
import { EditionOptionsCompletionUncertainError, editionOptionsFence } from './metadataEditionOptionsBoundary';

export type MetadataEditionOptionsJobResult = Readonly<{
  outcome: 'edition_options_available' | 'manual_metadata_required' | 'stale_claim' | 'retry_scheduled';
}>;

// Picker §§4.1-4.3/5/9: automatic winner reuse/selection are never called by this operation.
export async function executeEditionOptionsLookup(
  context: MetadataJobContext, gateway: MetadataProductionGateway,
  adapter: EditionOptionsAdapter, signal: AbortSignal, fallback?: OpenLibraryEditionOptionsAdapter,
): Promise<MetadataEditionOptionsJobResult> {
  if (context.purpose !== 'edition_options' || context.requestGeneration === null) {
    throw new Error('P9_EDITION_CONTEXT_INVALID');
  }
  const port = gateway.editionOptions;
  if (!port) return { outcome: 'manual_metadata_required' };
  const { request, boundary } = port;
  if (request.jobId !== context.jobId || request.candidateId !== context.candidateId
    || request.storeId !== context.storeId || request.claimAttempt !== context.attempt
    || request.claimLeaseToken !== context.claimToken || request.query.key !== context.queryIdentity
    || request.claimWorker.length === 0) throw new Error('P9_EDITION_CONTEXT_INVALID');
  const fence: EditionOptionsFence = editionOptionsFence(context,request.claimWorker);
  const fail = async (outcome: EditionOptionsProviderResult['outcome'], retryable: boolean)
    : Promise<MetadataEditionOptionsJobResult> => {
    const completion = await boundary.fail({ ...fence, outcome, retryable });
    const status = completion.status === 'replayed' ? completion.jobStatus : completion.status;
    return { outcome: status === 'retry_scheduled' ? 'retry_scheduled' : 'manual_metadata_required' };
  };
  const completionResult = (completion: EditionOptionsCompletion): MetadataEditionOptionsJobResult | null => {
    if (completion.status === 'stale_rejected') return { outcome: 'stale_claim' };
    if (completion.status === 'missing') return null;
    if (completion.requestId !== fence.requestId || completion.requestGeneration !== fence.requestGeneration
      || !Number.isSafeInteger(completion.optionsVersion) || completion.optionsVersion < 1
      || !Number.isFinite(Date.parse(completion.optionsExpiresAt))) {
      throw new Error('P9_EDITION_COMPLETION_INVALID');
    }
    return Date.parse(completion.optionsExpiresAt) > Date.now()
      ? { outcome: 'edition_options_available' } : { outcome: 'manual_metadata_required' };
  };
  const recoveryOnly = context.currentPhysicalStatus === 'finalized' && context.currentPhysicalRetryable === false
    && context.currentPhysicalClaimAttempt !== context.attempt;
  try {
    if (signal.aborted) return await fail('cancelled', false);
    const recovered = completionResult(await boundary.recover(fence));
    if (recovered) return recovered;
    // 02b sections 7.1/8.1-8.2/10: recover before deriving the current cache tuple.
    // Only SQL's plain miss continues to registration/reservation/provider egress.
    const reused = await boundary.reuseCache({ ...fence, cacheVersions: port.cacheVersions() });
    if (reused.status !== 'miss') {
      return completionResult(reused) ?? { outcome: 'manual_metadata_required' };
    }
    if (signal.aborted) return await fail('cancelled', false);
    const policy = decideMetadataProductionPolicy(request.providerPolicy);
    if (!policy.allowFreshProviderCall || !policy.allowPositiveRetention) return await fail('policy_denied', false);
    // 02b section 10: after recovery proves no receipt, terminate without refetching,
    // after lease reclaim of a finalized nonretryable response.
    if (recoveryOnly) return await fail('provider_unavailable', false);
    if (context.currentPhysicalStatus === 'stale_rejected' && context.currentPhysicalClaimAttempt === context.attempt) return { outcome: 'stale_claim' };
    // Same-claim replay cannot authorize a duplicate physical call when its outcome is known.
    if (context.currentPhysicalStatus === 'finalized' && context.currentPhysicalClaimAttempt === context.attempt) {
      return await fail('provider_unavailable', true);
    }
    const { lookupId } = await gateway.registerLookup(request);
    const { reservationId } = await gateway.reserveUsage({ ...request, lookupId });
    let { attemptId } = await gateway.registerAttempt({ ...request, lookupId, reservationId, providerRole: 'primary' });
    if (signal.aborted) return await fail('cancelled', false);
    let selectedAdapter = adapter;
    if (!(selectedAdapter instanceof OpenLibraryEditionOptionsAdapter)
      && !await gateway.validateEgress({ ...request, lookupId, attemptId })) return { outcome: 'stale_claim' };
    const lookup = async () => selectedAdapter.lookupEditionOptions({
      query: request.query, correlationId: lookupId, attemptId, signal,
      httpHooks: selectedAdapter instanceof OpenLibraryEditionOptionsAdapter
        ? gateway.editionProviderCalls?.createHooks(lookupId,attemptId) : undefined,
    });
    if (selectedAdapter instanceof OpenLibraryEditionOptionsAdapter && !gateway.editionProviderCalls) {
      return await fail('provider_disabled',false);
    }
    let provider: EditionOptionsProviderResult;
    try {
      provider = await lookup();
    } catch(error) {
      if (error instanceof Error && ['P9_METADATA_STALE_PHYSICAL_CALL','P9_EDITION_CONTEXT_INVALID'].includes(error.message)) throw error;
      if (!(selectedAdapter instanceof OpenLibraryEditionOptionsAdapter)) await gateway.finalizeAttempt({
        lookupId, attemptId, normalizedOutcome: 'provider_unavailable', disposition: 'rejected',
        providerRequestId: null, normalizedCandidate: null, retryable: true, physicalStatus: 'outcome_unknown',
      });
      return await fail('provider_unavailable', true);
    }
    // Physical spend is durable separately from options persistence; audits/cache retain no alternatives.
    if (!(selectedAdapter instanceof OpenLibraryEditionOptionsAdapter)) await gateway.finalizeAttempt({
      lookupId, attemptId, normalizedOutcome: provider.outcome, disposition: 'rejected',
      providerRequestId: provider.providerRequestId, normalizedCandidate: null,
      evidence: [], retryable: provider.retryable, physicalStatus: 'finalized',
    });
    if (signal.aborted) return await fail('cancelled', false);
    // Google remains preferred when it has independent retention permission. Denial never invokes a secondary.
    const allowedFallback = ['no_acceptable_match','ambiguous_match','material_conflict','schema_invalid',
      'malformed_response','timeout','rate_limited','provider_unavailable','circuit_breaker_open','network_failure','response_too_large','unsupported_content_type'];
    const googleRetention = provider.fetchedAt && provider.retentionEvidence
      ? resolveOptionsDeadline(provider.fetchedAt,provider.retentionEvidence) : null;
    if (!(selectedAdapter instanceof OpenLibraryEditionOptionsAdapter) && fallback && gateway.editionProviderCalls
      && allowedFallback.includes(provider.outcome) && (provider.fetchedAt === null || googleRetention !== null)
      && !provider.rows.some(row => row.eligibility === 'eligible')) {
      ({ attemptId } = await gateway.editionProviderCalls.registerFallback(request,lookupId,reservationId,attemptId,provider.outcome));
      selectedAdapter = fallback;
      provider = await lookup();
    }
    if (provider.retryable) return await fail(provider.outcome, true);
    if (provider.fetchedAt === null && provider.rows.length === 0) return await fail(provider.outcome, false);
    const expiresAt = provider.fetchedAt && provider.retentionEvidence
      ? resolveOptionsDeadline(provider.fetchedAt, provider.retentionEvidence) : null;
    if (!expiresAt || Date.parse(expiresAt) <= Date.now()) return await fail('policy_denied', false);
    if (!Array.isArray(provider.rows) || provider.rows.length > 10) return await fail('schema_invalid', false);
    try {
      const ids = new Set<string>();
      for (const [ordinal, row] of provider.rows.entries()) {
        projectStoredEditionRow(row);
        if (row.ordinal !== ordinal || ids.has(row.optionId)
          || Object.keys(row).some(key => !['optionId','ordinal','googleBooksUrl','eligibility','metadata'].includes(key))) {
          throw new Error('P9_EDITION_ROWS_INVALID');
        }
        ids.add(row.optionId);
        if (row.metadata !== null) {
          const metadata = parseNormalizedMetadataEdition(row.metadata, selectedAdapter.normalizedEditionHostPolicy);
          if (metadata.adapterKey !== selectedAdapter.normalizedEditionHostPolicy?.adapterKey
            || metadata.correlationId !== lookupId || metadata.attemptId !== attemptId
            || fetchedAtMicros(metadata.fetchedAt) !== fetchedAtMicros(provider.fetchedAt!)) throw new Error('P9_EDITION_ROWS_INVALID');
        }
      }
    } catch {
      return await fail('schema_invalid', false);
    }
    const completion = await boundary.complete({
      ...fence, lookupId, attemptId, sourceFetchedAt: provider.fetchedAt!,
      optionsExpiresAt: expiresAt, storagePermissionVerified: true, rows: provider.rows,
      catalogueCompanions: provider.catalogueCompanions,
    });
    return completionResult(completion) ?? await fail('provider_unavailable', true);
  } catch (error) {
    if (error instanceof Error && ['P9_METADATA_STALE_PHYSICAL_CALL','P9_EDITION_CONTEXT_INVALID'].includes(error.message)) return { outcome: 'stale_claim' };
    // A committed transaction may lose its response. Recover its slim receipt before scheduling retry.
    try {
      const recovered = completionResult(await boundary.recover(fence));
      if (recovered) return recovered;
      if (recoveryOnly) return await fail('provider_unavailable', false);
    } catch { /* Missing/unavailable recovery cannot manufacture a saved response. */ }
    // 02b sections 7.1/10: uncertainty/outage stays recovery-only, never a provider retry.
    // Claims still use the existing DB attempt budget; this port cannot defer it neutrally.
    if (error instanceof EditionOptionsCompletionUncertainError || recoveryOnly) return { outcome: 'manual_metadata_required' };
    if (error instanceof Error && ['P9_EDITION_ROWS_INVALID','P9_CATALOGUE_COMPANIONS_INVALID'].includes(error.message)) {
      return await fail('schema_invalid', false);
    }
    return await fail('provider_unavailable', true);
  }
}
