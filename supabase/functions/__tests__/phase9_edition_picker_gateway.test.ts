import { parseOwnerIngestionRequest } from '../_shared/imageInventory/contracts/ingestion';
import { executeOwnerIngestion } from '../_shared/imageInventory/runtime/ownerIngestion';
import {
  editionChoices, editionConfirmRequest, editionLookupReceipt, editionLookupRequest,
  editionReadRequest, editionSelectRequest, editionSaveReviewRequest, editionUuid,
} from './fixtures/phase9/editionPickerContracts';
import type { OwnerEditionPickerRequest } from '../_shared/imageInventory/contracts/ownerEditionPicker';

const execute = async (client: any, request: OwnerEditionPickerRequest) =>
  require('../_shared/imageInventory/runtime/ownerEditionPickerGateway')
    .executeOwnerEditionPicker(client, request);
const chosen = (source: 'edition_option' | 'current_suggestion') => ({
  ...editionChoices, selection: {
    selectionId: editionUuid(10), source,
    optionId: source === 'edition_option' ? editionSelectRequest.optionId : null,
    snapshot: editionChoices.rows[0].metadata, confirmedByOwner: true,
  },
});
const common = {
  p_session_id: editionReadRequest.sessionId, p_candidate_id: editionReadRequest.candidateId,
};
const command = {
  ...common, p_command_id: editionLookupRequest.commandId,
  p_idempotency_key: editionLookupRequest.idempotencyKey,
};
const authority = {
  ...command, p_expected_candidate_version: editionSelectRequest.expectedCandidateVersion,
  p_expected_metadata_revision: editionSelectRequest.expectedMetadataRevision,
  p_expected_review_version: null,
};
const cases = [
  [editionReadRequest, 'phase9_owner_candidate_edition_choices_v1', common, editionChoices],
  [editionLookupRequest, 'phase9_request_candidate_edition_options_v1',
    { ...command, p_expected_request_generation: 0 }, editionLookupReceipt],
  [editionSelectRequest, 'phase9_select_candidate_edition_v1', {
    ...authority, p_source: 'edition_option', p_options_version: 1,
    p_option_id: editionSelectRequest.optionId, p_selection_id: null,
  }, chosen('edition_option')],
  [editionConfirmRequest, 'phase9_select_candidate_edition_v1', {
    ...authority, p_source: 'current_suggestion', p_options_version: null,
    p_option_id: null, p_selection_id: editionConfirmRequest.selectionId,
  }, chosen('current_suggestion')],
] as const;

describe('Owner edition gateway (picker SDD §§5–6/9)', () => {
  it.each(cases)('dispatches $0.action through one authenticated RPC', async (request, name, args, data) => {
    const client = { rpc: jest.fn().mockResolvedValue({ data, error: null }) };
    // Capture failures so a missing gateway produces an assertion-level RED.
    const response = await execute(client, request).catch(() => null);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith(name, args);
    expect(response).toEqual(data);
  });
  it('propagates a saved review version, not a default or a second version counter', async () => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: chosen('edition_option'), error: null }) };
    await execute(client, { ...editionSelectRequest, expectedReviewVersion: 12 });
    expect(client.rpc.mock.calls[0][1].p_expected_review_version).toBe(12);
  });
  it.each([
    { ...editionReadRequest, storeId: editionUuid(99) },
    { ...editionLookupRequest, rawProviderPayload: {} },
    { ...editionSelectRequest, metadata: editionChoices.rows[0].metadata },
    { ...editionConfirmRequest, optionId: editionUuid(99) },
    { ...editionSelectRequest, expectedReviewVersion: undefined },
    { ...editionSelectRequest, action: 'toString' },
  ])('rejects forged or malformed requests before RPC', async (request) => {
    const client = { rpc: jest.fn() };
    await expect(execute(client, request as any)).rejects.toThrow('P9_REQUEST_INVALID');
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it.each([
    'P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_NOT_FOUND',
    'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_CANDIDATE_VERSION_CONFLICT',
    'P9_IDEMPOTENCY_MISMATCH', 'P9_REQUEST_INVALID',
  ])('returns the bounded %s conflict without database diagnostics', async (code) => {
    const client = { rpc: jest.fn().mockResolvedValue({
      data: null, error: { message: code + ': private SQL statement and provider diagnostics' },
    }) };
    await expect(execute(client, editionSelectRequest)).rejects.toThrow(new Error(code));
  });
  it.each([
    { message: 'private SQL and credential token' },
    { message: 'P9_UNKNOWN_DIAGNOSTIC secret' },
    { message: 'P9_VERSION_CONFLICT_TRAILING_SECRET' },
    null, 'arbitrary database error',
  ])('fails closed on unknown/missing error data', async (error) => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: null, error }) };
    await expect(execute(client, editionReadRequest)).rejects.toThrow('P9_INTERNAL_ERROR');
  });
  it('bounds thrown transport errors', async () => {
    const client = { rpc: jest.fn().mockRejectedValue(new Error('private transport credential')) };
    await expect(execute(client, editionLookupRequest)).rejects.toThrow('P9_INTERNAL_ERROR');
  });
  it.each([
    { ...editionChoices, candidateId: editionUuid(99) },
    { ...editionChoices, sessionId: editionUuid(99) },
    { ...editionChoices, storeId: editionUuid(99) },
    { ...editionChoices, rows: [{ ...editionChoices.rows[0], metadata: {
      ...editionChoices.rows[0].metadata, confidence: 0.99,
    } }] },
    { ...editionChoices, rows: [{ ...editionChoices.rows[0],
      googleBooksUrl: 'https://evil.example/book',
    }] },
  ])('rejects mismatched identity or unsafe public responses', async (data) => {
    const client = { rpc: jest.fn().mockResolvedValue({ data, error: null }) };
    await expect(execute(client, editionReadRequest)).rejects.toThrow('P9_INTERNAL_ERROR');
  });
  it('cannot return alternative arrays inside lookup receipts', async () => {
    const client = { rpc: jest.fn().mockResolvedValue({
      data: { ...editionLookupReceipt, rows: editionChoices.rows }, error: null,
    }) };
    await expect(execute(client, editionLookupRequest)).rejects.toThrow('P9_INTERNAL_ERROR');
  });
  it('requires an authoritative saved selection in select responses', async () => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: editionChoices, error: null }) };
    await expect(execute(client, editionSelectRequest)).rejects.toThrow('P9_INTERNAL_ERROR');
  });
  it('does not claim that a forged different option was selected', async () => {
    const data = chosen('edition_option');
    data.selection.optionId = editionUuid(99);
    const client = { rpc: jest.fn().mockResolvedValue({ data, error: null }) };
    await expect(execute(client, editionSelectRequest)).rejects.toThrow('P9_INTERNAL_ERROR');
  });
});

