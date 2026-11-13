import { parseOwnerIngestionRequest } from '../ingestion';
import { ownerUxErrorFromException } from '../ownerUxErrors';
import { executeOwnerIngestion } from '../../runtime/ownerIngestion';
import { ownerUxFailureResponse } from '../ownerUxHttp';

const request = { action: 'read_store_view_summary', contractVersion: 'phase9-store-view-summary-v1' };
const data = { counts: { all: 6, private: 1, live: 1, paused: 1, needsAttention: 2, outOfStock: 1 }, availableStockValueMinor: '13835058042397261827' };
const client = (result: any) => ({ rpc: jest.fn().mockResolvedValue(result), storage: { from: jest.fn() } }) as any;

it('allowlists the strict summary request and dispatches only through the user client', async () => {
  expect(parseOwnerIngestionRequest(request)).toEqual(request);
  const user = client({ data, error: null });
  const service = client({ data: null, error: null });
  expect(await executeOwnerIngestion(parseOwnerIngestionRequest(request), 'owner', user, service)).toEqual({ contractVersion: request.contractVersion, data });
  expect(user.rpc).toHaveBeenCalledWith('phase9_store_view_summary_v1', {});
  expect(service.rpc).not.toHaveBeenCalled();
});
it.each(['storeId', 'filter', 'pageSize', 'unknown'])('rejects request field %s', (field) => {
  expect(() => parseOwnerIngestionRequest({ ...request, [field]: 'untrusted' })).toThrow(/unknown|invalid/i);
});
it.each([
  { ...data, unknown: true },
  { ...data, counts: { ...data.counts, unknown: 0 } },
  { ...data, counts: { ...data.counts, all: -1 } },
  { ...data, counts: { ...data.counts, all: 1.5 } },
  ...['00', '-1', '1.0', '1e3', '', 123].map(availableStockValueMinor => ({ ...data, availableStockValueMinor })),
])('rejects malformed or extended RPC data %j', async (invalid) => {
  const user = client({ data: invalid, error: null });
  const failure = await executeOwnerIngestion(request as any, 'owner', user, user).then(
    () => { throw new Error('expected the summary response to be rejected'); },
    (error: unknown) => error,
  );
  expect((failure as Error).message).toMatch(/^P9_INTERNAL_ERROR/);
  expect(ownerUxErrorFromException(failure).body.error).toBe('P9_INTERNAL_ERROR');
});
it.each(['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_INTERNAL_ERROR', 'private SQL details'])('uses the existing safe error envelope for %s', async (message) => {
  const user = client({ data: null, error: { message } });
  let failure: unknown;
  try { await executeOwnerIngestion(request as any, 'owner', user, user); } catch (error) { failure = error; }
  const response = ownerUxFailureResponse(failure);
  const body = await response.json();
  expect(body).toEqual({ error: message.startsWith('P9_') ? message : 'P9_INTERNAL_ERROR', retryable: !message.startsWith('P9_') || message === 'P9_INTERNAL_ERROR', message: expect.any(String) });
  expect(JSON.stringify(body)).not.toContain('private SQL details');
});
