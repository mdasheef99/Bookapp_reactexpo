import React from 'react';
import { BookButton } from '../ui';
import { useOrganising } from '@/features/books/organising/useOrganising';
import { useNoteDeckIndex } from '@/features/books/notes/useNoteDeck';

export function HomeCollectionsLink({ actor, onPress }: { actor: string; onPress: () => void }) {
  const collections = useOrganising(actor, 'collections');
  const notes = useNoteDeckIndex(actor, { kind: 'all' });
  if (collections.entities.data?.length || notes.data?.length) return <BookButton label="Collections" variant="text" onPress={onPress} />;
  if (collections.entities.isError || notes.isError) return <BookButton label="Try collections again" variant="text" onPress={() => { collections.refresh(); void notes.refetch(); }} />;
  return null;
}
