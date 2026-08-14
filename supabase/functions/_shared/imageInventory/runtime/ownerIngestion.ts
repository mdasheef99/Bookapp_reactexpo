import {
  assertSafeIngestionResponse,
  OwnerIngestionRequest,
} from '../contracts/ingestion.ts';
import {
  OWNER_UX_CONTRACT_VERSION,
  OwnerUxAction,
  parseOwnerUxResponse,
} from '../contracts/ownerUx.ts';
import {
  parsePublicationResponse, PUBLICATION_CONTRACT_VERSION,
  PublicationRequest,
} from '../contracts/publication.ts';
import {
  parseStoreViewRpcResponse,
  STORE_VIEW_CONTRACT_VERSION,
  StoreViewRequest,
} from '../contracts/storeView.ts';
import { sha256Hex, StoredImageObject, storedImageEnvelope } from '../media/sourceIdentity.ts';

type RpcResult = { data: any; error: { message?: string } | null };
type Client = {
  rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
  storage: { from(bucket: string): {
    createSignedUploadUrl(path: string): Promise<RpcResult>;
    list(prefix: string, options: Record<string, unknown>): Promise<{ data: StoredImageObject[] | null; error: { message?: string } | null }>;
    download(path: string): Promise<{ data: Blob | null; error: { message?: string } | null }>;
  } };
};

/** The sole response specialization allowed to carry upload transport secrets.
 * It is emitted only by the authenticated Owner issuance action with no-store headers. */
type SignedUploadTransportResponse = Readonly<{
  capabilityId: string;
  signedUploadUrl: string;
  uploadToken: string;
  expiresAt: string;
}>;

function unwrap(result: RpcResult): any {
  if (result.error) {
    const safeCode = result.error.message?.match(/\b(P9_(?:AUTH_REQUIRED|OWNER_NOT_AUTHORIZED|REQUEST_INVALID|CURSOR_INVALID|NOT_FOUND|STATE_CONFLICT|VERSION_CONFLICT|CANDIDATE_VERSION_CONFLICT|INPUT_HAS_CANDIDATES|SINGLE_IMAGE_LIMIT|IDEMPOTENCY_MISMATCH|MEDIA_NOT_APPROVED|PUBLICATION_INELIGIBLE|PUBLICATION_FAILED|INTERNAL_ERROR))\b/u)?.[1];
    throw new Error(safeCode ?? 'P9_INTERNAL_ERROR');
  }
  return result.data;
}

