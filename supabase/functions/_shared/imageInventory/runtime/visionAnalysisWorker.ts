import {
  asRecord,
  assertSpineAnalysisIdentity,
  assertKnownKeys,
  createSpineAnalysisRequest,
  evaluateVisionResult,
  parseSpineAnalysisResult,
  Phase9ContractError,
  requiredString,
  spineAnalysisResultSnapshot,
  SpineImageAnalyzer,
} from '../contracts';
import { FixtureAnalyzerError } from '../analysis/fixtureSpineImageAnalyzer';
import { SpineAnalyzerError } from '../analysis/spineAnalyzerError';
import { WorkerIngestionRequest } from '../contracts/ingestion';
import {
  analyzeCurrentClaim,
  ProviderAttemptCompletion,
} from './claimAwareVisionAnalyzer';
import {
  buildSearchVariantPersistenceEnvelope,
} from './searchVariantPersistence';
import { analyzerResultSnapshot } from './visionResultSnapshot';

type RpcResult = { data: any; error: { message?: string } | null };
type Client = { rpc(name: string, args: Record<string, unknown>): Promise<RpcResult> };
type Claim = Readonly<{ id: string; attempt_count: number; lease_token: string }>;
type Clock = Readonly<{ now(): Date }>;
type WorkerResult = Readonly<{
  jobId?: string;
  outcome: string;
  candidateCount?: number;
}>;

const CONTEXT_KEYS = [
  'contract_version', 'schema_version', 'pipeline_version', 'prompt_version',
  'adapter_key', 'adapter_version', 'job_reference', 'correlation_id',
  'expected_language', 'sanitized_media_reference',
] as const;
const RECONCILIATION_KEYS = ['outcome', 'safe_error_code'] as const;
const COMPLETION_OUTCOMES = [
  'accepted', 'accepted_with_language_skips', 'no_books', 'language_mismatch',
  'over_visible_book_limit', 'quality_rejected',
] as const;

type SafeRpcCode =
  | 'P9_STATE_CONFLICT'
  | 'P9_OWNER_NOT_AUTHORIZED'
  | 'P9_MEDIA_NOT_APPROVED'
  | 'P9_VISION_SCHEMA_INVALID'
  | 'P9_VISION_PERSISTENCE_CONFLICT'
  | 'P9_VISION_DATABASE_RETRYABLE'
  | 'P9_VISION_INTERNAL_PERMANENT';

const RPC_ERRORS: Readonly<Record<SafeRpcCode, {
  outcome: string; retryable: boolean; status: number;
}>> = {
  P9_STATE_CONFLICT: { outcome: 'stale_attempt', retryable: false, status: 409 },
  P9_OWNER_NOT_AUTHORIZED: { outcome: 'security_rejected', retryable: false, status: 403 },
  P9_MEDIA_NOT_APPROVED: {
    outcome: 'relationship_reconciliation_required', retryable: false, status: 409,
  },
  P9_VISION_SCHEMA_INVALID: { outcome: 'schema_invalid', retryable: false, status: 422 },
  P9_VISION_PERSISTENCE_CONFLICT: {
    outcome: 'persistence_reconciliation_required', retryable: false, status: 409,
  },
  P9_VISION_DATABASE_RETRYABLE: {
    outcome: 'database_retryable', retryable: true, status: 503,
  },
  P9_VISION_INTERNAL_PERMANENT: {
    outcome: 'internal_permanent', retryable: false, status: 500,
  },
};

export class VisionRuntimeError extends Error {
  constructor(
    readonly code: SafeRpcCode,
    readonly outcome: string,
    readonly retryable: boolean,
    readonly httpStatus: number,
  ) {
    super(code);
    this.name = 'VisionRuntimeError';
  }
}

function rpcBoundaryError(message?: string): VisionRuntimeError {
  const exact = (message ?? '').trim() as SafeRpcCode;
  const code = Object.prototype.hasOwnProperty.call(RPC_ERRORS, exact)
    ? exact : 'P9_VISION_INTERNAL_PERMANENT';
  const classification = RPC_ERRORS[code];
  return new VisionRuntimeError(
    code,
    classification.outcome,
    classification.retryable,
    classification.status,
  );
}

