import { useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import type { EditionChoices, EditionRow } from '../contracts/ownerEditionPicker';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import type { OwnerCandidateCommandSlot } from '../identity/useOwnerCardCommand';
import { useOwnerEditionPicker } from '../queries/ownerEditionPickerQueries';
import { freshEditionChoices } from '../queries/ownerEditionPickerCache';
import { versionsRegress, type CandidateVersions } from '../queries/ownerCandidateAuthority';
import { createEditionLookupCommand, createEditionSelectionCommand } from '../api/ownerEditionPickerCommands';
import { EditionOptionList } from './EditionOptionList';
import { editionSelectionRecovery } from '../review/editionSelectionRecovery';

// Picker §§3/6-7/13.2: only explicit Search Books acquires alternatives.
export function CandidateEditionPicker({ identity, sessionId, candidateId, commandSlot,
  disabled, onSelection, onPendingChange, onEditIdentity, minimumVersions, children }: {
  identity: ImageInventoryIdentity; sessionId: string; candidateId: string;
  commandSlot: OwnerCandidateCommandSlot; disabled: boolean;
  onSelection: (choices: EditionChoices, previousRevision: number) => void;
  onPendingChange?: (pending: boolean) => void;
  // Existing manual identity path; offered when a fresh result set has nothing selectable.
  onEditIdentity?: () => void;
  minimumVersions?: CandidateVersions;
  children: (choices: EditionChoices | undefined) => ReactNode;
}) {
  const { colors } = useTheme();
  const picker = useOwnerEditionPicker(identity, sessionId, candidateId, commandSlot, { onSelection });
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
    onPendingChange?.(picker.selectionPending);
  }, [onPendingChange, picker.selectionPending]);
  useEffect(() => () => onPendingChange?.(false), [onPendingChange]);
  const blocked = disabled || picker.selectionPending || picker.isCommandActive();
  const fresh = !!choices?.optionsExpiresAt;
  const pending = picker.lookupPending || choices?.lookupStatus === 'pending';
  const selectionRecovery = picker.selectEdition.error ? editionSelectionRecovery(picker.selectEdition.error) : null;
  const act = async (kind: 'selection' | 'lookup', work: () => Promise<unknown>) => {
    const success = kind === 'selection' ? 'Edition saved.' : 'Edition search requested.';
    setMessage(null);
    try { await work(); setMessage(success); }
    catch (error) { setMessage(kind === 'selection' ? editionSelectionRecovery(error).message
      : 'The action could not be confirmed. Your current choice and selling details are preserved.'); }
  };
  const select = (row: EditionRow) => {
    if (!choices || blocked || row.eligibility !== 'eligible' || !row.metadata) return;
    void act('selection', () => picker.selectEdition.mutateAsync(createEditionSelectionCommand(choices,
      { source: 'edition_option', optionId: row.optionId })));
  };
  return <View style={{ gap: 10 }}>
    {children(choices)}
    {choices?.selection?.source === 'current_suggestion' && !choices.selection.confirmedByOwner ? <Button title="Confirm current suggestion"
      disabled={blocked} onPress={() => {
        if (!blocked) void act('selection', () => picker.selectEdition.mutateAsync(createEditionSelectionCommand(choices,
          { source: 'current_suggestion', selectionId: choices.selection!.selectionId })));
      }} /> : null}
    <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontWeight: '800' }}>Book search results</Text>
    {picker.choices.isLoading ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Loading edition choices…</Text> : null}
    {picker.choices.error || stale ? <>
      <Text accessibilityLiveRegion="assertive" style={{ color: colors.error }}>Edition choices are unavailable. Retry the saved choices read.</Text>
      <Button title="Retry choices" variant="secondary" onPress={() => { void picker.choices.refetch(); }} />
    </> : null}
    {pending ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Searching books…</Text> : null}
    {picker.selectionPending ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Saving edition…</Text> : null}
    {choices && !fresh && !pending ? <>
      <Text style={{ color: colors.textSecondary }}>{choices.lookupStatus === 'failed'
        ? 'Edition search failed. Search again when ready.' : 'Alternatives are missing or expired. Your current choice is kept.'}</Text>
      <Button title="Search Books" disabled={blocked} onPress={() => {
        if (!blocked) void act('lookup', () => picker.requestOptions.mutateAsync(createEditionLookupCommand(choices)));
      }} />
    </> : null}
    {fresh && choices?.lookupStatus === 'failed' ? <Text accessibilityLiveRegion="polite" style={{ color: colors.error }}>Edition search failed. Your current choice and any fresh results are kept.</Text> : null}
    {fresh && choices?.rows.length === 0 ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>No book results were returned.</Text> : null}
    {choices && fresh ? <EditionOptionList rows={choices.rows} disabled={blocked}
      selectedOptionId={choices.selection?.optionId ?? null} onSelect={select} /> : null}
    {choices && fresh && onEditIdentity && !choices.rows.some(row => row.eligibility === 'eligible' && row.metadata) ? <>
      <Text style={{ color: colors.textSecondary }}>No result matches this book's title and author. If either was read incorrectly, correct it, save, then search again.</Text>
      <Button title="Edit title/author" variant="secondary" disabled={blocked} onPress={() => { if (!blocked) onEditIdentity(); }} />
    </> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: message === 'Edition saved.' ? colors.accent : colors.textSecondary }}>{message}</Text> : null}
    {selectionRecovery?.kind === 'refresh' ? <Button title="Refresh edition choices" variant="secondary"
      disabled={blocked || picker.choices.isFetching} onPress={() => { void picker.choices.refetch(); }} /> : null}
    {selectionRecovery?.kind === 'retry' ? <Button title="Retry selection" disabled={blocked}
      onPress={() => { if (!blocked) void act('selection', picker.retrySelection); }} /> : null}
    {picker.requestOptions.error ? <Button title="Retry search" disabled={blocked || pending}
      onPress={() => { if (!blocked && !pending) void act('lookup', picker.retryLookup); }} /> : null}
  </View>;
}