describe('Strict Owner HTTP routing', () => {
  it.each(cases)('admits and routes $0.action without service authority', async (request, name, args, data) => {
    const client = { rpc: jest.fn().mockResolvedValue({ data, error: null }), storage: {
      from: jest.fn(() => { throw new Error('unexpected storage call'); }),
    } };
    const service = { ...client, rpc: jest.fn(() => { throw new Error('unexpected service RPC'); }) };
    let response: unknown = null;
    try {
      response = await executeOwnerIngestion(parseOwnerIngestionRequest(request), editionUuid(98), client, service);
    } catch { /* Assert routing and output below instead of masking RED with a missing module. */ }
    expect(client.rpc).toHaveBeenCalledWith(name, args);
    expect(service.rpc).not.toHaveBeenCalled();
    expect(response).toEqual({ contractVersion: request.contractVersion, data });
  });
  it('admits controlled edition_option review while preserving its strict payload', () => {
    expect(parseOwnerIngestionRequest(editionSaveReviewRequest)).toEqual(editionSaveReviewRequest);
  });
});

describe('Task 5 review/Add HTTP compatibility (picker §§6-7, Unit 7A §§3-5)', () => {
  it('routes the checked selection ID and unchanged selling review through the Owner RPC', async () => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: null, error: { message: 'P9_STATE_CONFLICT' } }) };
    await expect(executeOwnerIngestion(parseOwnerIngestionRequest(editionSaveReviewRequest),
      editionUuid(98), client as any, {} as any)).rejects.toThrow('P9_STATE_CONFLICT');
    expect(client.rpc).toHaveBeenCalledWith('phase9_update_candidate_review_v2', {
      p_session_id: editionSaveReviewRequest.sessionId, p_candidate_id: editionSaveReviewRequest.candidateId,
      p_expected_candidate_version: editionSaveReviewRequest.expectedCandidateVersion,
      p_expected_metadata_revision: editionSaveReviewRequest.expectedMetadataRevision,
      p_review: editionSaveReviewRequest.review, p_idempotency_key: editionSaveReviewRequest.idempotencyKey,
      p_command_id: editionSaveReviewRequest.commandId,
    });
  });
  it('uses the unchanged Add signature and canonical result without a client metadata blob', async () => {
    const { review: _review, ...common } = editionSaveReviewRequest;
    const request = { ...common, action: 'add_candidate_to_inventory' as const, expectedReviewVersion: 7 };
    const data = { sessionId: request.sessionId, candidateId: request.candidateId,
      candidateVersion: request.expectedCandidateVersion + 1, inventoryId: editionUuid(90),
      inventoryVersion: 1, outcome: 'committed_private' };
    const client = { rpc: jest.fn().mockResolvedValue({ data, error: null }) };
    const result = await executeOwnerIngestion(parseOwnerIngestionRequest(request), editionUuid(98), client as any, {} as any);
    expect(client.rpc).toHaveBeenCalledWith('phase9_add_candidate_to_inventory_v1', {
      p_session_id: request.sessionId, p_candidate_id: request.candidateId,
      p_expected_candidate_version: request.expectedCandidateVersion,
      p_expected_review_version: 7, p_expected_metadata_revision: request.expectedMetadataRevision,
      p_idempotency_key: request.idempotencyKey, p_command_id: request.commandId,
    });
    expect(result).toEqual({ contractVersion: request.contractVersion, data });
    expect(() => parseOwnerIngestionRequest({ ...request, metadataChoice: editionSaveReviewRequest.review.metadataChoice })).toThrow();
  });
});