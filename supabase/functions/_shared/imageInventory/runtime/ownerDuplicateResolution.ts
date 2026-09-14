import { OWNER_UX_CONTRACT_VERSION, parseOwnerUxResponse } from '../contracts/ownerUx.ts';
import type { OwnerIngestionRequest } from '../contracts/ingestion.ts';
import { sha256Hex, splitStoredObjectPath, storedImageEnvelope, type StoredImageObject } from '../media/sourceIdentity.ts';

type RpcResult = { data: any; error: { message?: string } | null };
type Client = { rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>; storage: { from(bucket: string): {
  list(prefix: string, options: Record<string, unknown>): Promise<{ data: StoredImageObject[] | null; error: unknown }>;
  download(path: string): Promise<{ data: Blob | null; error: unknown }>;
} } };

function unwrap(result: RpcResult): any {
  if (result.error) throw new Error(result.error.message?.match(/\bP9_[A-Z0-9_]+\b/u)?.[0] ?? 'P9_INTERNAL_ERROR');
  return result.data;
}

async function exactObject(client: Client, bucketId: string, path: string) {
  const { prefix, name } = splitStoredObjectPath(path);
  const bucket = client.storage.from(bucketId);
  const listed = await bucket.list(prefix, { search: name, limit: 2 });
  if (listed.error) throw new Error('P9_INTERNAL_ERROR');
  const exact = listed.data?.filter((entry) => entry.name === name) ?? [];
  if (exact.length !== 1) throw new Error('P9_MEDIA_NOT_APPROVED');
  return { bucket, envelope: await storedImageEnvelope(exact[0]), prefix, name };
}

export async function executeDuplicateInputResolution(
  request: Extract<OwnerIngestionRequest, { action: 'resolve_duplicate_scan_input' }>,
  actorId: string,
  serviceClient: Client,
): Promise<Record<string, unknown>> {
  const common = { p_actor: actorId, p_session_id: request.sessionId, p_input_id: request.inputId,
    p_decision: request.decision, p_expected_input_version: request.expectedInputVersion,
    p_expected_confirmation_version: request.expectedConfirmationVersion,
    p_idempotency_key: request.idempotencyKey, p_command_id: request.commandId };
  // Completed replay is deliberately checked before even constructing a Storage request.
  const context = unwrap(await serviceClient.rpc('phase9_duplicate_resolution_context', common));
  if (context.replay === true) return parseOwnerUxResponse(request.action, {
    contractVersion: OWNER_UX_CONTRACT_VERSION, data: context.response,
  }) as Record<string, unknown>;
  let proof: Record<string, unknown> = {};
  if (request.decision === 'proceed') {
    const before = await exactObject(serviceClient, context.bucket_id, context.object_path);
    if (before.envelope.size !== context.bytes || before.envelope.mime !== context.mime) throw new Error('P9_MEDIA_NOT_APPROVED');
    const downloaded = await before.bucket.download(context.object_path);
    if (downloaded.error || !downloaded.data) throw new Error('P9_MEDIA_NOT_APPROVED');
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    const sha256 = await sha256Hex(bytes);
    const after = await exactObject(serviceClient, context.bucket_id, context.object_path);
    if (after.envelope.objectIdentity !== before.envelope.objectIdentity
      || bytes.byteLength !== context.bytes || sha256 !== context.sha256) throw new Error('P9_MEDIA_NOT_APPROVED');
    proof = { p_observed_object_identity: before.envelope.objectIdentity,
      p_observed_sha256: sha256, p_observed_bytes: bytes.byteLength,
      p_observed_mime: before.envelope.mime };
  }
  const data = unwrap(await serviceClient.rpc('phase9_resolve_duplicate_scan_input', { ...common, ...proof }));
  return parseOwnerUxResponse(request.action, {
    contractVersion: OWNER_UX_CONTRACT_VERSION, data,
  }) as Record<string, unknown>;
}
