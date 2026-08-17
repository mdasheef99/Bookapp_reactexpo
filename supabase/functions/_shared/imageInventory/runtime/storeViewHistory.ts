import {
  parseStoreViewHistoryRpcResponse,
  StoreViewHistoryRequest,
} from '../contracts/storeViewHistory.ts';

type RpcResult = { data: any; error: { message?: string } | null };
type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
};

export async function executeStoreViewHistory(
  request: StoreViewHistoryRequest,
  client: RpcClient,
  unwrap: (result: RpcResult) => any,
): Promise<Record<string, unknown>> {
  const data = unwrap(await client.rpc('phase9_store_view_history_v1', {
    p_inventory_id: request.inventoryId,
  }));
  return parseStoreViewHistoryRpcResponse(data) as Record<string, unknown>;
}
