import { assertSafeIngestionResponse, parseDedicatedWorkerRequest }
  from '../../supabase/functions/_shared/imageInventory/contracts/ingestion';
import { ProviderCapabilityDeclaration }
  from '../../supabase/functions/_shared/imageInventory/metadata/contracts';
import { MetadataProviderAdapter }
  from '../../supabase/functions/_shared/imageInventory/metadata/providerAdapter';
import { runMetadataProductionComposition }
  from '../../supabase/functions/_shared/imageInventory/runtime/metadataProductionComposition';
import {
  loadMetadataJobContext,
  MetadataJobContext,
  requestFromMetadataContext,
  SupabaseMetadataProductionGateway,
} from '../../supabase/functions/_shared/imageInventory/runtime/metadataProductionGateway';

export type MetadataWorkerDependencies = Readonly<{
  workerId: string;
  workerAuthToken: string;
  serviceClient: any;
  primary: MetadataProviderAdapter | null;
  primaryCapability: ProviderCapabilityDeclaration | null;
}>;

const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', pragma: 'no-cache' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}
async function validCredential(request: Request, expected: string): Promise<boolean> {
  const supplied = request.headers.get('authorization') ?? '';
  const expectedHeader = `Bearer ${expected}`;
  const [left, right] = await Promise.all([digest(supplied), digest(expectedHeader)]);
  let different = supplied.length ^ expectedHeader.length;
  for (let index = 0; index < left.length; index += 1) different |= left[index] ^ right[index];
  return different === 0;
}

export async function runMetadataWorkerBatch(
  batchSize: number,
  dependencies: MetadataWorkerDependencies,
) {
  const claimed = await dependencies.serviceClient.rpc('claim_phase9_metadata_jobs', {
    p_batch_size: batchSize,p_worker: dependencies.workerId,
  });
  if (claimed.error || !Array.isArray(claimed.data)) throw new Error('P9_METADATA_CLAIM_FAILED');
  const results = [];
  for (const claim of claimed.data.slice(0, batchSize)) {
    let context: MetadataJobContext | null = null;
    try {
      context = await loadMetadataJobContext(dependencies.serviceClient, {
        jobId: claim.id,worker: dependencies.workerId,
        leaseToken: claim.lease_token,attempt: claim.attempt_count,
      });
      if (dependencies.primary === null || dependencies.primaryCapability === null) {
        const failed = await dependencies.serviceClient.rpc('phase9_fail_metadata_job', {
          p_job_id: context.jobId,p_worker: dependencies.workerId,
          p_lease_token: context.claimToken,p_attempt_count: context.attempt,
          p_candidate_id: context.candidateId,p_candidate_version: context.candidateVersion,
          p_query_identity: context.queryIdentity,p_failure_kind: 'provider_disabled',
          p_retryable: false,
        });
        if (failed.error) throw new Error('P9_METADATA_COMPLETION_FAILED');
        results.push({ outcome: 'manual_metadata_required' });
        continue;
      }
      const capability = dependencies.primaryCapability;
      const provider = context.providerPolicies.find((item) =>
        item.adapterKey === capability.adapterKey
        && item.adapterVersion === capability.adapterVersion);
      const request = {
        ...requestFromMetadataContext(context),claimWorker: dependencies.workerId,
        providerPolicy: {
          enabled: provider?.enabled ?? false,adapterVersionCompatible: provider !== undefined,
          capabilityVersionCompatible: capability.enabled,
          matchingAllowed: provider?.matchingAllowed ?? false,
          storageAllowed: provider?.storageAllowed ?? false,
          reuseAllowed: provider?.reuseAllowed ?? false,pricingPolicyCompatible: true,
        },
      };
      const gateway = new SupabaseMetadataProductionGateway(dependencies.serviceClient, {
        worker: dependencies.workerId,context,primary: dependencies.primary,
        adapterKey: capability.adapterKey,adapterVersion: capability.adapterVersion,
        capabilityVersion: capability.capabilityVersion,
        schemaVersion: 'p9-metadata-foundation-v1',
        lookupContractVersion: 'p9-metadata-lookup-v1',
        normalizerVersion: 'p9-bibliographic-normalizer-v1',
        routingPolicyVersion: 'p9-metadata-routing-v1',
        selectionPolicyVersion: 'p9-metadata-selection-v1',
        snapshotVersion: 'p9-selected-metadata-v1',cachePolicyVersion: 'p9-metadata-cache-v1',
        cacheNamespace: 'metadata-v1',pricingPolicyVersion: 'metadata-zero-cost-v1',
        revalidationSeconds: 86400,
      });
      results.push(await runMetadataProductionComposition(request, gateway));
    } catch {
      try {
        const failed = await dependencies.serviceClient.rpc('phase9_fail_metadata_job', {
        p_job_id: context?.jobId ?? claim.id,p_worker: dependencies.workerId,
        p_lease_token: context?.claimToken ?? claim.lease_token,
        p_attempt_count: context?.attempt ?? claim.attempt_count,
        p_candidate_id: context?.candidateId ?? null,
        p_candidate_version: context?.candidateVersion ?? null,
        p_query_identity: context?.queryIdentity ?? null,
        p_failure_kind: 'provider_unavailable',p_retryable: true,
      });
        results.push({ outcome: failed.error ? 'stale_claim'
          : failed.data?.status === 'retry_scheduled' ? 'retry_scheduled'
            : 'manual_metadata_required' });
      } catch {
        results.push({ outcome: 'stale_claim' });
      }
    }
  }
  return { claimed: claimed.data.length, results };
}

export async function handlePhase9MetadataWorker(
  request: Request,
  dependencies: MetadataWorkerDependencies,
): Promise<Response> {
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  if (!await validCredential(request, dependencies.workerAuthToken)) {
    return response({ error: 'forbidden' }, 403);
  }
  try {
    const body = parseDedicatedWorkerRequest(await request.json());
    const result = await runMetadataWorkerBatch(body.batchSize, dependencies);
    assertSafeIngestionResponse(result);
    return response(result);
  } catch {
    return response({ error: 'P9_WORKER_REQUEST_INVALID' }, 400);
  }
}
