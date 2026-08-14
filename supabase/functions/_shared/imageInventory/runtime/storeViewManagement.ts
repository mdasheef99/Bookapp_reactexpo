import {
  parseStoreViewManagementRpcResponse,
  StoreViewManagementRequest,
} from '../contracts/storeViewManagement.ts';

type RpcResult = { data: any; error: { message?: string } | null };
type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
};

export async function executeStoreViewManagement(
  request: StoreViewManagementRequest,
  client: RpcClient,
  unwrap: (result: RpcResult) => any,
): Promise<Record<string, unknown>> {
  if (request.action === 'update_store_inventory_details') {
    const data = unwrap(await client.rpc('phase9_update_store_inventory_details_v1', {
      p_inventory_id: request.inventoryId,
      p_expected_inventory_version: request.expectedInventoryVersion,
      p_changes: request.changes,
      p_idempotency_key: request.idempotencyKey,
      p_command_id: request.commandId,
    }));
    return parseStoreViewManagementRpcResponse(request.action, data) as Record<string, unknown>;
  }

  const data = unwrap(await client.rpc('phase9_adjust_inventory_stock_v2', {
    p_inventory_id: request.inventoryId,
    p_expected_inventory_version: request.expectedInventoryVersion,
    p_delta: request.delta,
    p_idempotency_key: request.idempotencyKey,
    p_command_id: request.commandId,
  }));
  return parseStoreViewManagementRpcResponse(request.action, data) as Record<string, unknown>;
}
