import {
  decodeOwnerBatchReviewResponse,
  OWNER_BATCH_REVIEW_CONTRACT_VERSION,
  OwnerBatchReviewAction,
  OwnerBatchReviewRequest,
} from '../contracts/ownerBatchReview.ts';

type RpcResult = { data: unknown; error: { message?: string } | null };
type Client = { rpc(name: string, args: Record<string, unknown>): Promise<RpcResult> };

const routes = {
  start_scan_session_v2: ['phase9_start_session_v2', (request: any) => ({
    p_language_hint: request.languageHint, p_condition: request.condition,
    p_location: request.location, p_price_minor: request.priceMinor,
    p_publication: request.publication, p_batch_label: request.batchLabel,
    p_idempotency_key: request.idempotencyKey, p_command_id: request.commandId,
  })],
  read_scan_session_v3: ['phase9_owner_session_summary_v3', (request: any) => ({
    p_session_id: request.sessionId,
  })],
  read_scan_batch_review: ['phase9_owner_batch_review_v1', (request: any) => ({
    p_session_id: request.sessionId,
  })],
  remove_candidate_from_scan: ['phase9_owner_remove_candidate_v1', (request: any) => ({
    p_session_id: request.sessionId, p_candidate_id: request.candidateId,
    p_expected_candidate_version: request.expectedCandidateVersion,
    p_idempotency_key: request.idempotencyKey, p_command_id: request.commandId,
  })],
  close_scan_session_v3: ['phase9_close_session_v3', (request: any) => ({
    p_session_id: request.sessionId,
    p_expected_session_version: request.expectedSessionVersion,
    p_idempotency_key: request.idempotencyKey, p_command_id: request.commandId,
  })],
} as const;

export async function executeOwnerBatchReview(
  request: OwnerBatchReviewRequest,
  client: Client,
  unwrap: (result: RpcResult) => unknown,
): Promise<Record<string, unknown>> {
  const action = request.action as OwnerBatchReviewAction;
  const route = routes[action];
  const data = unwrap(await client.rpc(route[0], route[1](request)));
  const decoded = decodeOwnerBatchReviewResponse(action, {
    contractVersion: OWNER_BATCH_REVIEW_CONTRACT_VERSION, data,
  });
  return { contractVersion: OWNER_BATCH_REVIEW_CONTRACT_VERSION, data: decoded };
}
