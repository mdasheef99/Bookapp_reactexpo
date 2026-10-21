import { parseOwnerEditionPickerResponse as parseClient, parseOwnerEditionPickerRequest as requestClient } from '../contracts/ownerEditionPicker';
import { parseOwnerEditionPickerResponse as parseServer, parseOwnerEditionPickerRequest as requestServer } from '../../../../supabase/functions/_shared/imageInventory/contracts/ownerEditionPicker';
import { editionChoices, editionConfirmRequest, editionMetadata, editionUuid } from '../../../../supabase/functions/__tests__/fixtures/phase9/editionPickerContracts';
import { applyCompactEditionSelection, editionSelectionAuthority } from '../review/editionSelectionDraft';
import { buildCompactReview, compactReviewDisplay } from '../review/compactReviewDraft';
import { pickerCard, pickerDefaults, pickerReview, selectedChoices } from '../testing/editionPickerClientFixtures';

// Picker §§6-7 / EP-AC11/19: only server-owned confirmation can close fresh resume.
function suggestion(confirmedByOwner: boolean, script: string | null = 'Latn') {
  const choices = selectedChoices();
  return { ...choices, rows: [], optionsExpiresAt: null, reviewVersion: null,
    selection: { ...choices.selection!, source: 'current_suggestion' as const, optionId: null,
      confirmedByOwner, snapshot: { ...choices.selection!.snapshot, script } } };
}
const wire = (confirmedByOwner: unknown) => ({ ...editionChoices, selection: {
  selectionId: editionUuid(5), source: 'current_suggestion', optionId: null,
  ...(confirmedByOwner === undefined ? {} : { confirmedByOwner }), snapshot: editionMetadata,
} });

describe.each([['client', parseClient, requestClient], ['server', parseServer, requestServer]] as const)(
  '%s confirmation contract', (_name, parse, request) => {
    it.each([false, true])('preserves explicit server confirmation %s', confirmed => {
      const response = wire(confirmed);
      expect(parse('read_candidate_edition_choices', response)).toEqual(response);
    });
    it.each([undefined, null, 1, 'true'])('rejects absent or nonboolean confirmation %s', confirmed => {
      expect(() => parse('read_candidate_edition_choices', wire(confirmed))).toThrow();
    });
    it('rejects client-authored confirmation on the selection command', () => {
      expect(() => request({ ...editionConfirmRequest, confirmedByOwner: true })).toThrow();
    });
  },
);

it('distinguishes confirmed and automatic suggestions before any selling review', () => {
  expect(editionSelectionAuthority(suggestion(true), null)).toBe('controlled');
  expect(editionSelectionAuthority(suggestion(false), null)).toBe('confirmation_required');
});
it('never lets a saved review manufacture confirmation when the server says false', () => {
  expect(editionSelectionAuthority(suggestion(false), pickerReview)).toBe('confirmation_required');
});
it('never guesses confirmation from an option source when the server says false', () => {
  const choices = selectedChoices();
  const unconfirmed = { ...choices, selection: { ...choices.selection!, confirmedByOwner: false } };
  expect(editionSelectionAuthority(unconfirmed, null)).toBe('confirmation_required');
});
it.each([null, 'Latn'])('compact fresh resume uses confirmed suggestion after expiry, script %s', script => {
  const choices = suggestion(true, script);
  const edits = { quantity: 8, priceMinor: 100, shelfLocation: 'A2',
    notes: { publicNote: '', internalNote: 'latest note' } };
  const review = buildCompactReview(pickerCard(choices), pickerDefaults, edits, choices);
  expect(review).toMatchObject({ originalTitle: 'Chosen edition', authors: ['Chosen author'],
    originalLanguage: 'en', originalFieldConfirmation: { title: true, authors: [true] }, script, quantity: 8, priceMinor: 100, shelfLocation: 'A2',
    notes: { ...edits.notes, publicNote: null }, metadataChoice: { mode: 'edition_option', selectionId: choices.selection.selectionId } });
});
it('does not adopt confirmation from a different card or stale metadata revision', () => {
  const choices = suggestion(true);
  const card = pickerCard(choices);
  for (const stale of [{ ...choices, candidateId: editionUuid(99) },
    { ...choices, metadataRevision: choices.metadataRevision + 1 }]) {
    const review = buildCompactReview(card, { ...pickerDefaults, priceMinor: 100 }, {}, stale);
    expect(review).not.toBeNull();
    expect(review!.metadataChoice.mode).not.toBe('edition_option');
  }
});
it('keeps an empty shelf edit invalid instead of substituting a default during resume', () => {
  const choices = suggestion(true), card = pickerCard(choices), edits = { shelfLocation: '', priceMinor: 100 };
  expect(compactReviewDisplay(card, pickerDefaults, edits).location).toBe('');
  expect(buildCompactReview(card, pickerDefaults, edits, choices)).toBeNull();
});
it('never applies an unconfirmed historical receipt over the latest compact edits', () => {
  const response = suggestion(false);
  const edits = { originalTitle: 'Latest manual title', quantity: 9, priceMinor: 0 };
  expect(applyCompactEditionSelection(edits, response, 7)).toBe(edits);
});
