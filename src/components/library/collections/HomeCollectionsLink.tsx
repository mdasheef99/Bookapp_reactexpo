import React from 'react';
import { Text } from 'react-native';
import { BookButton } from '../ui';
import { useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { useOrganising } from '@/features/books/organising/useOrganising';
import { useNoteDeckIndex } from '@/features/books/notes/useNoteDeck';

export function HomeCollectionsLink({ actor, onPress }: { actor: string; onPress: () => void }) {
  const collections = useOrganising(actor, 'collections');
  const notes = useNoteDeckIndex(actor, { kind: 'all' });
  const colors = useLibraryAppearance();
  if (collections.entities.data?.length || notes.data?.length) return <BookButton label="Collections" variant="text" onPress={onPress} />;
  if (collections.entities.isError || notes.isError) {
    const retry = () => { collections.refresh(); void notes.refetch(); };
    return collections.isOffline
      ? <><Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>You&apos;re offline.</Text><BookButton label="Try collections again" variant="text" disabled onPress={retry} /></>
      : <BookButton label="Try collections again" variant="text" onPress={retry} />;
  }
  return null;
}
