import {
  assertSafeIngestionResponse,
  OwnerIngestionRequest,
} from '../contracts/ingestion.ts';
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
  if (result.error) throw new Error('P9_INTERNAL_ERROR');
  return result.data;
}

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
