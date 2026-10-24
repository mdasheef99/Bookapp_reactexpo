import { supabase } from '@/lib/supabase';
import { OwnerUxClientError } from '../api/ownerUxService';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { OWNER_UX_CONTRACT_VERSION } from '../contracts/ownerUxContracts';
import { pickerChoices, selectedChoices } from '../testing/editionPickerClientFixtures';
import { testUuid } from '../testing/ownerUxTestFixtures';

jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
const invoke = supabase.functions.invoke as jest.Mock;
const read = { action: 'read_candidate_edition_choices' as const,
  contractVersion: OWNER_UX_CONTRACT_VERSION, sessionId: testUuid(1), candidateId: testUuid(2) };
const lookup = { ...read, action: 'request_candidate_edition_options' as const,
  expectedRequestGeneration: 1, commandId: testUuid(9), idempotencyKey: 'lookup:fixed-command-0001' };
const select = { ...read, action: 'select_candidate_edition' as const, expectedCandidateVersion: 4,
  expectedMetadataRevision: 7, expectedReviewVersion: null, source: 'edition_option' as const,
  optionsVersion: 1, optionId: testUuid(20), commandId: testUuid(10), idempotencyKey: 'select:fixed-command-0001' };
const response = (data: unknown) => ({ data: { contractVersion: OWNER_UX_CONTRACT_VERSION, data }, error: null });

beforeEach(() => jest.clearAllMocks());
it('reads strictly through the existing authenticated Owner Edge with abort', async () => {
  invoke.mockResolvedValue(response(pickerChoices()));
  const signal = new AbortController().signal;
  await expect(ownerEditionPickerService.readEditionChoices(read, signal)).resolves.toEqual(pickerChoices());
  expect(invoke).toHaveBeenCalledWith('phase9-owner-ingestion', { body: read, signal, headers: { 'X-Client-Info': 'bookconnect/edition-reasons-v2' } });
});
it('retains identical logical command identity across lookup retries and parses a slim receipt', async () => {
  const receipt = { operationId: testUuid(40), status: 'pending', requestGeneration: 1, optionsVersion: 1, available: false };
  invoke.mockResolvedValue(response(receipt));
  const signal = new AbortController().signal;
  await expect(ownerEditionPickerService.requestEditionOptions(lookup, signal)).resolves.toEqual(receipt);
  await ownerEditionPickerService.requestEditionOptions(lookup, signal);
  expect(invoke.mock.calls[0][1].body).toEqual(invoke.mock.calls[1][1].body);
});
it.each([
  select,
  { ...read, action: 'select_candidate_edition' as const, expectedCandidateVersion: 4,
    expectedMetadataRevision: 7, expectedReviewVersion: null, source: 'current_suggestion' as const,
    selectionId: testUuid(31), commandId: testUuid(10), idempotencyKey: 'select:fixed-command-0001' },
])('accepts the matching controlled selection source, including slim replay', async (request) => {
  const selection = request.source === 'edition_option' ? selectedChoices().selection
    : { selectionId: testUuid(30), source: 'current_suggestion', optionId: null, snapshot: selectedChoices().selection!.snapshot, confirmedByOwner: true };
  invoke.mockResolvedValue(response(selectedChoices({ selection: selection as never, rows: [], optionsExpiresAt: null })));
  await expect(ownerEditionPickerService.selectEdition(request, new AbortController().signal))
    .resolves.toMatchObject({ reviewVersion: null, rows: [] });
  expect(invoke.mock.calls[0][1].headers).toEqual({ 'X-Client-Info': 'bookconnect/edition-reasons-v2' });
});

