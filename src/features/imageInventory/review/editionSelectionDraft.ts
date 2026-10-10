import type { EditionChoices } from '../contracts/ownerEditionPicker';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';
import type { ReviewDraft } from './reviewForm';
import type { CompactReviewEdits } from './compactReviewDraft';

// Picker §§6-7: only the scoped server flag proves Owner confirmation on fresh resume.
export function editionSelectionAuthority(
  choices: EditionChoices, _review: OwnerCandidateReview | null,
): 'controlled' | 'confirmation_required' | 'none' {
  const selection = choices.selection;
  if (!selection) return 'none';
  return selection.confirmedByOwner === true ? 'controlled' : 'confirmation_required';
}
// Only call for an accepted controlled command response; generic refresh uses rebaseReviewDraft.
export function applyEditionSelection(
  draft: ReviewDraft, canonical: EditionChoices, previousMetadataRevision: number,
): ReviewDraft {
  if (!canonical.selection?.confirmedByOwner || canonical.metadataRevision <= previousMetadataRevision) return draft;
  const { selectionId, snapshot } = canonical.selection;
  return { ...draft, originalTitle: snapshot.title, authors: [...snapshot.authors],
    originalLanguage: snapshot.language, script: snapshot.script ?? '',
    metadataMode: 'edition_option', selectionId, currentMetadataSelectionId: selectionId,
    originalFieldConfirmation: { title: true, authors: snapshot.authors.map(() => true) } };
}
export function applyCompactEditionSelection(
  edits: CompactReviewEdits, canonical: EditionChoices, previousMetadataRevision: number,
): CompactReviewEdits {
  if (!canonical.selection?.confirmedByOwner || canonical.metadataRevision <= previousMetadataRevision) return edits;
  const { selectionId, snapshot } = canonical.selection;
  return { ...edits, originalTitle: snapshot.title, authors: [...snapshot.authors],
    originalLanguage: snapshot.language, script: snapshot.script,
    metadataChoice: { mode: 'edition_option', selectionId },
    originalFieldConfirmation: { title: true, authors: snapshot.authors.map(() => true) } };
}