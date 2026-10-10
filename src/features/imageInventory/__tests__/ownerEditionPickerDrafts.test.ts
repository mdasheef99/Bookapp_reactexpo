import { applyEditionSelection, editionSelectionAuthority } from '../review/editionSelectionDraft';
import { createReviewDraft, buildReviewInput, rebaseReviewDraft } from '../review/reviewForm';
import { applyCompactEditionSelection, buildCompactReview } from '../review/compactReviewDraft';
import { pickerChoices, selectedChoices, pickerDefaults, pickerDetail, pickerReview, pickerCard } from '../testing/editionPickerClientFixtures';
import { candidateDetailFixture, testUuid } from '../testing/ownerUxTestFixtures';

const defaults = { condition: 'good' as const, location: 'A1', quantity: 1, publication: 'private' as const };
it('replaces coherent full identity only after new selection authority and preserves all latest selling edits', () => {
  const draft = { ...createReviewDraft(candidateDetailFixture(), defaults), quantity: '9', priceMinor: '0',
    baseCondition: 'acceptable', hasDamage: true, damageTypes: ['pages' as const],
    damageNote: 'latest damage', isSellable: false, completeReadableSafe: false, shelfLocation: '',
    publicNote: '', internalNote: 'latest internal', publicationIntent: 'publish' as const };
  const next = applyEditionSelection(draft, selectedChoices(), 7);
  expect(next).toEqual({ ...draft, originalTitle: 'Chosen edition', authors: ['Chosen author'],
    originalLanguage: 'en', script: 'Latn', metadataMode: 'edition_option', selectionId: testUuid(30),
    currentMetadataSelectionId: testUuid(30), originalFieldConfirmation: { title: true, authors: [true] } });
  expect(selectedChoices().reviewVersion).toBeNull();
});
it.each([6, 7])('does not reapply old/replayed selection at revision %s over manual edits', (revision) => {
  const draft = createReviewDraft(candidateDetailFixture(), defaults);
  expect(applyEditionSelection(draft, selectedChoices({ metadataRevision: revision }), 7)).toBe(draft);
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
  const draft = createReviewDraft(candidateDetailFixture(), defaults);
  const current = selectedChoices({ selection: { ...selectedChoices().selection!,
    source: 'current_suggestion', optionId: null } as never });
  const next = applyEditionSelection({ ...draft, quantity: '1', priceMinor: '0', shelfLocation: 'A1' }, current, 7);
  expect(buildReviewInput(next)).toMatchObject({ success: true,
    data: { metadataChoice: { mode: 'edition_option', selectionId: testUuid(30) } } });
});
it('generic conflict rebase keeps manual identity and selling details intact', () => {
  const draft = { ...createReviewDraft(candidateDetailFixture(), defaults), originalTitle: 'Manual title',
    authors: ['Manual author'], metadataMode: 'manual' as const, selectionId: null, priceMinor: '0' };
  expect(rebaseReviewDraft(draft, pickerDetail())).toMatchObject({
    originalTitle: 'Manual title', authors: ['Manual author'], metadataMode: 'manual', priceMinor: '0',
  });
});
it('rebases compact selection onto latest edits without losing zero false empty null or notes', () => {
  const edits = { quantity: 8, priceMinor: 0, shelfLocation: '', notes: { publicNote: '', internalNote: null },
    damageDisclosure: { ...pickerReview.damageDisclosure, isSellable: false, completeReadableSafe: false },
    publicationIntent: 'publish' as const };
  const next = applyCompactEditionSelection(edits, selectedChoices(), 7);
  expect(next).toEqual({ ...edits, originalTitle: 'Chosen edition', authors: ['Chosen author'],
    originalLanguage: 'en', script: 'Latn', metadataChoice: { mode: 'edition_option', selectionId: testUuid(30) },
    originalFieldConfirmation: { title: true, authors: [true] } });
});
it('compact builder preserves supplied null script and unsaved notes', () => {
  const card = pickerCard(selectedChoices({ reviewVersion: 1 }), pickerReview);
  expect(buildCompactReview(card, pickerDefaults, { script: null, notes: { publicNote: '', internalNote: 'unsaved' } }))
    .toMatchObject({ script: null, notes: { publicNote: null, internalNote: 'unsaved' }, priceMinor: 0 });
});
it('initial full draft may resume an unambiguous option before any selling review exists', () => {
  const choices = selectedChoices();
  const draft = createReviewDraft(pickerDetail(choices), defaults, choices);
  expect(draft).toMatchObject({ metadataMode: 'edition_option', selectionId: testUuid(30),
    originalTitle: 'Chosen edition', authors: ['Chosen author'] });
});
it('legacy strong selected and manual payloads remain compatible', () => {
  expect(createReviewDraft(pickerDetail(), defaults).metadataMode).toBe('selected');
  expect(createReviewDraft(candidateDetailFixture(), defaults).metadataMode).toBe('manual');
});
it('initial compact review can resume an unambiguous saved option before the first review', () => {
  const choices = selectedChoices();
  const result = buildCompactReview(pickerCard(choices), pickerDefaults, {}, choices);
  expect(result).toMatchObject({ metadataChoice: { mode: 'edition_option', selectionId: testUuid(30) } });
  expect(choices.reviewVersion).toBeNull();
});
// Independent Task 6 review: picker §§6-7 / EP-AC11/19, coherent resume.
it('full resume preserves a selected null script instead of borrowing observed script', () => {
  const choices = selectedChoices();
  choices.selection!.snapshot = { ...choices.selection!.snapshot, script: null };
  const draft = createReviewDraft(pickerDetail(choices), defaults, choices);
  expect(draft.script).toBe('');
});
it.each([null, 'Latn'])('compact resume takes selected script %s rather than observed script', script => {
  const choices = selectedChoices();
  choices.selection!.snapshot = { ...choices.selection!.snapshot, script };
  const card = pickerCard(choices);
  card.observed = { ...card.observed, script: 'Deva' };
  const review = buildCompactReview(card, pickerDefaults, {}, choices);
  expect(review).toMatchObject({ script, metadataChoice: { mode: 'edition_option' } });
});
it('full resume retains a saved null script instead of borrowing observed script', () => {
  const choices = selectedChoices({ reviewVersion: 1 });
  choices.selection!.snapshot = { ...choices.selection!.snapshot, script: null };
  const saved = { ...pickerReview, script: null };
  expect(createReviewDraft(pickerDetail(choices, saved), defaults, choices).script).toBe('');
});