async function rpcCall(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<RpcResult> {
  try {
    return await client.rpc(name, args);
  } catch {
    throw new VisionRuntimeError(
      'P9_VISION_DATABASE_RETRYABLE',
      RPC_ERRORS.P9_VISION_DATABASE_RETRYABLE.outcome,
      true,
      RPC_ERRORS.P9_VISION_DATABASE_RETRYABLE.status,
    );
  }
}

function unwrap(result: RpcResult): any {
  if (result.error) throw rpcBoundaryError(result.error.message);
  return result.data;
}

function leaseArgs(job: Claim, leaseOwner: string) {
  return {
    p_job_id: job.id,
    p_worker: leaseOwner,
    p_lease_token: job.lease_token,
    p_attempt_count: job.attempt_count,
  };
}

function parseContext(value: unknown, job: Claim, requestedAt: string) {
  const context = asRecord(value, 'vision_context');
  assertKnownKeys(context, CONTEXT_KEYS, 'vision_context');
  if (context.contract_version !== 'p9-contract-v1'
    || context.schema_version !== 'p9-vision-v2') {
    throw new Phase9ContractError('vision_context', 'unsupported contract version');
  }
  return createSpineAnalysisRequest({
    pipelineVersion: requiredString(context.pipeline_version, 'pipeline_version', 64, { activeContent: false }),
    promptVersion: requiredString(context.prompt_version, 'prompt_version', 64, { activeContent: false }),
    adapterKey: requiredString(context.adapter_key, 'adapter_key', 64, { activeContent: false }),
    adapterVersion: requiredString(context.adapter_version, 'adapter_version', 64, { activeContent: false }),
    jobReference: requiredString(context.job_reference, 'job_reference', 128, { activeContent: false }),
    attemptNumber: job.attempt_count,
    correlationId: requiredString(context.correlation_id, 'correlation_id', 128, { activeContent: false }),
    requestedAt,
    expectedLanguage: requiredString(context.expected_language, 'expected_language', 35, { activeContent: false }),
    sanitizedMediaReference: requiredString(
      context.sanitized_media_reference,
      'sanitized_media_reference',
      128,
      { activeContent: false },
    ),
  });
}

function reconciliationResult(value: unknown): WorkerResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (value as Record<string, unknown>).outcome
      !== 'relationship_reconciliation_required') return null;
  const result = asRecord(value, 'vision_reconciliation');
  assertKnownKeys(result, RECONCILIATION_KEYS, 'vision_reconciliation');
  if (result.outcome !== 'relationship_reconciliation_required'
    || result.safe_error_code !== 'P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED') {
    throw new Phase9ContractError('vision_reconciliation', 'unsupported result');
  }
  return { outcome: 'relationship_reconciliation_required' };
}

function completionResult(value: unknown, fallbackCandidateCount: number): WorkerResult {
  const completed = asRecord(value, 'vision_completion');
  if (!COMPLETION_OUTCOMES.includes(completed.outcome as typeof COMPLETION_OUTCOMES[number])) {
    throw new Phase9ContractError('vision_completion.outcome', 'unsupported result');
  }
  const candidateCount = completed.candidate_count ?? fallbackCandidateCount;
  if (!Number.isInteger(candidateCount)
    || (candidateCount as number) < 0
    || (candidateCount as number) > 15) {
    throw new Phase9ContractError('vision_completion.candidate_count', 'must be from 0 to 15');
  }
  return {
    outcome: completed.outcome as string,
    candidateCount: candidateCount as number,
  };
}

async function fail(
  client: Client,
  job: Claim,
  leaseOwner: string,
  code: string,
): Promise<WorkerResult> {
  try {
    const failed = await rpcCall(client, 'phase9_fail_vision_job', {
      ...leaseArgs(job, leaseOwner),
      p_safe_error_code: code,
    });
    if (failed.error) return { outcome: rpcBoundaryError(failed.error.message).outcome };
    if (failed.data === 'relationship_reconciliation_required') {
      return { outcome: 'relationship_reconciliation_required' };
    }
    if (!['resolved', 'retry_scheduled', 'dead_letter'].includes(failed.data)) {
      return { outcome: 'internal_permanent' };
    }
    return { jobId: job.id, outcome: failed.data };
  } catch (error) {
    if (error instanceof VisionRuntimeError) return { outcome: error.outcome };
    return { outcome: 'internal_permanent' };
  }
}

