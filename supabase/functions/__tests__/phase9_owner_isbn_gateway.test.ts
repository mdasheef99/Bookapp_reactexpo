import { parseOwnerIngestionRequest } from '../_shared/imageInventory/contracts/ingestion';
import {
  editionReadRequest, editionChoices, editionUuid,
} from './fixtures/phase9/editionPickerContracts';
import {
  parseOwnerEditionPickerRequest, parseOwnerEditionPickerResponse,
} from '../_shared/imageInventory/contracts/ownerEditionPicker';
import { executeOwnerIngestion } from '../_shared/imageInventory/runtime/ownerIngestion';
import {
  executeOwnerEditionPicker, isOwnerEditionPickerAction,
} from '../_shared/imageInventory/runtime/ownerEditionPickerGateway';

// Slice 5 SDD §§5.5/7/12, AC5a-18/22: real contract and gateway paths.
const request = {
  ...editionReadRequest, action: 'set_candidate_isbn' as const,
  commandId: editionUuid(87), idempotencyKey: 'owner-isbn-gateway-0001',
  expectedCandidateVersion: 7, isbn13: '9780140449136',
};
const receipt = {
  sessionId: request.sessionId, candidateId: request.candidateId,
  candidateVersion: 8, metadataRevision: 3, requestGeneration: 2,
  ownerIsbn13: request.isbn13,
};
const args = {
  p_session_id: request.sessionId, p_candidate_id: request.candidateId,
  p_command_id: request.commandId, p_idempotency_key: request.idempotencyKey,
  p_expected_candidate_version: 7, p_isbn13: request.isbn13,
};

describe('typed ISBN Owner boundary (slice 5 §§7/12)', () => {
  it.each([request.isbn13, null])('decodes the strict set/clear request %s through ingestion', isbn13 => {
    const value = { ...request, isbn13 };
    expect(parseOwnerEditionPickerRequest(value)).toEqual(value);
    expect(parseOwnerIngestionRequest(value)).toEqual(value);
    expect(isOwnerEditionPickerAction(value.action)).toBe(true);
  });
  it.each([
    { isbn13: '0140449132' }, { isbn13: '978-0140449136' }, { isbn13: '' },
    { isbn13: undefined }, { expectedCandidateVersion: 0 },
    { storeId: editionUuid(88) }, { rawProviderPayload: {} },
  ])('rejects malformed or forged set data before RPC: %j', async patch => {
    const client = { rpc: jest.fn() };
    await expect(executeOwnerEditionPicker(client, { ...request, ...patch } as any))
      .rejects.toThrow('P9_REQUEST_INVALID');
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it.each([request.isbn13, null])('routes %s to the ISBN RPC with all six arguments', async isbn13 => {
    const data = { ...receipt, ownerIsbn13: isbn13 };
    const client = { rpc: jest.fn().mockResolvedValue({ data, error: null }) };
    await expect(executeOwnerEditionPicker(client, { ...request, isbn13 } as any)).resolves.toEqual(data);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith('phase9_set_candidate_isbn_v1', { ...args, p_isbn13: isbn13 });
  });
  it('dispatches HTTP through the authenticated client and returns the receipt', async () => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: receipt, error: null }) };
    const service = { rpc: jest.fn(() => { throw new Error('service authority used'); }) };
    const result = await executeOwnerIngestion(parseOwnerIngestionRequest(request),
      editionUuid(99), client as any, service as any);
    expect(client.rpc).toHaveBeenCalledWith('phase9_set_candidate_isbn_v1', args);
    expect(service.rpc).not.toHaveBeenCalled();
    expect(result).toEqual({ contractVersion: request.contractVersion, data: receipt });
  });
  it.each([
    { candidateId: editionUuid(99) }, { sessionId: editionUuid(99) },
    { candidateId: undefined }, { sessionId: undefined },
    { ownerIsbn13: '0140449132' }, { metadataRevision: 0 }, { requestGeneration: -1 },
    { privatePayload: 'secret' },
  ])('preserves post-checks and strict set response: %j', async patch => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: { ...receipt, ...patch }, error: null }) };
    await expect(executeOwnerEditionPicker(client, request as any)).rejects.toThrow('P9_INTERNAL_ERROR');
  });
  it.each(['P9_REQUEST_INVALID', 'P9_STATE_CONFLICT', 'P9_CANDIDATE_VERSION_CONFLICT',
    'P9_IDEMPOTENCY_MISMATCH', 'P9_OWNER_NOT_AUTHORIZED'])('maps bounded set error %s', async code => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: null, error: { message: `${code}: private SQL` } }) };
    await expect(executeOwnerEditionPicker(client, request as any)).rejects.toThrow(new Error(code));
  });
  it('bounds thrown transport errors on set', async () => {
    const client = { rpc: jest.fn().mockRejectedValue(new Error('private provider diagnostic')) };
    await expect(executeOwnerEditionPicker(client, request as any)).rejects.toThrow('P9_INTERNAL_ERROR');
  });
  it.each([undefined, null, request.isbn13])('decodes compatible choices with ownerIsbn13=%s', ownerIsbn13 => {
    const data = ownerIsbn13 === undefined ? editionChoices : { ...editionChoices, ownerIsbn13 };
    expect(parseOwnerEditionPickerResponse('read_candidate_edition_choices', data)).toEqual(data);
  });
  it('decodes ISBN in an empty v2 result as well as in select responses', () => {
    const empty = { ...editionChoices, rows: [], ownerIsbn13: request.isbn13 };
    expect(parseOwnerEditionPickerResponse('read_candidate_edition_choices', empty)).toEqual(empty);
    expect(parseOwnerEditionPickerResponse('select_candidate_edition', empty)).toEqual(empty);
  });
});
