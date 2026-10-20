import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { EditionChoices } from '../contracts/ownerEditionPicker';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import type { OwnerCandidateCommandSlot } from '../identity/useOwnerCardCommand';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import type { CompactReviewEdits } from '../review/compactReviewDraft';
import { MetadataSheetTrigger } from './MetadataSheetTrigger';
import { CandidateMetadataSheet } from './CandidateMetadataSheet';

export function CandidateReviewEditionSheet({ identity, detail, disabled, commandSlot, onSelection, onManual, onPendingChange }: {
  identity: ImageInventoryIdentity; detail: OwnerCandidateDetail; disabled: boolean;
  commandSlot: OwnerCandidateCommandSlot;
  onSelection: (choices: EditionChoices, previousRevision: number) => void;
  onManual: (edits: CompactReviewEdits) => void; onPendingChange: (pending: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<View>(null);
  const manual = (edits: CompactReviewEdits) => { onManual(edits); setOpen(false); };
  return <>
    <MetadataSheetTrigger title="Find or change edition" focusRef={triggerRef} onPress={() => setOpen(true)} />
    {open ? <CandidateMetadataSheet identity={identity} visible disabled={disabled} commandSlot={commandSlot}
      card={{ sessionId: detail.sessionId, candidateId: detail.candidateId, metadataState: detail.metadata.state,
        candidateVersion: detail.candidateVersion, metadataRevision: detail.metadata.revision, reviewVersion: detail.review.reviewVersion,
        metadataSummary: detail.metadata.snapshot ? { ...detail.metadata.snapshot,
          selectionId: detail.metadata.selectionId, representativeCover: detail.metadata.representativeCover } : null }}
      onSelection={onSelection} onPendingChange={onPendingChange} onClose={() => setOpen(false)}
      onEditManually={manual} restoreFocusRef={triggerRef} /> : null}
  </>;
}