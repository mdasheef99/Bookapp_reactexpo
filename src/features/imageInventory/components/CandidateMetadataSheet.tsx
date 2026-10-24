import { useCallback, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { EditionChoices } from '../contracts/ownerEditionPicker';
import type { OwnerCandidateCommandSlot } from '../identity/useOwnerCardCommand';
import { type ImageInventoryIdentity, useOwnerInventoryCandidate } from '../queries/ownerUxQueries';
import { CandidateEditionPicker } from './CandidateEditionPicker';
import type { CompactEditionSearchDraft } from './CandidateEditionPicker';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import { candidateVersions, versionsRegress } from '../queries/ownerCandidateAuthority';
import { CurrentMetadataSummary } from './CurrentMetadataSummary';

const stateLabels = {
  selected: 'Provider metadata selected', manual: 'Manual metadata', no_match: 'No provider match',
  ambiguous: 'No edition chosen yet', pending: 'Metadata processing',
  temporarily_unavailable: 'Metadata temporarily unavailable', failed: 'Metadata failed',
} as const;
function focus(target: View | null | undefined) {
  if (!target) return;
  if (Platform.OS === 'web') target.focus?.();
  else { const handle = findNodeHandle(target); if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle); }
}
export function CandidateMetadataSheet({ identity, card, visible, disabled, onClose,
  commandSlot, onSelection, onPendingChange, restoreFocusRef, disabledReason, cardDraft, onIdentitySaved }: {
  identity: ImageInventoryIdentity; card: Pick<OwnerBatchReviewCard, 'sessionId' | 'candidateId' | 'metadataState' | 'metadataSummary' | 'candidateVersion' | 'metadataRevision' | 'reviewVersion'>; visible: boolean; disabled: boolean;
  // Explains a caller-owned lock; it never enables or disables anything itself.
  disabledReason?: string | null;
  onClose: () => void;
  commandSlot?: OwnerCandidateCommandSlot;
  onSelection?: (choices: EditionChoices, previousRevision: number) => void;
  onPendingChange?: (pending: boolean) => void;
  restoreFocusRef?: RefObject<View | null>;
  cardDraft?: CompactEditionSearchDraft;
  onIdentitySaved?: (detail: OwnerCandidateDetail) => void;
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
    if (cardDraft?.identityChanged) return null;
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
  return <Modal visible={visible} transparent animationType="slide" accessibilityViewIsModal
    onRequestClose={close} onShow={() => focus(headingRef.current)}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
      <GlassCard padding={20} borderRadius={18} contentStyle={{ flexShrink: 1, minHeight: 0 }}
        style={{ maxHeight: '90%', backgroundColor: colors.bgPrimary }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
          <Text ref={headingRef} selectable accessibilityRole="header"
            style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '800' }}>Find or change edition</Text>
          <Text style={{ color: colors.textSecondary }}>Status: {stateLabels[card.metadataState]}</Text>
          {disabled && disabledReason ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>{disabledReason}</Text> : null}
          {query.isLoading ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Loading metadata…</Text> : null}
          {!query.isLoading && (query.error || !detail || !currentDetected) ? <>
            <Text accessibilityLiveRegion="assertive" style={{ color: colors.error }}>Metadata details are unavailable right now.</Text>
            <Button title="Retry metadata" variant="secondary" onPress={() => { void query.refetch(); }} />
          </> : null}
          {commandSlot && onSelection ? <CandidateEditionPicker identity={identity} sessionId={card.sessionId}
            candidateId={card.candidateId} commandSlot={commandSlot} disabled={disabled}
            onSelection={onSelection} onPendingChange={handlePendingChange}
            cardDraft={cardDraft} onIdentitySaved={onIdentitySaved}
            minimumVersions={minimumVersions}>{summary}</CandidateEditionPicker> : summary()}
          <Button title="Close metadata" variant="secondary" disabled={selectionPending || selectionLocked()} onPress={close} />
        </ScrollView>
      </GlassCard>
    </View>
  </Modal>;
}
