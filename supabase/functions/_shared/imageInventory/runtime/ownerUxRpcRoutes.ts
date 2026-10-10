// Existing Owner UX routes, extracted intact to keep orchestration under 350 lines.
export const ownerUxRpc = {
  discover_scan_session: ['phase9_owner_discover_session_v1', () => ({})],
  read_scan_session: ['phase9_owner_session_summary_v2', (request: any) => ({
    p_session_id: request.sessionId,
  })],
  list_scan_inputs: ['phase9_owner_session_inputs_v1', (request: any) => ({
    p_session_id: request.sessionId, p_page_size: request.pageSize ?? 20,
    p_cursor: request.cursor ?? null,
  })],
  remove_scan_input: ['phase9_remove_scan_input_v1', (request: any) => ({
    p_session_id: request.sessionId, p_input_id: request.inputId,
    p_expected_input_version: request.expectedInputVersion,
    p_idempotency_key: request.idempotencyKey, p_command_id: request.commandId,
  })],
  list_scan_candidates: ['phase9_owner_candidates_page_v2', (request: any) => ({
    p_scope: request.scope, p_session_id: request.sessionId ?? null,
    p_attention: request.attention ?? 'all', p_page_size: request.pageSize ?? 20,
    p_cursor: request.cursor ?? null,
  })],
  read_scan_candidate: ['phase9_owner_candidate_detail_v2', (request: any) => ({
    p_session_id: request.sessionId, p_candidate_id: request.candidateId,
  })],
  update_candidate_review: ['phase9_update_candidate_review_v2', (request: any) => ({
    p_session_id: request.sessionId, p_candidate_id: request.candidateId,
    p_expected_candidate_version: request.expectedCandidateVersion,
    p_expected_metadata_revision: request.expectedMetadataRevision,
    p_review: request.review, p_idempotency_key: request.idempotencyKey,
    p_command_id: request.commandId,
  })],
  add_candidate_to_inventory: ['phase9_add_candidate_to_inventory_v1', (request: any) => ({
    p_session_id: request.sessionId, p_candidate_id: request.candidateId,
    p_expected_candidate_version: request.expectedCandidateVersion,
    p_expected_review_version: request.expectedReviewVersion,
    p_expected_metadata_revision: request.expectedMetadataRevision,
    p_idempotency_key: request.idempotencyKey, p_command_id: request.commandId,
  })],
  read_scan_readiness: ['phase9_owner_session_readiness_v1', (request: any) => ({
    p_session_id: request.sessionId,
  })],
  close_scan_session: ['phase9_close_session_v2', (request: any) => ({
    p_session_id: request.sessionId,
    p_expected_session_version: request.expectedSessionVersion,
    p_idempotency_key: request.idempotencyKey, p_command_id: request.commandId,
  })],
} as const;
