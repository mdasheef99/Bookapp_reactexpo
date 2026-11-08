import type { MetadataProviderAdapter } from '../metadata/providerAdapter';
import { OpenLibraryEditionOptionsAdapter } from '../metadata/openLibrary';
import type { EditionHttpHooks } from '../metadata/openLibrary/transport';


import type { ProviderHttpPort, ProviderDescriptor, MetadataResultV2 } from '../metadata/providerDescriptor';

import type { MetadataGatewayConfiguration } from './metadataGatewayContext';
import type { EditionOptionsAdapter, MetadataEditionOptionsJobResult } from './metadataEditionOptions';
import { resolveOptionsDeadline } from '../metadata/googleBooks/editionOptions';
import { parseNormalizedMetadataEdition } from '../contracts/metadata';
import { fetchedAtMicros } from '../contracts/catalogueWrite';
import { projectStoredEditionRow } from '../contracts/ownerEditionPicker';

import type { EditionOptionsProviderResult } from '../metadata/contracts';
import type { MetadataJobContext } from './metadataJobContext';
import { decideMetadataProductionPolicy } from './metadataProductionComposition';
import type { MetadataProductionGateway } from './metadataProductionComposition';
import type { EditionOptionsFence, EditionOptionsCompletion } from './metadataEditionOptionsBoundary';
import { EditionOptionsCompletionUncertainError, editionOptionsFence } from './metadataEditionOptionsBoundary';

import { createProviderHttpPort } from '../metadata/providerHttp';
import { createBridgedPort, transportBindingOf } from './metadataExplicitTransport';
import { createExplicitLifecycle } from './metadataExplicitLifecycle';
import { denialFail, outerDenialFail } from './metadataExplicitDenials';
export type DescriptorExplicitExecution = Readonly<{
  descriptor: ProviderDescriptor;
  adapter?: EditionOptionsAdapter | null;
  fallbackAdapter?: EditionOptionsAdapter | null;
}>;

