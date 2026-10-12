import { useCallback, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { EditionChoices } from '../contracts/ownerEditionPicker';
import type { OwnerCandidateCommandSlot } from '../identity/useOwnerCardCommand';
import type { CompactReviewEdits } from '../review/compactReviewDraft';
import { type ImageInventoryIdentity, useOwnerInventoryCandidate } from '../queries/ownerUxQueries';
import { CandidateEditionPicker } from './CandidateEditionPicker';
import { candidateVersions, versionsRegress } from '../queries/ownerCandidateAuthority';
import { CurrentMetadataSummary, MetadataValue } from './CurrentMetadataSummary';

const stateLabels = {
  selected: 'Provider metadata selected', manual: 'Manual metadata', no_match: 'No provider match',
  ambiguous: 'Multiple possible matches', pending: 'Metadata processing',
  temporarily_unavailable: 'Metadata temporarily unavailable', failed: 'Metadata failed',
} as const;
function focus(target: View | null | undefined) {
  if (!target) return;
  if (Platform.OS === 'web') target.focus?.();
  else { const handle = findNodeHandle(target); if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle); }
}
export function CandidateMetadataSheet({ identity, card, visible, disabled, onClose, onUseDetected,
  onEditManually, commandSlot, onSelection, onPendingChange, restoreFocusRef }: {
  identity: ImageInventoryIdentity; card: Pick<OwnerBatchReviewCard, 'sessionId' | 'candidateId' | 'metadataState' | 'metadataSummary' | 'candidateVersion' | 'metadataRevision' | 'reviewVersion'>; visible: boolean; disabled: boolean;
  onClose: () => void; onUseDetected: (edits: CompactReviewEdits) => void;
  onEditManually: (edits: CompactReviewEdits) => void;
  commandSlot?: OwnerCandidateCommandSlot;
  onSelection?: (choices: EditionChoices, previousRevision: number) => void;
  onPendingChange?: (pending: boolean) => void;
  restoreFocusRef?: RefObject<View | null>;
}) {
  const { colors } = useTheme();
  const headingRef = useRef<Text>(null);
  const pendingRef = useRef(false);
  const [selectionPending, setSelectionPending] = useState(false);
  const handlePendingChange = useCallback((pending: boolean) => {
    pendingRef.current = pending;
    setSelectionPending(pending);
    onPendingChange?.(pending);
  }, [onPendingChange]);
  const selectionLocked = () => pendingRef.current || !!commandSlot?.isCommandActive(card.candidateId);
  const query = useOwnerInventoryCandidate(identity, card.sessionId, card.candidateId, visible);
  const detail = query.data;
  const detailVersions = detail ? candidateVersions(detail) : undefined;
  const currentDetected = !!detailVersions && !versionsRegress(detailVersions, card);
  const currentDetail = !commandSlot || currentDetected;
  const minimumVersions = currentDetail ? detailVersions : card;
  const summary = (choices?: EditionChoices) => {
    const selected = choices?.selection;
    return <CurrentMetadataSummary snapshot={selected?.snapshot
      ?? (currentDetail ? detail?.metadata.snapshot : card.metadataSummary) ?? null}
      representative={selected?.source === 'edition_option' ? null
        : (currentDetail ? detail?.metadata.representativeCover : card.metadataSummary?.representativeCover) ?? null} />;
  };
  const close = () => {
    if (selectionLocked()) return;
    onClose(); queueMicrotask(() => focus(restoreFocusRef?.current));
  };
  const manual = (useDetected: boolean) => {
    if (disabled || selectionLocked() || (useDetected && (!detail || !currentDetected))) return;
    if (useDetected && detail) onUseDetected({ originalTitle: detail.observed.title,
      authors: [...detail.observed.authors], originalLanguage: detail.observed.language,
      script: detail.observed.script, metadataChoice: { mode: 'manual', selectionId: null } });
    else onEditManually({ metadataChoice: { mode: 'manual', selectionId: null } });
    queueMicrotask(() => focus(restoreFocusRef?.current));
  };
  return <Modal visible={visible} transparent animationType="slide" accessibilityViewIsModal
    onRequestClose={close} onShow={() => focus(headingRef.current)}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
      <GlassCard padding={20} borderRadius={18} style={{ maxHeight: '90%', backgroundColor: colors.bgPrimary }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
          <Text ref={headingRef} selectable accessibilityRole="header"
            style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '800' }}>Book metadata</Text>
          <Text style={{ color: colors.textSecondary }}>Status: {stateLabels[card.metadataState]}</Text>
          {query.isLoading ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Loading metadata…</Text> : null}
          {query.error || !detail || !currentDetected ? <>
            <Text accessibilityLiveRegion="assertive" style={{ color: colors.error }}>Metadata details are unavailable right now.</Text>
            <Button title="Retry metadata" variant="secondary" onPress={() => { void query.refetch(); }} />
          </> : null}
          {commandSlot && onSelection ? <CandidateEditionPicker identity={identity} sessionId={card.sessionId}
            candidateId={card.candidateId} commandSlot={commandSlot} disabled={disabled}
            onSelection={onSelection} onPendingChange={handlePendingChange} minimumVersions={minimumVersions}>{summary}</CandidateEditionPicker> : summary()}
          {detail ? <>
            {currentDetected ? <View style={{ gap: 4 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Detected details</Text>
              <MetadataValue label="Detected title" value={detail.observed.title} />
              <MetadataValue label="Detected authors" value={detail.observed.authors.join(', ') || 'Author unknown'} />
              <MetadataValue label="Detected language" value={detail.observed.language} />
            </View> : null}
            <Button title="Use detected details" disabled={disabled || selectionPending || !currentDetected} onPress={() => manual(true)} />
          </> : null}
          <Button title="Edit manually" variant="secondary" disabled={disabled || selectionPending} onPress={() => manual(false)} />
          <Button title="Close metadata" variant="secondary" disabled={selectionPending || selectionLocked()} onPress={close} />
        </ScrollView>
      </GlassCard>
    </View>
  </Modal>;
}
