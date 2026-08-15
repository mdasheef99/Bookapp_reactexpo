import {
  parseStoreViewMediaRpcResponse,
  StoreViewMediaRequest,
} from '../contracts/storeViewMedia.ts';

type RpcResult = { data: any; error: { message?: string } | null };
type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
};

export async function executeStoreViewMedia(
  request: StoreViewMediaRequest,
  client: RpcClient,
  unwrap: (result: RpcResult) => any,
): Promise<Record<string, unknown>> {
  if (request.action === 'read_store_view_media') {
    const data = unwrap(await client.rpc('phase9_store_view_media_v1', {
      p_inventory_id: request.inventoryId,
    }));
    return parseStoreViewMediaRpcResponse(request.action, data) as Record<string, unknown>;
  }

  if (request.action === 'reorder_store_view_media') {
    const data = unwrap(await client.rpc('phase9_reorder_store_view_media_v1', {
      p_inventory_id: request.inventoryId,
      p_expected_inventory_version: request.expectedInventoryVersion,
      p_ordered_link_ids: request.orderedLinkIds,
      p_idempotency_key: request.idempotencyKey,
      p_command_id: request.commandId,
    }));
    return parseStoreViewMediaRpcResponse(request.action, data) as Record<string, unknown>;
  }

  if (request.action === 'remove_store_view_media') {
    const data = unwrap(await client.rpc('phase9_remove_store_view_media_v1', {
      p_inventory_id: request.inventoryId,
      p_expected_inventory_version: request.expectedInventoryVersion,
      p_link_id: request.linkId,
      p_idempotency_key: request.idempotencyKey,
      p_command_id: request.commandId,
    }));
    return parseStoreViewMediaRpcResponse(request.action, data) as Record<string, unknown>;
  }

  const data = unwrap(await client.rpc('phase9_replace_store_view_media_v1', {
    p_inventory_id: request.inventoryId,
    p_expected_inventory_version: request.expectedInventoryVersion,
    p_capability_id: request.capabilityId,
    p_media_asset_id: request.mediaAssetId,
    p_target_link_id: request.targetLinkId,
    p_idempotency_key: request.idempotencyKey,
    p_command_id: request.commandId,
  }));
  return parseStoreViewMediaRpcResponse(request.action, data) as Record<string, unknown>;
}
