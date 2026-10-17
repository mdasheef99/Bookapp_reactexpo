import {
  EDITION_REASONS_CLIENT_INFO, parseOwnerEditionPickerRequest, parseOwnerEditionPickerResponse,
} from '../contracts/ownerEditionPicker.ts';
import type {
  EditionChoices, EditionLookupReceipt, OwnerEditionPickerAction, OwnerEditionPickerRequest,
} from '../contracts/ownerEditionPicker.ts';

// Picker §3.1/§9: a standard-header capability changes display only, never caller authority.
export function editionPickerRpcHeaders(authorization: string, clientInfo: string | null) {
  return { Authorization: authorization,
    ...(clientInfo === EDITION_REASONS_CLIENT_INFO ? { 'X-Client-Info': EDITION_REASONS_CLIENT_INFO } : {}) };
}

// Narrow Supabase-compatible RPC port; no service client, tenant hints or Storage authority.
export type OwnerEditionPickerRpcClient = Readonly<{
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{
    data: unknown; error: unknown;
  }>;
}>;

export function isOwnerEditionPickerAction(action: unknown): action is OwnerEditionPickerAction {
  return action === 'read_candidate_edition_choices'
    || action === 'request_candidate_edition_options'
    || action === 'select_candidate_edition';
}

const safeErrors = new Set([
  'P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_REQUEST_INVALID', 'P9_NOT_FOUND',
  'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_CANDIDATE_VERSION_CONFLICT',
  'P9_IDEMPOTENCY_MISMATCH', 'P9_INTERNAL_ERROR',
]);
function rpcError(value: unknown): Error {
  const message = value && typeof value === 'object' && 'message' in value
    ? (value as { message: unknown }).message : null;
  const code = typeof message === 'string' ? message.match(/\bP9_[A-Z0-9_]+\b/u)?.[0] : null;
  return new Error(code && safeErrors.has(code) ? code : 'P9_INTERNAL_ERROR');
}

/** Picker SDD §§5–6/9: the authenticated RPC owns state and every authorization/version check. */
export async function executeOwnerEditionPicker(
  client: OwnerEditionPickerRpcClient, input: OwnerEditionPickerRequest,
): Promise<EditionChoices | EditionLookupReceipt> {
  let request: OwnerEditionPickerRequest;
  try { request = parseOwnerEditionPickerRequest(input); }
  catch { throw new Error('P9_REQUEST_INVALID'); }

  const args: Record<string, unknown> = {
    p_session_id: request.sessionId, p_candidate_id: request.candidateId,
  };
  let name: string;
  if (request.action === 'read_candidate_edition_choices') {
    name = 'phase9_owner_candidate_edition_choices_v1';
  } else {
    args.p_command_id = request.commandId;
    args.p_idempotency_key = request.idempotencyKey;
    if (request.action === 'request_candidate_edition_options') {
      name = 'phase9_request_candidate_edition_options_v1';
      args.p_expected_request_generation = request.expectedRequestGeneration;
    } else {
      name = 'phase9_select_candidate_edition_v1';
      Object.assign(args, {
        p_expected_candidate_version: request.expectedCandidateVersion,
        p_expected_metadata_revision: request.expectedMetadataRevision,
        p_expected_review_version: request.expectedReviewVersion, p_source: request.source,
        p_options_version: request.source === 'edition_option' ? request.optionsVersion : null,
        p_option_id: request.source === 'edition_option' ? request.optionId : null,
        p_selection_id: request.source === 'current_suggestion' ? request.selectionId : null,
      });
    }
  }

  let result: Awaited<ReturnType<OwnerEditionPickerRpcClient['rpc']>>;
  try { result = await client.rpc(name, args); }
  catch { throw new Error('P9_INTERNAL_ERROR'); }
  if (!result || result.error !== null) throw rpcError(result?.error);
  try {
    // Controlled RPCs project worker metadata to the strict public shape before returning.
    const data = parseOwnerEditionPickerResponse(request.action, result.data);
    if (request.action !== 'request_candidate_edition_options') {
      if (!('candidateId' in data) || data.candidateId !== request.candidateId
        || data.sessionId !== request.sessionId) throw new Error();
      if (request.action === 'select_candidate_edition'
        && (!data.selection || data.selection.source !== request.source
          || (request.source === 'edition_option' && data.selection.optionId !== request.optionId))) {
        throw new Error();
      }
    }
    return data;
  } catch { throw new Error('P9_INTERNAL_ERROR'); }
}
