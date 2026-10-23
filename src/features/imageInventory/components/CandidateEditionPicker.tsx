import { useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import type { EditionChoices, EditionRow } from '../contracts/ownerEditionPicker';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import type { OwnerCandidateCommandSlot } from '../identity/useOwnerCardCommand';
import { useOwnerEditionPicker, type IdentitySearchRequest } from '../queries/ownerEditionPickerQueries';
import { freshEditionChoices } from '../queries/ownerEditionPickerCache';
import { versionsRegress, type CandidateVersions } from '../queries/ownerCandidateAuthority';
import { createEditionLookupCommand, createEditionSelectionCommand } from '../api/ownerEditionPickerCommands';
import { EditionOptionList } from './EditionOptionList';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import { editionSelectionRecovery } from '../review/editionSelectionRecovery';
import { CandidateEditionIsbnSearch } from './CandidateEditionIsbnSearch';

// SDD-1 §4: the card owns identity edits; the picker only searches and selects.
export type CompactEditionSearchDraft = Readonly<{ identityChanged: boolean; pending?: boolean; request: IdentitySearchRequest | null }>;

// Picker §§3/6-7/13.2: only explicit Search Books acquires alternatives.
export function CandidateEditionPicker({ identity, sessionId, candidateId, commandSlot,
  disabled, onSelection, onPendingChange, cardDraft, onIdentitySaved, minimumVersions, children }: {
  identity: ImageInventoryIdentity; sessionId: string; candidateId: string;
  commandSlot: OwnerCandidateCommandSlot; disabled: boolean;
  onSelection: (choices: EditionChoices, previousRevision: number) => void;
  onPendingChange?: (pending: boolean) => void;
  cardDraft?: CompactEditionSearchDraft;
  onIdentitySaved?: (detail: OwnerCandidateDetail) => void;
  minimumVersions?: CandidateVersions;
  children: (choices: EditionChoices | undefined) => ReactNode;
}) {
  const { colors } = useTheme();
  const picker = useOwnerEditionPicker(identity, sessionId, candidateId, commandSlot, { onSelection, onIdentitySaved });
  const [, tick] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const stale = !!minimumVersions && !!picker.choices.data && versionsRegress(picker.choices.data, minimumVersions);
  const choices = picker.choices.data && !stale ? freshEditionChoices(picker.choices.data) : undefined;
  const expiresAt = picker.choices.data?.optionsExpiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const remaining = Date.parse(expiresAt) - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => tick(value => value + 1), Math.min(remaining + 1, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [expiresAt]);
  useEffect(() => {
    onPendingChange?.(picker.selectionPending || picker.identityPending || picker.isbnPending);
  }, [onPendingChange, picker.selectionPending, picker.identityPending, picker.isbnPending]);
  useEffect(() => () => onPendingChange?.(false), [onPendingChange]);
  const blocked = disabled || picker.selectionPending || picker.identityPending || picker.isbnPending || picker.isCommandActive();
  const identityChanged = cardDraft?.identityChanged === true;
  const fresh = !identityChanged && !!choices?.optionsExpiresAt;
  const pending = picker.lookupPending || picker.identityPending || picker.isbnPending || cardDraft?.pending === true || choices?.lookupStatus === 'pending';
  const isbnMode = !!choices?.ownerIsbn13;
  const selectionRecovery = picker.selectEdition.error ? editionSelectionRecovery(picker.selectEdition.error) : null;
  const saveSearchRecovery = picker.saveIdentityAndSearch.error ? editionSelectionRecovery(picker.saveIdentityAndSearch.error) : null;
  const lookupRecovery = picker.requestOptions.error ? editionSelectionRecovery(picker.requestOptions.error) : null;
  // SDD-1 §6 (4a): explain genuine no-match results; identity edits stay on the card.
  const noMatch = !!(choices && fresh && !choices.selection?.confirmedByOwner
    && !choices.rows.some(row => row.eligibility === 'eligible' && row.metadata)
    && (choices.rows.length === 0 || choices.rows.some(row => row.eligibility === 'ineligible' && row.metadata)));
  const act = async (kind: 'selection' | 'lookup', work: () => Promise<unknown>) => {
    const success = kind === 'selection' ? 'Edition saved.' : 'Edition search requested.';
    setMessage(null);
    try {
      const result = await work();
      setMessage(result && typeof result === 'object' && 'searched' in result && !result.searched
        ? 'Your card details are saved. Retry search to find editions.' : success);
    }
    catch (error) {
      if (kind === 'selection') { setMessage(editionSelectionRecovery(error).message); return; }
      const recovery = editionSelectionRecovery(error);
      setMessage(recovery.kind === 'refresh'
        ? "This book changed. Check the card's details, then search again."
        : recovery.message);
    }
  };
  const select = (row: EditionRow) => {
    if (!choices || blocked || row.eligibility !== 'eligible' || !row.metadata) return;
    void act('selection', () => picker.selectEdition.mutateAsync(createEditionSelectionCommand(choices,
      { source: 'edition_option', optionId: row.optionId })));
  };
  return <View style={{ gap: 10 }}>
    {children(identityChanged ? undefined : choices)}
    {!identityChanged && choices?.selection?.source === 'current_suggestion' && !choices.selection.confirmedByOwner ? <Button title="Confirm current suggestion"
      disabled={blocked} onPress={() => {
        if (!blocked) void act('selection', () => picker.selectEdition.mutateAsync(createEditionSelectionCommand(choices,
          { source: 'current_suggestion', selectionId: choices.selection!.selectionId })));
      }} /> : null}
    <CandidateEditionIsbnSearch picker={picker} choices={choices} cardDraft={cardDraft} blocked={blocked}
      showSavedIsbnRetry={isbnMode && !pending && (!fresh || choices?.lookupStatus === 'failed')}
      pending={pending} onStart={() => setMessage(null)} />
    <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontWeight: '800' }}>Book search results</Text>
    {picker.choices.isLoading ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Loading edition choices…</Text> : null}
    {picker.choices.error || stale ? <>
      <Text accessibilityLiveRegion="assertive" style={{ color: colors.error }}>Edition choices are unavailable. Retry the saved choices read.</Text>
      <Button title="Retry choices" variant="secondary" onPress={() => { void picker.choices.refetch(); }} />
    </> : null}
    {pending ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Searching books…</Text> : null}
    {picker.selectionPending ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Saving edition…</Text> : null}
    {choices && (identityChanged || !fresh) && !pending ? <>
      {identityChanged && !cardDraft?.request ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>
        Complete the card's details to search with the new title
      </Text> : !identityChanged ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>{choices.lookupStatus === 'failed'
        ? 'Edition search failed. Search again when ready.' : 'Alternatives are missing or expired. Your current choice is kept.'}</Text> : null}
      {!isbnMode ? <Button title={identityChanged && !cardDraft?.request ? 'Search with saved title' : 'Search Books'} disabled={blocked} onPress={() => {
        if (blocked) return;
        void act('lookup', () => {
          if (identityChanged && cardDraft?.request) return picker.saveIdentityAndSearch.mutateAsync(cardDraft.request);
          picker.saveIdentityAndSearch.reset();
          return picker.requestOptions.mutateAsync(createEditionLookupCommand(choices));
        });
      }} /> : null}
    </> : null}
    {fresh && choices?.lookupStatus === 'failed' ? <Text accessibilityLiveRegion="polite" style={{ color: colors.error }}>Edition search failed. Your current choice and any fresh results are kept.</Text> : null}
    {isbnMode && fresh && choices?.lookupStatus === 'ready' && !choices.rows.some(row => row.eligibility === 'eligible' && row.metadata)
      ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>{choices.rows.length === 0
        ? `No book was found for ISBN ${choices.ownerIsbn13}`
        : `Books found for ISBN ${choices.ownerIsbn13} can't be used. The reasons are shown below.`}</Text> : null}
    {!isbnMode && fresh && choices?.rows.length === 0 ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>No book results were returned.</Text> : null}
    {choices && fresh ? <EditionOptionList rows={choices.rows} disabled={blocked}
      selectedOptionId={choices.selection?.optionId ?? null} onSelect={select} /> : null}
    {noMatch && !identityChanged && !isbnMode ? <>
      <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>No result matches this book's title and author. Fix them on the card, then search again.</Text>
    </> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: message === 'Edition saved.' ? colors.accent : colors.textSecondary }}>{message}</Text> : null}
    {selectionRecovery?.kind === 'refresh' ? <Button title="Refresh edition choices" variant="secondary"
      disabled={blocked || picker.choices.isFetching} onPress={() => { void picker.choices.refetch(); }} /> : null}
    {selectionRecovery?.kind === 'retry' ? <Button title="Retry selection" disabled={blocked}
      onPress={() => { if (!blocked) void act('selection', picker.retrySelection); }} /> : null}
    {!isbnMode && (picker.saveIdentityAndSearch.data?.searched === false || saveSearchRecovery?.kind === 'retry' ? <Button
      title="Retry search" disabled={blocked || pending} onPress={() => {
        if (!blocked && !pending) void act('lookup', picker.retryIdentitySearch);
      }} /> : lookupRecovery?.kind === 'retry' ? <Button title="Retry search" disabled={blocked || pending}
      onPress={() => { if (!blocked && !pending) void act('lookup', picker.retryLookup); }} /> : null)}
  </View>;
}
