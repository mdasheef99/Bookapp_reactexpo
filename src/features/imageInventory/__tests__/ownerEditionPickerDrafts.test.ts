import { editionSelectionAuthority } from '../review/editionSelectionDraft';
import { applyCompactEditionSelection, buildCompactReview } from '../review/compactReviewDraft';
import { pickerChoices, selectedChoices, pickerDefaults, pickerReview, pickerCard } from '../testing/editionPickerClientFixtures';
import { testUuid } from '../testing/ownerUxTestFixtures';

it.each([6, 7])('does not reapply old/replayed selection at revision %s over manual edits', (revision) => {
  const edits = { originalTitle: 'Manual title', quantity: 9 };
  expect(applyCompactEditionSelection(edits, selectedChoices({ metadataRevision: revision }), 7)).toBe(edits);
});
it('does not adopt a read suggestion without successful command authority', () => {
  expect(editionSelectionAuthority(pickerChoices({ selection: {
    ...selectedChoices().selection!, source: 'current_suggestion', optionId: null, confirmedByOwner: false,
  } as never }), null)).toBe('confirmation_required');
});
it('resolves the no-review gap through explicit server authority', () => {
  const automatic = selectedChoices({ selection: { ...selectedChoices().selection!,
    source: 'current_suggestion', optionId: null, confirmedByOwner: false }, reviewVersion: null });
  const confirmedWithoutReview = { ...automatic, selection: { ...automatic.selection!, confirmedByOwner: true } };
  expect(editionSelectionAuthority(automatic, null)).toBe('confirmation_required');
  expect(editionSelectionAuthority(confirmedWithoutReview, null)).toBe('controlled');
});
it('uses server confirmation independently of a saved review mode', () => {
  const current = selectedChoices({ selection: { ...selectedChoices().selection!,
    source: 'current_suggestion', optionId: null } });
  expect(editionSelectionAuthority(current, pickerReview)).toBe('controlled');
  expect(editionSelectionAuthority(selectedChoices(), null)).toBe('controlled');
  expect(editionSelectionAuthority(current, { ...pickerReview,
    metadataChoice: { mode: 'selected', selectionId: testUuid(30) } })).toBe('controlled');
});
it('serializes explicit current-suggestion confirmation as edition_option, never selected', () => {
  const edits = { originalTitle: 'Manual title', quantity: 9 };
  const current = selectedChoices({ selection: { ...selectedChoices().selection!,
    source: 'current_suggestion', optionId: null } as never });
  const next = applyCompactEditionSelection(edits, current, 7);
  expect(buildCompactReview(pickerCard(current), pickerDefaults, { ...next, priceMinor: 100 }, current))
    .toMatchObject({ metadataChoice: { mode: 'edition_option', selectionId: testUuid(30) } });
});
it('compact refresh keeps manual identity and selling details intact', () => {
  const edits = { originalTitle: 'Manual title', authors: ['Manual author'],
    metadataChoice: { mode: 'manual' as const, selectionId: null }, priceMinor: 100 };
  expect(buildCompactReview(pickerCard(selectedChoices({ candidateVersion: 10 }), pickerReview), pickerDefaults, edits))
    .toMatchObject({ originalTitle: 'Manual title', authors: ['Manual author'],
      metadataChoice: { mode: 'manual', selectionId: null }, priceMinor: 100 });
});
it('rebases compact selection onto latest edits without losing zero false empty null or notes', () => {
  const edits = { quantity: 8, priceMinor: 0, shelfLocation: '', notes: { publicNote: '', internalNote: null },
    baseCondition: 'acceptable' as const,
    damageDisclosure: { hasDamage: true, damageTypes: ['pages' as const], damageNote: 'latest damage',
      isSellable: false, completeReadableSafe: false },
    publicationIntent: 'publish' as const };
  const next = applyCompactEditionSelection(edits, selectedChoices(), 7);
  expect(next).toEqual({ ...edits, originalTitle: 'Chosen edition', authors: ['Chosen author'],
    originalLanguage: 'en', script: 'Latn', metadataChoice: { mode: 'edition_option', selectionId: testUuid(30) },
    originalFieldConfirmation: { title: true, authors: [true] } });
});
// SDD-1 §6 (4b), AC4-7: manual validation derives a script when the input is null.
it('compact builder recomputes a null manual script and preserves unsaved notes', () => {
  const card = pickerCard(selectedChoices({ reviewVersion: 1 }), pickerReview);
  expect(buildCompactReview(card, pickerDefaults, { script: null, priceMinor: 100, notes: { publicNote: '', internalNote: 'unsaved' } }))
    .toMatchObject({ script: 'Latn', metadataChoice: { mode: 'manual', selectionId: null },
      notes: { publicNote: null, internalNote: 'unsaved' }, priceMinor: 100 });
});
it('initial compact review can resume an unambiguous saved option before the first review', () => {
  const choices = selectedChoices();
  const result = buildCompactReview(pickerCard(choices), { ...pickerDefaults, priceMinor: 100 }, {}, choices);
  expect(result).toMatchObject({ metadataChoice: { mode: 'edition_option', selectionId: testUuid(30) } });
  expect(choices.reviewVersion).toBeNull();
});
// Independent Task 6 review: picker §§6-7 / EP-AC11/19, coherent resume.
it.each([null, 'Latn'])('compact resume takes selected script %s rather than observed script', script => {
  const choices = selectedChoices();
  choices.selection!.snapshot = { ...choices.selection!.snapshot, script };
  const card = pickerCard(choices);
  card.observed = { ...card.observed, script: 'Deva' };
  const review = buildCompactReview(card, { ...pickerDefaults, priceMinor: 100 }, {}, choices);
  expect(review).toMatchObject({ script, metadataChoice: { mode: 'edition_option' } });
});
it('compact resume retains a saved null script instead of borrowing observed script', () => {
  const choices = selectedChoices({ reviewVersion: 1 });
  choices.selection!.snapshot = { ...choices.selection!.snapshot, script: null };
  const saved = { ...pickerReview, script: null };
  const card = pickerCard(choices, saved);
  card.observed = { ...card.observed, script: 'Deva' };
  expect(buildCompactReview(card, pickerDefaults, { priceMinor: 100 }, choices)?.script).toBeNull();
});
