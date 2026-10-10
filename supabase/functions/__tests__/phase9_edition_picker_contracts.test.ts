import { parseOwnerUxRequest, parseOwnerUxResponse } from '../_shared/imageInventory/contracts/ownerUx';
import { parseOwnerIngestionRequest } from '../_shared/imageInventory/contracts/ingestion';
import {
  editionChoices, editionConfirmRequest, editionContractVersion, editionLookupReceipt,
  editionMetadata, editionReadRequest, editionRequests, editionReview, editionRow,
  editionSaveReviewRequest, editionSelectRequest, editionUuid,
  invalidEditionChoices, invalidEditionRequests,
} from './fixtures/phase9/editionPickerContracts';

describe('Owner edition-picker server wire contracts (SDD §§5-7/9)', () => {
  it.each(editionRequests)('accepts the strict $action request', (request) => {
    expect(parseOwnerUxRequest(request)).toEqual(request);
  });
  it.each(invalidEditionRequests)('rejects %s', (_name, value) => {
    expect(() => parseOwnerUxRequest(value)).toThrow();
  });
  it.each(editionRequests)('admits the strict $action through the Task 2 gateway', (request) => {
    expect(parseOwnerIngestionRequest(request)).toEqual(request);
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

describe('Owner-safe edition projection', () => {
  it('projects private worker metadata without losing script, series, date or cover', () => {
    const project = () => {
      const { projectStoredEditionRow } = require('../_shared/imageInventory/contracts/ownerEditionPicker');
      return projectStoredEditionRow({ ...editionRow, metadata: {
        ...editionMetadata, script: 'Latn', series: 'Fixture Series',
        contractVersion: 'p9-contract-v1', schemaVersion: 'p9-metadata-v1',
        adapterKey: 'google_books', adapterVersion: 'v1', normalizerVersion: 'v1',
        correlationId: 'private-correlation', attemptId: 'private-attempt',
        providerRecordId: 'fixture', fetchedAt: '2026-10-07T00:00:00.000Z',
        confidence: 0.96, matchRationale: 'private rationale',
      } });
    };
    expect(project).not.toThrow();
    expect(project()).toEqual({
      ...editionRow, metadata: { ...editionMetadata, script: 'Latn', series: 'Fixture Series' },
    });
  });
});

describe('Task 5 controlled review admission', () => {
  it('admits the selection ID through the existing strict Save boundary', () => {
    expect(parseOwnerIngestionRequest(editionSaveReviewRequest)).toEqual(editionSaveReviewRequest);
  });
});
