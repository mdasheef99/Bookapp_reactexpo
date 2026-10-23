import { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import type { EditionChoices } from '../contracts/ownerEditionPicker';
import type { useOwnerEditionPicker } from '../queries/ownerEditionPickerQueries';
import type { CompactEditionSearchDraft } from './CandidateEditionPicker';
import { normalizeIsbnClue } from '../review/isbn';
import { isbnSearchRecovery } from '../review/isbnSearchRecovery';

// Slice 5 SDD §§1,8–9: typed ISBN stays local across authoritative rereads and conflicts.
export function CandidateEditionIsbnSearch({ picker, choices, cardDraft, blocked, pending, showSavedIsbnRetry, onStart }: {
  picker: ReturnType<typeof useOwnerEditionPicker>; choices: EditionChoices | undefined;
  cardDraft?: CompactEditionSearchDraft; blocked: boolean; pending: boolean; showSavedIsbnRetry: boolean; onStart: () => void;
}) {
  const { colors } = useTheme();
  const [typedIsbn, setTypedIsbn] = useState('');
  const [validationError, setValidationError] = useState(false);
  const [recovery, setRecovery] = useState<ReturnType<typeof isbnSearchRecovery> | null>(null);
  const incomplete = cardDraft?.identityChanged === true && !cardDraft.request;
  const disabled = blocked || pending || incomplete || !choices;
  const run = async (isbn13: string | null) => {
    setValidationError(false); setRecovery(null); onStart();
    picker.requestOptions.reset(); picker.saveIdentityAndSearch.reset();
    try {
      await picker.setIsbnAndSearch.mutateAsync({ isbn13,
        ...(cardDraft?.identityChanged && cardDraft.request ? { reviewSave: cardDraft.request } : {}) });
    } catch (error) { setRecovery(isbnSearchRecovery(error)); }
  };
  return <View style={{ gap: 10 }}>
    <Text style={{ color: colors.textPrimary }}>ISBN</Text>
    <TextInput accessibilityLabel="ISBN" value={typedIsbn} maxLength={17}
      keyboardType={Platform.select({ ios: 'numbers-and-punctuation', default: 'default' })}
      autoCapitalize="characters" autoCorrect={false} editable={!blocked && !pending}
      style={{ color: colors.textPrimary, borderColor: colors.textSecondary, borderWidth: 1, borderRadius: 8, padding: 10 }}
      onChangeText={value => { setTypedIsbn(value); setValidationError(false); setRecovery(null); }} />
    <Text style={{ color: colors.textSecondary }}>On the back cover, above or below the barcode</Text>
    {validationError ? <Text accessibilityLiveRegion="assertive" style={{ color: colors.error }}>
      Check the ISBN; the last digit doesn't match
    </Text> : null}
    <Button title="Search by ISBN" disabled={disabled} onPress={() => {
      if (disabled) return;
      const normalized = normalizeIsbnClue(typedIsbn);
      if (normalized.status !== 'valid' || !normalized.isbn13) { setValidationError(true); setRecovery(null); return; }
      void run(normalized.isbn13);
    }} />
    {choices?.ownerIsbn13 ? <>
      <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Searching by ISBN {choices.ownerIsbn13}</Text>
      <Button title="Search by title instead" variant="secondary" disabled={disabled}
        onPress={() => { if (!disabled) void run(null); }} />
      {showSavedIsbnRetry && !recovery ? <Button title="Retry search" disabled={disabled}
        onPress={() => { if (!disabled && choices.ownerIsbn13) void run(choices.ownerIsbn13); }} /> : null}
    </> : null}
    {recovery ? <>
      <Text accessibilityLiveRegion="assertive" style={{ color: colors.error }}>{recovery.message}</Text>
      {recovery.kind === 'retry' && picker.isbnRetryAvailable ? <Button title="Retry search" disabled={blocked || pending} onPress={() => {
        if (blocked || pending) return;
        setRecovery(null);
        void picker.retryIsbnSearch().catch(error => setRecovery(isbnSearchRecovery(error)));
      }} /> : <Text style={{ color: colors.textSecondary }}>{recovery.kind === 'retry' ? 'Press Search by ISBN again' : recovery.nextStep}</Text>}
    </> : null}
  </View>;
}
