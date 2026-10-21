import { decodeOwnerUxRequest } from '../contracts/ownerUxRequestContracts';
import { decodeOwnerUxResponse } from '../contracts/ownerUxContracts';
const parseOwnerUxRequest = (value: any) => {
  const result = decodeOwnerUxRequest(value.action, value);
  if (!result) throw new Error('invalid request');
  return result;
};
const parseOwnerUxResponse = (action: any, value: unknown) => ({
  data: decodeOwnerUxResponse(action, value),
});
import {
  editionChoices, editionConfirmRequest, editionContractVersion, editionLookupReceipt,
  editionMetadata, editionRequests, editionReview, editionRow,
  editionSaveReviewRequest, editionSelectRequest, editionUuid,
  invalidEditionChoices, invalidEditionRequests,
} from '../../../../supabase/functions/__tests__/fixtures/phase9/editionPickerContracts';

describe('Owner edition-picker client wire contracts (SDD §§5-7/9)', () => {
  it.each(editionRequests)('accepts the strict $action request', (request) => {
    expect(parseOwnerUxRequest(request)).toEqual(request);
  });
  it.each(invalidEditionRequests)('rejects %s', (_name, value) => {
    expect(() => parseOwnerUxRequest(value)).toThrow();
  });
  it('decodes ordered own-cover rows and nullable review authority', () => {
    expect(parseOwnerUxResponse('read_candidate_edition_choices' as any, {
      contractVersion: editionContractVersion, data: editionChoices,
    }).data).toEqual(editionChoices);
  });
  it('preserves unavailable positions and distinct options with duplicate book links', () => {
    const data = { ...editionChoices, rows: [
      editionRow,
      { optionId: editionUuid(7), ordinal: 1, googleBooksUrl: null, eligibility: 'unavailable', metadata: null },
      { ...editionRow, optionId: editionUuid(8), ordinal: 2, eligibility: 'ineligible' },
    ] };
    expect(parseOwnerUxResponse('read_candidate_edition_choices' as any, {
      contractVersion: editionContractVersion, data,
    }).data).toEqual(data);
  });
  it.each(['edition_option', 'current_suggestion'])('keeps the saved %s snapshot after expiry', (source) => {
    const data = { ...editionChoices, rows: [], optionsExpiresAt: null, selection: {
      selectionId: editionUuid(5), source, optionId: source === 'edition_option' ? editionUuid(4) : null,
      snapshot: { ...editionMetadata, coverReference: null }, confirmedByOwner: true,
    } };
    expect(parseOwnerUxResponse('select_candidate_edition' as any, {
      contractVersion: editionContractVersion, data,
    }).data).toEqual(data);
  });
  it.each(invalidEditionChoices)('rejects invalid results: %s', (_name, data) => {
    expect(() => parseOwnerUxResponse('read_candidate_edition_choices' as any, {
      contractVersion: editionContractVersion, data,
    })).toThrow();
  });
  it('keeps lookup receipts small and rejects saved option arrays', () => {
    expect(parseOwnerUxResponse('request_candidate_edition_options' as any, {
      contractVersion: editionContractVersion, data: editionLookupReceipt,
    }).data).toEqual(editionLookupReceipt);
    expect(() => parseOwnerUxResponse('request_candidate_edition_options' as any, {
      contractVersion: editionContractVersion, data: { ...editionLookupReceipt, rows: [editionRow] },
    })).toThrow();
  });
  it.each([
    { mode: 'edition_option', selectionId: editionUuid(5) },
    { mode: 'selected', selectionId: editionUuid(5) },
    { mode: 'manual', selectionId: null },
  ])('preserves selling fields in review mode $mode', (metadataChoice) => {
    const request = { ...editionSaveReviewRequest, review: { ...editionReview, metadataChoice } };
    expect(parseOwnerUxRequest(request)).toEqual(request);
  });
  it.each([
    { mode: 'edition_option', selectionId: null },
    { mode: 'manual', selectionId: editionUuid(5) },
  ])('rejects inconsistent review choice %#', (metadataChoice) => {
    expect(() => parseOwnerUxRequest({
      ...editionSaveReviewRequest, review: { ...editionReview, metadataChoice },
    })).toThrow();
  });
  it('does not accept a mixed option/suggestion source or a changed expected version', () => {
    expect(() => parseOwnerUxRequest({ ...editionSelectRequest, ...editionConfirmRequest, optionsVersion: 1 })).toThrow();
  });
});

describe('optional authoritative rejection reasons (picker §3.1/§9)', () => {
  const readReason = (row: unknown) => parseOwnerUxResponse('read_candidate_edition_choices' as any, {
    contractVersion: editionContractVersion, data: { ...editionChoices, rows: [row] },
  }).data;
  it.each(['title_differs', 'author_differs', 'language_unknown', 'language_differs', 'volume_differs', 'identity_unverified'])('accepts bounded %s for a disabled safe record', reason => {
    expect(readReason({ ...editionRow, eligibility: 'ineligible', rejectionReason: reason })).toMatchObject({ rows: [{ rejectionReason: reason }] });
  });
  it('accepts unavailable metadata and a null reason on an eligible row', () => {
    expect(readReason({ ...editionRow, eligibility: 'unavailable', metadata: null, googleBooksUrl: null, rejectionReason: 'result_unavailable' })).toMatchObject({ rows: [{ rejectionReason: 'result_unavailable' }] });
    expect(readReason({ ...editionRow, rejectionReason: null })).toMatchObject({ rows: [{ rejectionReason: null }] });
  });
  it.each([
    { ...editionRow, rejectionReason: 'author_differs' },
    { ...editionRow, eligibility: 'ineligible', rejectionReason: 'raw provider response' },
    { ...editionRow, eligibility: 'ineligible', rejectionReason: 'result_unavailable' },
    { ...editionRow, eligibility: 'unavailable', metadata: null, googleBooksUrl: null, rejectionReason: 'title_differs' },
  ])('rejects arbitrary or contradictory reasons without changing selection authority', value => {
    expect(() => readReason(value)).toThrow();
  });
});