const ownerUxRpc = {
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

function splitPath(path: string): { prefix: string; name: string } {
  const index = path.lastIndexOf('/');
  if (index < 1 || index === path.length - 1) throw new Error('P9_MEDIA_NOT_APPROVED');
  return { prefix: path.slice(0, index), name: path.slice(index + 1) };
}

async function exactStoredObject(
  bucket: ReturnType<Client['storage']['from']>,
  prefix: string,
  name: string,
): Promise<StoredImageObject> {
  const listed = await bucket.list(prefix, { search: name, limit: 2 });
  if (listed.error) throw new Error('P9_INTERNAL_ERROR');
  const exact = listed.data?.filter((entry) => entry.name === name) ?? [];
  if (exact.length !== 1) throw new Error('P9_MEDIA_NOT_APPROVED');
  return exact[0];
}

export async function executeOwnerIngestion(
  request: OwnerIngestionRequest,
  actorId: string,
  userClient: Client,
  serviceClient: Client,
): Promise<Record<string, unknown>> {
  if (request.contractVersion === STORE_VIEW_CONTRACT_VERSION) {
    const storeView = request as StoreViewRequest;
    if (storeView.action === 'read_store_view_page') {
      const data = unwrap(await userClient.rpc('phase9_store_view_page_v2', {
        p_page_size: storeView.pageSize ?? 20,
        p_cursor: storeView.cursor ?? null,
        p_filter: storeView.filter ?? 'all',
      }));
      return parseStoreViewRpcResponse(storeView.action, data) as Record<string, unknown>;
    }
    const data = unwrap(await userClient.rpc('phase9_store_view_detail_v1', {
      p_inventory_id: storeView.inventoryId,
    }));
    return parseStoreViewRpcResponse(storeView.action, data) as Record<string, unknown>;
  }

  if (request.contractVersion === PUBLICATION_CONTRACT_VERSION) {
    const publication = request as PublicationRequest;
    let data: unknown;
    if (publication.action === 'set_publication_state') {
      data = unwrap(await userClient.rpc('phase9_set_publication_state_v2', {
        p_inventory_id: publication.inventoryId,
        p_expected_inventory_version: publication.expectedInventoryVersion,
        p_expected_publication_intent_version: publication.expectedPublicationIntentVersion,
        p_intent: publication.intent,
        p_idempotency_key: publication.idempotencyKey,
        p_command_id: publication.commandId,
      }));
    } else if (publication.action === 'retry_publication') {
      data = unwrap(await userClient.rpc('phase9_retry_publication_owner_v1', {
        p_inventory_id: publication.inventoryId,
        p_expected_publication_intent_version: publication.expectedPublicationIntentVersion,
        p_idempotency_key: publication.idempotencyKey,
        p_command_id: publication.commandId,
      }));
    } else if (publication.action === 'read_publication_status') {
      data = unwrap(await userClient.rpc('phase9_publication_status_v2', {
        p_inventory_id: publication.inventoryId,
      }));
    } else if (publication.action === 'authorize_public_copy') {
      const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
      const issued = unwrap(await userClient.rpc('phase9_authorize_public_copy_upload_v2', {
        p_inventory_id: publication.inventoryId, p_role: publication.role,
        p_ordinal: publication.ordinal, p_declared_mime: publication.declaredMime,
        p_declared_bytes: publication.declaredBytes,
        p_envelope_sha256: publication.envelopeSha256,
        p_expires_at: expiresAt, p_idempotency_key: publication.idempotencyKey,
        p_command_id: publication.commandId,
      }));
      const signed = unwrap(await serviceClient.storage.from(issued.bucket)
        .createSignedUploadUrl(issued.path));
      data = {
        capabilityId: issued.capabilityId, signedUploadUrl: signed.signedUrl,
        uploadToken: signed.token, expiresAt,
      };
    } else if (publication.action === 'complete_public_copy_upload') {
      const context = unwrap(await serviceClient.rpc('phase9_public_copy_upload_context_v1', {
        p_actor: actorId, p_capability_id: publication.capabilityId,
      }));
      const { prefix, name } = splitPath(context.object_path);
      const bucket = serviceClient.storage.from(context.bucket_id);
      const observed = await storedImageEnvelope(await exactStoredObject(bucket, prefix, name));
      if (observed.size !== context.declared_bytes || observed.mime !== context.declared_mime) {
        throw new Error('P9_MEDIA_NOT_APPROVED');
      }
      const downloaded = await bucket.download(context.object_path);
      if (downloaded.error || !downloaded.data) throw new Error('P9_MEDIA_NOT_APPROVED');
      const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      const sourceSha256 = await sha256Hex(bytes);
      const registered = unwrap(await serviceClient.rpc('phase9_register_public_copy_upload_v1', {
        p_actor: actorId, p_capability_id: publication.capabilityId,
        p_object_identity: observed.objectIdentity, p_source_sha256: sourceSha256,
        p_observed_mime: observed.mime, p_observed_bytes: observed.size,
        p_idempotency_key: publication.idempotencyKey, p_command_id: publication.commandId,
      }));
      data = { mediaAssetId: registered.media_asset_id, state: registered.state };
    } else if (publication.action === 'read_public_copy_status') {
      data = unwrap(await userClient.rpc('phase9_public_copy_status_v1', {
        p_source_media_asset_id: publication.mediaAssetId,
      }));
    } else {
      const submitted = publication as Extract<PublicationRequest, { action: 'submit_public_copy_media' }>;
      const mediaLinkId = unwrap(await userClient.rpc('phase9_submit_public_copy_media_v2', {
        p_inventory_id: submitted.inventoryId, p_capability_id: submitted.capabilityId,
        p_media_asset_id: submitted.mediaAssetId, p_role: submitted.role,
        p_public_order: submitted.publicOrder, p_idempotency_key: submitted.idempotencyKey,
        p_command_id: submitted.commandId,
      }));
      data = { mediaLinkId };
    }
    return parsePublicationResponse(publication.action, {
      contractVersion: PUBLICATION_CONTRACT_VERSION, data,
    }) as Record<string, unknown>;
  }

  if (request.contractVersion === OWNER_UX_CONTRACT_VERSION) {
    const action = request.action as OwnerUxAction;
    const route = ownerUxRpc[action];
    const data = unwrap(await userClient.rpc(route[0], route[1](request)));
    return parseOwnerUxResponse(action, {
      contractVersion: OWNER_UX_CONTRACT_VERSION,
      data,
    }) as Record<string, unknown>;
  }

  if (request.action === 'start_session') {
    const sessionId = unwrap(await userClient.rpc('phase9_start_session', {
      p_store_hint: request.storeHint ?? null,
      p_language: request.language,
      p_script: request.script,
      p_condition: request.condition,
      p_location: 'default',
      p_quantity: 1,
      p_publication: 'private',
      p_idempotency_key: request.idempotencyKey,
      p_command_id: request.commandId,
    }));
    const response = { sessionId };
    assertSafeIngestionResponse(response);
    return response;
  }

  if (request.action === 'authorize_scan_upload') {
    const issued = unwrap(await serviceClient.rpc('phase9_issue_scan_upload', {
      p_actor: actorId,
      p_session_id: request.sessionId,
      p_source_kind: request.sourceKind,
      p_declared_mime: request.declaredMime,
      p_declared_bytes: request.declaredBytes,
      p_ordinal: request.ordinal,
      p_idempotency_key: request.idempotencyKey,
      p_command_id: request.commandId,
    }));
    const signed = unwrap(await serviceClient.storage.from(issued.bucket_id).createSignedUploadUrl(issued.object_path));
    const transport: SignedUploadTransportResponse = {
      capabilityId: issued.capability_id,
      signedUploadUrl: signed.signedUrl,
      uploadToken: signed.token,
      expiresAt: issued.expires_at,
    };
    return transport;
  }

  const context = unwrap(await serviceClient.rpc('phase9_scan_upload_context', {
    p_actor: actorId,
    p_capability_id: request.capabilityId,
  }));
  const { prefix, name } = splitPath(context.object_path);
  const bucket = serviceClient.storage.from(context.bucket_id);
  const observed = await storedImageEnvelope(await exactStoredObject(bucket, prefix, name));
  if (observed.size !== context.declared_bytes || observed.mime !== context.declared_mime) {
    throw new Error('P9_MEDIA_NOT_APPROVED');
  }
  const downloaded = await bucket.download(context.object_path);
  if (downloaded.error) throw new Error('P9_INTERNAL_ERROR');
  if (!downloaded.data) throw new Error('P9_MEDIA_NOT_APPROVED');
  const sourceBytes = new Uint8Array(await downloaded.data.arrayBuffer());
  if (sourceBytes.byteLength !== observed.size) throw new Error('P9_MEDIA_NOT_APPROVED');
  const sourceSha256 = await sha256Hex(sourceBytes);
  const confirmed = await storedImageEnvelope(await exactStoredObject(bucket, prefix, name));
  if (confirmed.objectIdentity !== observed.objectIdentity) throw new Error('P9_MEDIA_NOT_APPROVED');
  const registered = unwrap(await serviceClient.rpc('phase9_register_scan_upload_completion', {
    p_actor: actorId,
    p_capability_id: request.capabilityId,
    p_source_kind: request.sourceKind,
    p_bucket: context.bucket_id,
    p_path: context.object_path,
    p_object_identity: observed.objectIdentity,
    p_source_sha256: sourceSha256,
    p_observed_mime: observed.mime,
    p_observed_bytes: observed.size,
    p_orchestration_version: request.contractVersion,
    p_idempotency_key: request.idempotencyKey,
    p_command_id: request.commandId,
  }));
  const response = { inputId: registered.input_id, jobId: registered.job_id, state: registered.state };
  assertSafeIngestionResponse(response);
  return response;
}