it('sets an ISBN through the registered authenticated Owner action and checks response scope', async () => {
  const request = { ...read, action: 'set_candidate_isbn' as const, commandId: testUuid(10),
    idempotencyKey: 'isbn:fixed-command-0001', expectedCandidateVersion: 4, isbn13: '9780140449136' };
  const data = { sessionId: read.sessionId, candidateId: read.candidateId, candidateVersion: 5,
    metadataRevision: 8, requestGeneration: 2, ownerIsbn13: request.isbn13 };
  invoke.mockResolvedValue(response(data));
  const signal = new AbortController().signal;
  await expect(ownerEditionPickerService.setCandidateIsbn(request, signal)).resolves.toEqual(data);
  expect(invoke).toHaveBeenCalledWith('phase9-owner-ingestion', { body: request, signal });
  invoke.mockResolvedValue(response({ ...data, candidateId: testUuid(50) }));
  await expect(ownerEditionPickerService.setCandidateIsbn(request, signal)).rejects.toMatchObject({ code: 'P9_INTERNAL_ERROR' });
});
it.each([
  { ...read, storeId: testUuid(50) },
  { ...select, providerId: 'untrusted' },
  { ...select, expectedReviewVersion: 0 },
  { ...read, action: 'select_candidate_edition' },
])('rejects invalid or extra request authority before transport', async (request) => {
  await expect(ownerEditionPickerService.readEditionChoices(request as never, new AbortController().signal))
    .rejects.toMatchObject({ code: 'P9_REQUEST_INVALID' });
  expect(invoke).not.toHaveBeenCalled();
});
it.each([
  { ...pickerChoices(), candidateId: testUuid(3) },
  { ...pickerChoices(), sessionId: testUuid(3) },
  { ...pickerChoices(), rawPayload: 'private' },
  { ...pickerChoices(), rows: [{ ...pickerChoices().rows[0], googleBooksUrl: 'https://evil.test/books' }] },
])('fails closed on unsafe or wrong-scope responses', async (data) => {
  invoke.mockResolvedValue(response(data));
  await expect(ownerEditionPickerService.readEditionChoices(read, new AbortController().signal))
    .rejects.toMatchObject({ code: 'P9_INTERNAL_ERROR' });
});
it('rejects a successful response naming another option', async () => {
  invoke.mockResolvedValue(response(selectedChoices({ selection: { ...selectedChoices().selection!, optionId: testUuid(21) } as never })));
  await expect(ownerEditionPickerService.selectEdition(select, new AbortController().signal))
    .rejects.toMatchObject({ code: 'P9_INTERNAL_ERROR' });
});
it('uses the registered error message and never provider/debug text', async () => {
  invoke.mockResolvedValue({ data: null, error: { context: { json: async () => ({
    error: 'P9_STATE_CONFLICT', retryable: false, message: 'secret SQL provider debug',
  }) } } });
  const error = await ownerEditionPickerService.selectEdition(select, new AbortController().signal).catch(e => e);
  expect(error).toBeInstanceOf(OwnerUxClientError);
  expect(error).toMatchObject({ code: 'P9_STATE_CONFLICT', retryable: true });
  expect(error.message).not.toContain('secret');
});
it('rejects candidate metadata smuggled into a lookup receipt', async () => {
  invoke.mockResolvedValue(response({ operationId: testUuid(40), status: 'ready',
    requestGeneration: 1, optionsVersion: 1, available: true, rows: [] }));
  await expect(ownerEditionPickerService.requestEditionOptions(lookup, new AbortController().signal))
    .rejects.toMatchObject({ code: 'P9_INTERNAL_ERROR' });
});
it('a selection receipt cannot regress the requested review version, including null', async () => {
  invoke.mockResolvedValue(response(selectedChoices({ reviewVersion: null })));
  await expect(ownerEditionPickerService.selectEdition({ ...select, expectedReviewVersion: 2 }, new AbortController().signal))
    .rejects.toMatchObject({ code: 'P9_INTERNAL_ERROR' });
});

it('passes authoritative reasons through the existing read while older responses remain compatible', async () => {
  const value = pickerChoices();
  const data = { ...value, rows: value.rows.map(row => ({ ...row, eligibility: 'ineligible', rejectionReason: 'author_differs' })) };
  invoke.mockResolvedValue(response(data));
  await expect(ownerEditionPickerService.readEditionChoices(read, new AbortController().signal)).resolves.toEqual(data);
});
it('does not add the read capability to a lookup command or its idempotency body', async () => {
  const receipt = { operationId: testUuid(40), status: 'pending', requestGeneration: 1, optionsVersion: 1, available: false };
  invoke.mockResolvedValue(response(receipt));
  const signal = new AbortController().signal;
  await ownerEditionPickerService.requestEditionOptions(lookup, signal);
  expect(invoke).toHaveBeenCalledWith('phase9-owner-ingestion', { body: lookup, signal });
});
