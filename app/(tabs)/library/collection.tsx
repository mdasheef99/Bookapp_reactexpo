import React, { useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useOrganising } from '@/features/books/organising/useOrganising';
import { captureOrganisingActor } from '@/features/books/organising/organisingGateway';
import { collectionIds } from '@/features/books/collections/collectionsContract';
import { useCollectionCards } from '@/features/books/collections/useCollectionCards';
import { NoteDeckCard } from '@/features/books/notes/manualNoteContract';
import { readerHref, registerNoteContext } from '@/features/books/notes/noteNavigation';
import { NoteScreen } from '@/components/notes/ManualNoteUi';
import { CollectionNoteRow } from '@/components/library/collections/CollectionNoteRow';
import { BookButton, useBookFeedback } from '@/components/library/ui';
import { LIBRARY_SPACING, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';

export default function CollectionScreen() {
  const { collectionId = '' } = useLocalSearchParams<{ collectionId: string }>();
  const { user } = useAuth(), actor = user?.id ?? '', api = useOrganising(actor, 'collections');
  const router = useRouter(), route = useRoute(), colors = useLibraryAppearance(), { notify } = useBookFeedback();
  const group = api.entities.data?.find(row => row.id === collectionId);
  const ids = collectionIds(api.members.data ?? [], collectionId);
  const ready = api.entities.data !== undefined && api.members.data !== undefined;
  const cards = useCollectionCards(actor, collectionId, ids, ready && !!group && !api.isOffline);
  const [pending, setPending] = useState<string[]>([]), live = useRef(''); live.current = `${actor}:${collectionId}`;
  useEffect(() => () => { live.current = ''; }, []);
  useEffect(() => { setPending([]); }, [actor, collectionId]);
  const back = () => router.replace('/(tabs)/library/collections');
  const remove = async (noteId: string) => {
    if (pending.includes(noteId) || api.isOffline) return;
    const guard = captureOrganisingActor(actor), identity = `${actor}:${collectionId}`;
    setPending(rows => [...rows, noteId]);
    try { await api.membership(noteId, collectionId, false); guard(); if (live.current === identity) notify({ kind: 'success', message: `Removed from ${group?.name ?? 'collection'}` }); }
    catch (error) { try { guard(); if (live.current === identity) notify({ kind: 'error', message: error instanceof Error ? error.message : 'Could not remove this note.', action: { label: 'Try again', onPress: () => { try { guard(); if (live.current === identity) void remove(noteId); } catch { /* previous account */ } } } }); } catch { /* previous account */ } }
    finally { if (live.current === identity) setPending(rows => rows.filter(id => id !== noteId)); }
  };
  const retry = () => { api.refresh(); void cards.refetch(); };
  const text = (value: string) => <Text style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>{value}</Text>;
  const header = <View style={styles.header}>
    {api.isOffline && text("You're offline.")}
    {(api.entities.isError || api.members.isError || cards.isError) && <>{text("Couldn't refresh this collection.")}<BookButton label="Try again" variant="text" onPress={retry} /></>}
    {group && ready && ids.length > 0 && <BookButton label="Swipe through" variant="primary" onPress={() => router.push({ pathname: '/(tabs)/library/notes-swipe', params: { scope: 'collection', collectionId } })} />}
    <BookButton label="Refresh" variant="text" onPress={retry} />
  </View>;
  const data = (cards.data?.pages.flat() ?? []).filter(card => ids.includes(card.note.id));
  return <NoteScreen title={group?.name ?? 'Collection'} backLabel="Back to Collections" onBack={back}>
    {api.entities.data !== undefined && !group ? <View style={styles.header}>{text('This collection no longer exists.')}<BookButton label="Back to Collections" variant="primary" onPress={back} /></View>
      : <FlatList<NoteDeckCard> data={data} keyExtractor={card => card.note.id} contentContainerStyle={styles.content} ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={api.entities.isRefetching || api.members.isRefetching} onRefresh={retry} tintColor={colors.accent} />}
        renderItem={({ item }) => <CollectionNoteRow card={item} offline={api.isOffline} pending={pending.includes(item.note.id)} onRemove={() => { void remove(item.note.id); }} onOpen={() => {
          router.push(readerHref(item.note.user_book_id, item.note.id, registerNoteContext({ actorId: actor, bookId: item.note.user_book_id, origin: 'collection', canBack: true, collectionId, collectionKey: route.key })));
        }} />}
        onEndReached={() => { if (cards.hasNextPage && !cards.isFetchingNextPage) void cards.fetchNextPage(); }}
        ListFooterComponent={cards.hasNextPage ? <BookButton label={cards.isFetchingNextPage ? 'Loading notes…' : 'Load more notes'} variant="text" disabled={cards.isFetchingNextPage || api.isOffline} onPress={() => { void cards.fetchNextPage(); }} /> : null}
        ListEmptyComponent={<View style={styles.header}>{ready && group && !ids.length ? <>{text('No notes in this collection yet.')}{text('Add notes from the note reader or the swipe section.')}</> : api.isOffline ? text('Connect to load these notes.') : !api.entities.isError && !api.members.isError && !cards.isError ? text('Loading collection…') : null}</View>} />}
  </NoteScreen>;
}
const styles = StyleSheet.create({ content: { padding: LIBRARY_SPACING.lg }, header: { gap: LIBRARY_SPACING.md, paddingBottom: LIBRARY_SPACING.lg } });
