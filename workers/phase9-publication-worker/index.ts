export type PublicationWorkerDependencies = Readonly<{
  workerId: string;
  workerAuthToken: string;
  serviceClient: { rpc(name: string, args: Record<string, unknown>): any };
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DETERMINISTIC_CODES = new Set([
  'P9_PUBLICATION_INELIGIBLE', 'P9_MEDIA_NOT_APPROVED', 'P9_OWNER_NOT_AUTHORIZED',
  'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_IDEMPOTENCY_MISMATCH',
]);

function safeFailure(error: unknown) {
  const text = error && typeof error === 'object'
    ? ['code', 'message', 'details', 'hint'].map((key) => (error as Record<string, unknown>)[key])
      .filter((value): value is string => typeof value === 'string').join(' ')
    : String(error ?? '');
  const code = text.match(/P9_[A-Z_]+/u)?.[0] ?? 'P9_PUBLICATION_FAILED';
  return {
    category: DETERMINISTIC_CODES.has(code) ? 'deterministic' : 'transient',
    code: DETERMINISTIC_CODES.has(code) ? code : 'P9_PUBLICATION_FAILED',
  } as const;
}

function validClaim(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const claim = value as Record<string, unknown>;
  const leaseExpiresAt = claim.lease_expires_at;
  return UUID.test(String(claim.job_id)) && UUID.test(String(claim.lease_token))
    && UUID.test(String(claim.inventory_id))
    && (typeof leaseExpiresAt === 'string' || leaseExpiresAt instanceof Date)
    && Number.isFinite(Date.parse(String(leaseExpiresAt)))
    && Number.isInteger(claim.publication_intent_version)
    && (claim.publication_intent_version as number) > 0
    && Number.isInteger(claim.attempt_number) && (claim.attempt_number as number) > 0;
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}
async function authorized(request: Request, expected: string) {
  const supplied = request.headers.get('authorization') ?? '';
  const [left, right] = await Promise.all([digest(supplied), digest(`Bearer ${expected}`)]);
  let different = supplied.length ^ (`Bearer ${expected}`).length;
  for (let index = 0; index < left.length; index += 1) different |= left[index] ^ right[index];
  return different === 0;
}

export async function runPublicationWorkerBatch(batchSize: number, dependencies: PublicationWorkerDependencies) {
  const claimed = await dependencies.serviceClient.rpc('claim_phase9_publication_jobs', {
    p_batch_size: batchSize, p_worker: dependencies.workerId,
  });
  if (claimed.error || !Array.isArray(claimed.data) || !claimed.data.every(validClaim)) {
    throw new Error('P9_PUBLICATION_CLAIM_FAILED');
  }
  const results = [];
  for (const claim of claimed.data.slice(0, batchSize)) {
    const commandId = crypto.randomUUID();
    const retried = await dependencies.serviceClient.rpc('phase9_retry_publication_worker_v1', {
      p_inventory_id: claim.inventory_id,
      p_expected_publication_intent_version: claim.publication_intent_version,
      p_job_id: claim.job_id, p_lease_token: claim.lease_token,
      p_attempt_number: claim.attempt_number, p_worker: dependencies.workerId,
      p_idempotency_key: `publication-worker:${claim.job_id}:${claim.attempt_number}`,
      p_command_id: commandId,
    });
    if (!retried.error && retried.data?.outcome !== 'committed_publication_failed') {
      results.push({ outcome: retried.data.outcome }); continue;
    }
    if (!retried.error) {
      const failed = await dependencies.serviceClient.rpc('phase9_fail_publication_job_v1', {
        p_job_id: claim.job_id, p_lease_token: claim.lease_token,
        p_worker: dependencies.workerId, p_attempt_number: claim.attempt_number,
        p_category: 'transient', p_safe_code: 'P9_PUBLICATION_FAILED',
      });
      results.push({ outcome: failed.error ? 'stale_claim' : failed.data });
      continue;
    }
    const classification = safeFailure(retried.error);
    const failed = await dependencies.serviceClient.rpc('phase9_fail_publication_job_v1', {
      p_job_id: claim.job_id, p_lease_token: claim.lease_token,
      p_worker: dependencies.workerId, p_attempt_number: claim.attempt_number,
      p_category: classification.category, p_safe_code: classification.code,
    });
    results.push({ outcome: failed.error ? 'stale_claim' : failed.data });
  }
  return { claimed: claimed.data.length, results };
}

export async function handlePhase9PublicationWorker(request: Request, dependencies: PublicationWorkerDependencies) {
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  if (request.method !== 'POST') return new Response('{"error":"method_not_allowed"}', { status: 405, headers });
  if (!await authorized(request, dependencies.workerAuthToken)) return new Response('{"error":"forbidden"}', { status: 403, headers });
  try {
    const body = await request.json();
    if (body?.contractVersion !== 'phase9-v1' || !Number.isInteger(body.batchSize)
      || body.batchSize < 1 || body.batchSize > 10 || Object.keys(body).length !== 2) throw new Error();
    return new Response(JSON.stringify(await runPublicationWorkerBatch(body.batchSize, dependencies)), { status: 200, headers });
  } catch { return new Response('{"error":"P9_WORKER_REQUEST_INVALID"}', { status: 400, headers }); }
}