export async function executeDescriptorEditionOptions(
  context: MetadataJobContext, gateway: MetadataProductionGateway,
  execution: DescriptorExplicitExecution, signal: AbortSignal,
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
    if (!await lifecycle.beforeTransition(!retryable)) return { outcome: 'manual_metadata_required' };
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
  const lifecycle = createExplicitLifecycle(gateway, fence, completionResult);
  const recoveryOnly = context.currentPhysicalStatus === 'finalized' && context.currentPhysicalRetryable === false
    && context.currentPhysicalClaimAttempt !== context.attempt;
  const descriptor = execution.descriptor;
  try {
    if (signal.aborted) return await fail('cancelled', false);
    const recovered = completionResult(await boundary.recover(fence));
    if (recovered) return recovered;
    const reused = await boundary.reuseCache({ ...fence, cacheVersions: port.cacheVersions() });
    if (reused.status !== 'miss') {
      return completionResult(reused) ?? { outcome: 'manual_metadata_required' };
    }
    if (signal.aborted) return await fail('cancelled', false);
    const policy = decideMetadataProductionPolicy(request.providerPolicy);
    if (!policy.allowFreshProviderCall || !policy.allowPositiveRetention) return await fail('policy_denied', false);
    if (recoveryOnly) return await fail('provider_unavailable', false);
    if (context.currentPhysicalStatus === 'stale_rejected' && context.currentPhysicalClaimAttempt === context.attempt) return { outcome: 'stale_claim' };
    if (context.currentPhysicalStatus === 'finalized' && context.currentPhysicalClaimAttempt === context.attempt) {
      return await fail('provider_unavailable', true);
    }
    const admission = await lifecycle.admit({ adapterKey: descriptor.adapterKey,
      adapterVersion: descriptor.adapterVersion, maxGets: descriptor.protocol.maxGets });
    if (admission) return admission;
    const { lookupId } = await gateway.registerLookup(request);
    const { reservationId } = await gateway.reserveUsage({ ...request, lookupId });
    let { attemptId } = await gateway.registerAttempt({ ...request, lookupId, reservationId, providerRole: 'primary' });
    if (signal.aborted) return await fail('cancelled', false);
    const calls = gateway.editionProviderCalls;
    if (!calls) return await fail('provider_disabled', false);
    const hooks = calls.createPortHooks(lookupId, attemptId);
    const http = (gateway as { explicitHttp?: MetadataGatewayConfiguration['explicitHttp'] }).explicitHttp;
    let provider: EditionOptionsProviderResult;
    let perGetFinalized = true;
    let hostPolicy: Parameters<typeof parseNormalizedMetadataEdition>[1] =
      http?.rowHostPolicy ?? undefined;
    let expectedAdapterKey = descriptor.adapterKey;
    let fallbackAdapter: EditionOptionsAdapter | null = null;
    if (execution.adapter !== undefined && execution.adapter !== null) {
      const adapter = execution.adapter;
      const binding = transportBindingOf(adapter);
      if (binding !== null) {
        const claim = { jobId: request.jobId, worker: request.claimWorker,
          leaseToken: request.claimLeaseToken, claimAttempt: request.claimAttempt };
        const bridge = createBridgedPort({ adapterKey: descriptor.adapterKey,
          adapterVersion: descriptor.adapterVersion, binding,
          maxGets: descriptor.protocol.maxGets, policy: http?.policy ?? null,
          requestHosts: http?.requestHosts, lookupId, attemptId, claim, hooks,
          providerContact: http?.providerContact ?? null,
          sharedProtection: http?.sharedProtection ?? null });
        try {
          provider = await adapter.lookupEditionOptions({
            query: request.query, correlationId: lookupId, attemptId, signal, httpPort: bridge,
          });
        } catch (error) {
          if (error instanceof Error && ['P9_METADATA_STALE_PHYSICAL_CALL','P9_EDITION_CONTEXT_INVALID'].includes(error.message)) throw error;
          const mapped = denialFail(error);
          if (mapped !== null) return await fail(mapped.outcome as EditionOptionsProviderResult['outcome'], mapped.retryable);
          return await fail('provider_unavailable', true);
        }
      } else {
        perGetFinalized = false;
        hostPolicy = (adapter as { normalizedEditionHostPolicy?: Parameters<typeof parseNormalizedMetadataEdition>[1] }).normalizedEditionHostPolicy;
        expectedAdapterKey = (adapter as { normalizedEditionHostPolicy?: { adapterKey?: string } }).normalizedEditionHostPolicy?.adapterKey ?? descriptor.adapterKey;
        fallbackAdapter = execution.fallbackAdapter ?? null;
        if (!await gateway.validateEgress({ ...request, lookupId, attemptId })) {
          await lifecycle.releaseStale();
          return { outcome: 'stale_claim' };
        }
        try {
          provider = await adapter.lookupEditionOptions({
            query: request.query, correlationId: lookupId, attemptId, signal,
          });
        } catch (error) {
          if (error instanceof Error && ['P9_METADATA_STALE_PHYSICAL_CALL','P9_EDITION_CONTEXT_INVALID'].includes(error.message)) throw error;
          const mapped = denialFail(error);
          await gateway.finalizeAttempt({
            lookupId, attemptId,
            normalizedOutcome: ((mapped?.outcome ?? 'provider_unavailable') as Parameters<typeof gateway.finalizeAttempt>[0]['normalizedOutcome']),
            disposition: 'rejected',
            providerRequestId: null, normalizedCandidate: null, retryable: mapped === null, physicalStatus: 'outcome_unknown',
          });
          if (mapped !== null) return await fail(mapped.outcome as EditionOptionsProviderResult['outcome'], mapped.retryable);
          return await fail('provider_unavailable', true);
        }
        await gateway.finalizeAttempt({
          lookupId, attemptId, normalizedOutcome: provider.outcome, disposition: 'rejected',
          providerRequestId: provider.providerRequestId, normalizedCandidate: null,
          evidence: [], retryable: provider.retryable, physicalStatus: 'finalized',
        });
      }
    } else {
      if (http === undefined || http.policy === null || http.policy === undefined) {
        return await fail('provider_disabled', false);
      }
      const claim = { jobId: request.jobId, worker: request.claimWorker,
        leaseToken: request.claimLeaseToken, claimAttempt: request.claimAttempt };
      const fenced = createProviderHttpPort({
        adapterKey: descriptor.adapterKey, adapterVersion: descriptor.adapterVersion,
        policy: http.policy, maxGets: descriptor.protocol.maxGets,
        timeoutMs: http.timeoutMs, maxResponseBytes: http.maxResponseBytes,
        fetcher: http.fetcher, lookupId, attemptId, claim,
        retentionPolicyVersion: http.retentionPolicyVersion,
        providerContact: http.providerContact ?? null,
        beforeRequest: async (call) => hooks.beforeRequest(call),
        afterRequest: async (callId, settled) => hooks.afterRequest(callId,
          { outcome: settled.outcome, retryable: settled.retryable,
            physicalStatus: settled.status, egressStarted: settled.egressStarted }),
        requestHosts: http.requestHosts, requestValidator: http.requestValidator,
        sharedProtection: http.sharedProtection,
      });
      let result: MetadataResultV2;
      try {
        result = await descriptor.invoke({ query: request.query, correlationId: lookupId,
          attemptId, signal, purpose: 'edition_options', http: fenced });
      } catch (error) {
        if (error instanceof Error && ['P9_METADATA_STALE_PHYSICAL_CALL','P9_EDITION_CONTEXT_INVALID'].includes(error.message)) throw error;
        const mapped = denialFail(error);
        if (mapped !== null) return await fail(mapped.outcome as EditionOptionsProviderResult['outcome'], mapped.retryable);
        return await fail('provider_unavailable', true);
      }
      provider = {
        outcome: result.outcome.outcome as EditionOptionsProviderResult['outcome'],
        retryable: result.outcome.retryable,
        rows: result.rows === null ? [] : [...result.rows],
        fetchedAt: result.retention?.sourceFetchedAt ?? null,
        retentionEvidence: result.retention === null ? null : {
          storagePermissionVerified: true as const,
          permittedDeadlineAt: result.retention.permittedDeadlineAt,
        },
        providerRequestId: result.outcome.providerRequestId,
        catalogueCompanions: result.catalogueCompanions === null ? undefined : [...result.catalogueCompanions],
      };
    }
    if (signal.aborted) return await fail('cancelled', false);
    const allowedFallback = ['no_acceptable_match','ambiguous_match','material_conflict','schema_invalid',
      'malformed_response','timeout','rate_limited','provider_unavailable','circuit_breaker_open','network_failure','response_too_large','unsupported_content_type'];
    const gatewayBinding = (gateway as { explicitDescriptor?: {
      fallbackDescriptor?: ProviderDescriptor | null;
      fallbackExplicitHttp?: import('./metadataGatewayContext').ExplicitHttpConfig | undefined;
    } }).explicitDescriptor;
    const secondaryDescriptor = gatewayBinding?.fallbackDescriptor ?? null;
    const secondaryHttp = gatewayBinding?.fallbackExplicitHttp;
    const canFallback = fallbackAdapter !== null
      || (secondaryDescriptor !== null && secondaryHttp !== undefined);
    if (!perGetFinalized && canFallback && allowedFallback.includes(provider.outcome)) {
      const googleRetention = provider.fetchedAt && provider.retentionEvidence
        ? resolveOptionsDeadline(provider.fetchedAt,provider.retentionEvidence) : null;
      if ((provider.fetchedAt === null || googleRetention !== null)
        && !provider.rows.some(row => row.eligibility === 'eligible')) {
        if (!await lifecycle.beforeTransition()) return { outcome: 'manual_metadata_required' };
        const secondaryAdmission = await lifecycle.admit({
          adapterKey: secondaryDescriptor?.adapterKey ?? 'open_library',
          adapterVersion: secondaryDescriptor?.adapterVersion ?? '1.0.0',
          maxGets: secondaryDescriptor?.protocol.maxGets ?? 6,
        });
        if (secondaryAdmission) return secondaryAdmission;
        ({ attemptId } = await calls.registerFallback(request,lookupId,reservationId,attemptId,provider.outcome));
        try {
          if (fallbackAdapter !== null) {
            const binding = transportBindingOf(fallbackAdapter);
            const secondaryBinding = secondaryDescriptor === null ? undefined
              : { adapterKey: secondaryDescriptor.adapterKey,
                adapterVersion: secondaryDescriptor.adapterVersion };
            expectedAdapterKey = secondaryDescriptor?.adapterKey
              ?? (fallbackAdapter as { normalizedEditionHostPolicy?: { adapterKey?: string } })
                .normalizedEditionHostPolicy?.adapterKey ?? expectedAdapterKey;
            hostPolicy = secondaryHttp?.rowHostPolicy
              ?? (fallbackAdapter as { normalizedEditionHostPolicy?: Parameters<typeof parseNormalizedMetadataEdition>[1] })
                .normalizedEditionHostPolicy ?? hostPolicy;
            if (binding !== null) {
              const claim = { jobId: request.jobId, worker: request.claimWorker,
                leaseToken: request.claimLeaseToken, claimAttempt: request.claimAttempt };
              const secondaryProtection = secondaryHttp === undefined ? {
                policy: http?.policy ?? null,
                requestHosts: http?.requestHosts,
                providerContact: http?.providerContact ?? null,
                sharedProtection: http?.sharedProtection ?? null,
              } : {
                policy: secondaryHttp.policy,
                requestHosts: secondaryHttp.requestHosts,
                providerContact: secondaryHttp.providerContact ?? null,
                sharedProtection: secondaryHttp.sharedProtection ?? null,
              };
              const bridge = createBridgedPort({ adapterKey: secondaryDescriptor?.adapterKey ?? descriptor.adapterKey,
                adapterVersion: secondaryDescriptor?.adapterVersion ?? descriptor.adapterVersion,
                binding,
                maxGets: secondaryDescriptor?.protocol.maxGets ?? descriptor.protocol.maxGets,
                policy: secondaryProtection.policy,
                requestHosts: secondaryProtection.requestHosts,
                lookupId, attemptId, claim,
                hooks: calls.createPortHooks(lookupId, attemptId, secondaryBinding),
                providerContact: secondaryProtection.providerContact,
                sharedProtection: secondaryProtection.sharedProtection });
              provider = await fallbackAdapter.lookupEditionOptions({
                query: request.query, correlationId: lookupId, attemptId, signal, httpPort: bridge,
              });
            } else {
              provider = await fallbackAdapter.lookupEditionOptions({
                query: request.query, correlationId: lookupId, attemptId, signal,
              });
            }
          } else if (secondaryDescriptor !== null && secondaryHttp !== undefined
            && secondaryHttp.policy !== null && secondaryHttp.policy !== undefined) {
            const claim = { jobId: request.jobId, worker: request.claimWorker,
              leaseToken: request.claimLeaseToken, claimAttempt: request.claimAttempt };
            const hooks2 = calls.createPortHooks(lookupId, attemptId,
              { adapterKey: secondaryDescriptor.adapterKey,
                adapterVersion: secondaryDescriptor.adapterVersion });
            const port2 = createProviderHttpPort({
              adapterKey: secondaryDescriptor.adapterKey,
              adapterVersion: secondaryDescriptor.adapterVersion,
              policy: secondaryHttp.policy, maxGets: secondaryDescriptor.protocol.maxGets,
              timeoutMs: secondaryHttp.timeoutMs, maxResponseBytes: secondaryHttp.maxResponseBytes,
              fetcher: secondaryHttp.fetcher, lookupId, attemptId, claim,
              retentionPolicyVersion: secondaryHttp.retentionPolicyVersion,
              providerContact: secondaryHttp.providerContact ?? null,
              beforeRequest: async (call) => hooks2.beforeRequest(call),
              afterRequest: async (callId, settled) => hooks2.afterRequest(callId,
                { outcome: settled.outcome, retryable: settled.retryable,
                  physicalStatus: settled.status, egressStarted: settled.egressStarted }),
              requestHosts: secondaryHttp.requestHosts,
              requestValidator: secondaryHttp.requestValidator,
              sharedProtection: secondaryHttp.sharedProtection,
            });
            const secondaryResult = await secondaryDescriptor.invoke({ query: request.query,
              correlationId: lookupId, attemptId, signal, purpose: 'edition_options', http: port2 });
            provider = {
              outcome: secondaryResult.outcome.outcome as EditionOptionsProviderResult['outcome'],
              retryable: secondaryResult.outcome.retryable,
              rows: secondaryResult.rows === null ? [] : [...secondaryResult.rows],
              fetchedAt: secondaryResult.retention?.sourceFetchedAt ?? null,
              retentionEvidence: secondaryResult.retention === null ? null : {
                storagePermissionVerified: true as const,
                permittedDeadlineAt: secondaryResult.retention.permittedDeadlineAt,
              },
              providerRequestId: secondaryResult.outcome.providerRequestId,
              catalogueCompanions: secondaryResult.catalogueCompanions === null
                ? undefined : [...secondaryResult.catalogueCompanions],
            };
            expectedAdapterKey = secondaryDescriptor.adapterKey;
            hostPolicy = secondaryHttp.rowHostPolicy ?? undefined;
          }
        } catch (error) {
          if (error instanceof Error && ['P9_METADATA_STALE_PHYSICAL_CALL','P9_EDITION_CONTEXT_INVALID'].includes(error.message)) throw error;
          const mapped = denialFail(error);
          if (mapped !== null) return await fail(mapped.outcome as EditionOptionsProviderResult['outcome'], mapped.retryable);
          return await fail('provider_unavailable', true);
        }
      }
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
          const metadata = parseNormalizedMetadataEdition(row.metadata, hostPolicy);
          if (metadata.adapterKey !== expectedAdapterKey
            || metadata.correlationId !== lookupId || metadata.attemptId !== attemptId
            || fetchedAtMicros(metadata.fetchedAt) !== fetchedAtMicros(provider.fetchedAt!)) throw new Error('P9_EDITION_ROWS_INVALID');
        }
      }
    } catch {
      return await fail('schema_invalid', false);
    }
    if (!await lifecycle.beforeTransition()) return { outcome: 'manual_metadata_required' };
    const completion = await boundary.complete({
      ...fence, lookupId, attemptId, sourceFetchedAt: provider.fetchedAt!,
      optionsExpiresAt: expiresAt, storagePermissionVerified: true, rows: provider.rows,
      catalogueCompanions: provider.catalogueCompanions,
    });
    return completionResult(completion) ?? await fail('provider_unavailable', true);
  } catch (error) {
    if (error instanceof Error && ['P9_METADATA_STALE_PHYSICAL_CALL','P9_EDITION_CONTEXT_INVALID'].includes(error.message)) {
      await lifecycle.releaseStale();
      return { outcome: 'stale_claim' };
    }
    if (lifecycle.preserve) return { outcome: 'manual_metadata_required' };
    try {
      const recovered = completionResult(await boundary.recover(fence));
      if (recovered) return recovered;
      if (recoveryOnly) return await fail('provider_unavailable', false);
    } catch { /* Missing/unavailable recovery cannot manufacture a saved response. */ }
    if (error instanceof EditionOptionsCompletionUncertainError || recoveryOnly) return { outcome: 'manual_metadata_required' };
    if (error instanceof Error && ['P9_EDITION_ROWS_INVALID','P9_CATALOGUE_COMPANIONS_INVALID'].includes(error.message)) {
      return await fail('schema_invalid', false);
    }
    const mapped = outerDenialFail(error);
    if (mapped !== null) return await fail(mapped.outcome as EditionOptionsProviderResult['outcome'], mapped.retryable);
    return await fail('provider_unavailable', true);
  }
}
