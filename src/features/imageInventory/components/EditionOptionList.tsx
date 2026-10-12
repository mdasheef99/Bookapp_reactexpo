import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import type { EditionRow } from '../contracts/ownerEditionPicker';
import { MetadataCover } from './MetadataCover';

// Picker §§3/13.2 / EP-D03/04: slice original positions; never filter or reorder.
export function EditionOptionList({ rows, selectedOptionId, disabled, onSelect }: {
  rows: readonly EditionRow[]; selectedOptionId: string | null;
  disabled: boolean; onSelect: (row: EditionRow) => void;
}) {
  const { colors } = useTheme();
  const responseKey = rows.map(row => row.optionId).join(':');
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);
  const expanded = expandedResponse === responseKey;
  const [linkError, setLinkError] = useState(false);
  return <View style={{ gap: 12 }}>
    {rows.slice(0, expanded ? 10 : 5).map(row => {
      const metadata = row.metadata;
      const provider = row.googleBooksUrl?.startsWith('https://openlibrary.org/books/') ? 'Open Library' : 'Google Books';
      const unavailable = row.eligibility === 'unavailable' || !metadata;
      const blocked = disabled || row.eligibility !== 'eligible' || !metadata;
      return <View key={row.optionId} testID={`edition-row-${row.optionId}`}
        style={{ borderWidth: 1, borderRadius: 12, borderColor: colors.border, padding: 12, gap: 8 }}>
        {unavailable ? <Text style={{ color: colors.textSecondary }}>Result {row.ordinal + 1} unavailable</Text> : <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <MetadataCover reference={metadata.coverReference} label={`Cover for ${metadata.title}`}
              placeholderLabel={`No cover available for ${metadata.title}`} style={{ width: 64, height: 96, borderRadius: 6 }} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>{metadata.title}</Text>
              <Text selectable style={{ color: colors.textPrimary }}>{metadata.authors.join(', ')}</Text>
              {metadata.publishedDate ? <Text selectable style={{ color: colors.textSecondary }}>Published: {metadata.publishedDate}</Text> : null}
              {metadata.publisher ? <Text selectable style={{ color: colors.textSecondary }}>Publisher: {metadata.publisher}</Text> : null}
              {metadata.isbn13 || metadata.isbn10 ? <Text selectable style={{ color: colors.textSecondary }}>ISBN: {metadata.isbn13 ?? metadata.isbn10}</Text> : null}
              {metadata.language ? <Text selectable style={{ color: colors.textSecondary }}>Language: {metadata.language}</Text> : null}
            </View>
          </View>
          <Text style={{ color: colors.textSecondary }}>{provider}</Text>
          {row.googleBooksUrl ? <Button title={'View on '+provider} variant="secondary" size="sm"
            accessibilityLabel={'View result ' + (row.ordinal+1) + ' on ' + provider}
            onPress={() => { void Linking.openURL(row.googleBooksUrl!).catch(() => setLinkError(true)); }} /> : null}
          {row.eligibility === 'ineligible' ? <Text style={{ color: colors.textSecondary }}>Not eligible for this book</Text> : null}
          <Pressable accessibilityRole="button" disabled={blocked}
            accessibilityLabel={`Select result ${row.ordinal + 1}: ${metadata.title}`}
            accessibilityState={{ disabled: blocked, selected: selectedOptionId === row.optionId }}
            onPress={() => { if (!blocked) onSelect(row); }}
            style={{ minHeight: 48, padding: 12, borderRadius: 8, backgroundColor: colors.bgSecondary }}>
            <Text style={{ color: blocked ? colors.textSecondary : colors.accent }}>
              {selectedOptionId === row.optionId ? 'Selected edition' : 'Select edition'}
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