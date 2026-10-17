import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import type { EditionRow, EditionRejectionReason } from '../contracts/ownerEditionPicker';
import { MetadataCover } from './MetadataCover';

// Picker §3.1: copy only the authoritative safe enum; never classify in the client.
const rejectionMessages: Record<EditionRejectionReason, string> = {
  title_differs: 'Title differs from this book.',
  author_differs: 'Author differs from this book.',
  language_unknown: 'Language could not be verified.',
  language_differs: 'Language differs from this book.',
  volume_differs: 'Volume differs from this book.',
  identity_unverified: 'Other book identity checks could not be verified.',
  result_unavailable: 'Result metadata is unavailable.',
};
const selectable = (row: EditionRow) => row.eligibility === 'eligible' && row.metadata !== null;


// Picker §§3/13.2 / EP-D03/04: slice original positions; never filter or reorder.
export function EditionOptionList({ rows, selectedOptionId, disabled, onSelect }: {
  rows: readonly EditionRow[]; selectedOptionId: string | null;
  disabled: boolean; onSelect: (row: EditionRow) => void;
}) {
  const { colors } = useTheme();
  const responseKey = rows.map(row => row.optionId).join(':');
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);

  const [linkError, setLinkError] = useState(false);
  const eligibleCount = rows.filter(selectable).length;
  // Picker §13.2 amendment 2026-10-17: never hide every selectable edition behind Show all.
  const autoExpanded = rows.length > 5 && eligibleCount > 0 && !rows.slice(0, 5).some(selectable);
  const expanded = autoExpanded || expandedResponse === responseKey;
  return <View style={{ gap: 12 }}>
    {rows.length > 0 ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>
      {eligibleCount} selectable {eligibleCount === 1 ? 'edition' : 'editions'} in {rows.length} {rows.length === 1 ? 'result' : 'results'}.
    </Text> : null}
    {autoExpanded ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Showing all results because the selectable editions are further down.</Text> : null}
    {rows.slice(0, expanded ? 10 : 5).map(row => {
      const metadata = row.metadata;
      const provider = row.googleBooksUrl?.startsWith('https://openlibrary.org/books/') ? 'Open Library' : 'Google Books';
      const unavailable = row.eligibility === 'unavailable' || !metadata;
      const blocked = disabled || row.eligibility !== 'eligible' || !metadata;
      const chosen = selectedOptionId === row.optionId;
      return <View key={row.optionId} testID={`edition-row-${row.optionId}`}
        style={{ borderWidth: chosen ? 2 : 1, borderRadius: 12, borderColor: chosen ? colors.accent : colors.border, padding: 12, gap: 8 }}>
        {unavailable ? <Text style={{ color: colors.textSecondary }}>Result {row.ordinal + 1} unavailable</Text> : <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <MetadataCover reference={metadata.coverReference} label={`Cover for ${metadata.title}`}
              placeholderLabel={`No cover available for ${metadata.title}`} style={{ width: 64, height: 96, borderRadius: 6 }} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>{metadata.title}</Text>
              <Text selectable style={{ color: colors.textPrimary }}>{metadata.authors.join(', ')}</Text>
              {metadata.publishedDate ? <Text selectable style={{ color: colors.textSecondary }}>Published: {metadata.publishedDate}</Text> : null}
              {metadata.editionStatement ? <Text selectable style={{ color: colors.textSecondary }}>Edition: {metadata.editionStatement}</Text> : null}
              {metadata.format ? <Text selectable style={{ color: colors.textSecondary }}>Format: {metadata.format}</Text> : null}
              {metadata.publisher ? <Text selectable style={{ color: colors.textSecondary }}>Publisher: {metadata.publisher}</Text> : null}
              {metadata.isbn13 || metadata.isbn10 ? <Text selectable style={{ color: colors.textSecondary }}>ISBN: {metadata.isbn13 ?? metadata.isbn10}</Text> : null}
              {metadata.language ? <Text selectable style={{ color: colors.textSecondary }}>Language: {metadata.language}</Text> : null}
            </View>
          </View>
          <Text style={{ color: colors.textSecondary }}>{provider}</Text>
          {row.googleBooksUrl ? <Button title={'View on '+provider} variant="secondary" size="sm"
            accessibilityLabel={'View result ' + (row.ordinal+1) + ' on ' + provider}
            onPress={() => { void Linking.openURL(row.googleBooksUrl!).catch(() => setLinkError(true)); }} /> : null}
          {row.eligibility === 'ineligible' ? <Text style={{ color: colors.textSecondary }}>{row.rejectionReason ? rejectionMessages[row.rejectionReason] : 'Not eligible for this book'}</Text> : null}
          <Pressable accessibilityRole="button" disabled={blocked}
            accessibilityLabel={`Select result ${row.ordinal + 1}: ${metadata.title}`}
            accessibilityState={{ disabled: blocked, selected: selectedOptionId === row.optionId }}
            onPress={() => { if (!blocked) onSelect(row); }}
            style={{ minHeight: 48, padding: 12, borderRadius: 8, borderWidth: chosen ? 2 : 0, borderColor: colors.accent,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              backgroundColor: chosen ? 'transparent' : blocked ? colors.bgSecondary : colors.accent }}>
            {chosen ? <Text style={{ color: colors.accent, fontWeight: '800' }}>✓</Text> : null}
            <Text style={{ fontWeight: '700', color: chosen ? colors.accent : blocked ? colors.textTertiary : colors.bgPrimary }}>
              {chosen ? 'Selected edition' : 'Select edition'}
            </Text>
          </Pressable>
        </>}
      </View>;
    })}
    {linkError ? <Text accessibilityLiveRegion="polite" style={{ color: colors.error }}>The book link could not be opened.</Text> : null}
    {!expanded && rows.length > 5 ? <Button title="Show all" variant="secondary"
      accessibilityHint="Shows up to ten original results from this response"
      onPress={() => setExpandedResponse(responseKey)} /> : null}
  </View>;
}