async function processClaim(
  client: Client,
  analyzer: SpineImageAnalyzer,
  job: Claim,
  leaseOwner: string,
  clock: Clock,
): Promise<WorkerResult> {
  let providerAttempt: ProviderAttemptCompletion | undefined;
  try {
    const context = unwrap(await rpcCall(
      client,
      'phase9_vision_job_context',
      leaseArgs(job, leaseOwner),
    ));
    const reconciliation = reconciliationResult(context);
    if (reconciliation) return reconciliation;
    const request = parseContext(context, job, clock.now().toISOString());
    const analyzed = await analyzeCurrentClaim(analyzer, request, job, leaseOwner);
    providerAttempt = analyzed.providerAttempt;
    const untrusted = analyzed.untrusted;
    const result = parseSpineAnalysisResult(analyzerResultSnapshot(untrusted));
    assertSpineAnalysisIdentity(request, result);
    const policy = evaluateVisionResult(result);
    const snapshot = spineAnalysisResultSnapshot(result);
    const acceptedVariants = analyzed.searchVariantProposals?.status === 'accepted'
      ? analyzed.searchVariantProposals.value
      : null;
    const completed = unwrap(await rpcCall(
      client,
      acceptedVariants
        ? 'phase9_persist_vision_analysis_with_variants'
        : 'phase9_persist_vision_analysis',
      {
        ...leaseArgs(job, leaseOwner),
        p_result: snapshot,
        ...(acceptedVariants
          ? { p_variants: buildSearchVariantPersistenceEnvelope(acceptedVariants) }
          : {}),
      },
    ));
    const completedReconciliation = reconciliationResult(completed);
    if (completedReconciliation) {
      await providerAttempt?.reject('stale_rejected', 'completion_rejected');
      return completedReconciliation;
    }
    await providerAttempt?.accept();
    return { jobId: job.id, ...completionResult(completed, policy.candidates.length) };
  } catch (error) {
    if (providerAttempt) {
      const stale = error instanceof VisionRuntimeError
        && error.code === 'P9_STATE_CONFLICT';
      try {
        await providerAttempt.reject(
          stale ? 'stale_rejected' : 'outcome_unknown',
          stale ? 'completion_stale' : 'completion_unresolved',
        );
      } catch {
        // Durable response_received evidence remains available for reconciliation.
      }
    }
    if (error instanceof FixtureAnalyzerError || error instanceof SpineAnalyzerError) {
      return fail(client, job, leaseOwner, error.code);
    }
    if (error instanceof Phase9ContractError) {
      return fail(client, job, leaseOwner, 'P9_VISION_SCHEMA_INVALID');
    }
    if (error instanceof VisionRuntimeError) {
      if (error.code === 'P9_VISION_SCHEMA_INVALID') {
        return fail(client, job, leaseOwner, error.code);
      }
      if (error.retryable) {
        return fail(client, job, leaseOwner, 'P9_VISION_DATABASE_RETRYABLE');
      }
      if (error.code === 'P9_VISION_INTERNAL_PERMANENT') {
        return fail(client, job, leaseOwner, error.code);
      }
      return { outcome: error.outcome };
    }
    return fail(client, job, leaseOwner, 'P9_VISION_INTERNAL_PERMANENT');
  }
}

export async function runVisionAnalysisWorker(
  request: WorkerIngestionRequest,
  client: Client,
  analyzer: SpineImageAnalyzer,
  clock: Clock = { now: () => new Date() },
) {
  const claimed = unwrap(await rpcCall(client, 'claim_phase9_vision_jobs', {
    p_batch_size: request.batchSize,
    p_worker: request.leaseOwner,
  })) as Claim[];
  const results: WorkerResult[] = [];
  for (const job of claimed) {
    results.push(await processClaim(client, analyzer, job, request.leaseOwner, clock));
  }
  return { claimed: claimed.length, results };
}
