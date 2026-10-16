import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { OwnerUxClientError, registeredOwnerUxError } from '../api/ownerUxTransport';
import type { IdentitySearchRequest, IdentitySearchResult } from '../queries/ownerEditionPickerQueries';

// Picker EP-D07 (2026-10-17): the card supplies the full review it would save on Add.
export type EditionIdentityFixSource = Readonly<{
  title: string;
  authors: readonly string[];
  build: (title: string, authors: string[]) => IdentitySearchRequest | { message: string };
}>;

const clean = (authors: readonly string[]) => authors.map(author => author.trim()).filter(Boolean);
const sameIdentity = (title: string, authors: readonly string[], source: EditionIdentityFixSource) =>
  title.trim() === source.title.trim() && clean(authors).join('\n') === clean(source.authors).join('\n');

export function identityFixErrorMessage(error: unknown): string {
  if (error instanceof OwnerUxClientError) {
    if (['P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_CANDIDATE_VERSION_CONFLICT'].includes(error.code)) {
      return 'This book changed. Close and reopen this sheet, then try again.';
    }
    if (!error.retryable) return registeredOwnerUxError(error.code).message;
  }
  if (error instanceof Error && error.message === 'OWNER_CANDIDATE_AUTHORITY_CHANGED') {
    return 'This book changed. Close and reopen this sheet, then try again.';
  }
  return 'The change could not be confirmed. Check the card before trying again.';
}

export function EditionIdentityFix({ source, blocked, clearsEdition, onSubmit }: {
  source: EditionIdentityFixSource;
  blocked: boolean;
  clearsEdition: boolean;
  onSubmit: (request: IdentitySearchRequest) => Promise<IdentitySearchResult>;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(source.title);
  const [authors, setAuthors] = useState<string[]>(source.authors.length ? [...source.authors] : ['']);
  const [message, setMessage] = useState<string | null>(null);
  const inputStyle = { color: colors.textPrimary, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 10, minHeight: 44 } as const;
  const unchanged = sameIdentity(title, authors, source);
  const start = () => {
    setTitle(source.title); setAuthors(source.authors.length ? [...source.authors] : ['']);
    setMessage(null); setOpen(true);
  };
  const submit = async () => {
    if (blocked || unchanged || !title.trim()) return;
    const built = source.build(title.trim(), clean(authors));
    if ('message' in built) { setMessage(built.message); return; }
    setMessage(null);
    try {
      const result = await onSubmit(built);
      setOpen(false);
      setMessage(result.searched ? 'Title and author saved. Searching books…'
        : 'Title and author saved. Use Search Books to search again.');
    } catch (error) { setMessage(identityFixErrorMessage(error)); }
  };
  return <View style={{ gap: 8 }}>
    {open ? <View style={{ gap: 8 }} testID="edition-identity-fix">
      <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontWeight: '700' }}>Fix title or author</Text>
      <TextInput accessibilityLabel="Corrected title" value={title} maxLength={512} editable={!blocked}
        onChangeText={setTitle} style={inputStyle} />
      {authors.map((author, index) => <View key={`fix-author-${index}`} style={{ gap: 6 }}>
        <TextInput accessibilityLabel={`Corrected author ${index + 1}`} value={author} maxLength={256}
          editable={!blocked} style={inputStyle}
          onChangeText={value => setAuthors(current => current.map((item, i) => i === index ? value : item))} />
        {authors.length > 1 ? <Button title={`Remove author ${index + 1}`} variant="ghost" size="sm" disabled={blocked}
          onPress={() => setAuthors(current => current.filter((_, i) => i !== index))} /> : null}
      </View>)}
      {authors.length < 20 ? <Button title="Add author" variant="secondary" size="sm" disabled={blocked}
        onPress={() => setAuthors(current => [...current, ''])} /> : null}
      {clearsEdition ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>
        Saving clears the chosen edition. You can choose again from the new results.</Text> : null}
      <Text style={{ color: colors.textSecondary }}>Saving also keeps this card's price and other details.</Text>
      <Button title="Save and search again" disabled={blocked || unchanged || !title.trim()}
        onPress={() => { void submit(); }} />
      <Button title="Cancel" variant="ghost" disabled={blocked} onPress={() => { setOpen(false); setMessage(null); }} />
    </View> : <Button title="Wrong title or author? Fix it" variant="secondary" disabled={blocked} onPress={start} />}
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>{message}</Text> : null}
  </View>;
}
