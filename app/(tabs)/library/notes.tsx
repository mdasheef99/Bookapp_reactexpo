import React, { useRef, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { NoteCard } from '@/components/notes';
import { CategoryPicker, NoteButton, NoteLoading, NoteMessage, NoteScreen, ui, useNoteColors } from '@/components/notes/ManualNoteUi';
import { categoryLabel, NoteCategory, ManualNote, noteKeys } from '@/features/books/notes/manualNoteContract';
import { manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { composeHref, openNoteComposer, openNoteReader, registerNoteContext, returnToBook } from '@/features/books/notes/noteNavigation';
import { useNoteContext, useNoteOperations } from '@/features/books/notes/useManualNotes';

export default function NotesScreen() {
  const { userBookId = '' } = useLocalSearchParams<{ userBookId: string }>();
  const router = useRouter(); const navigation = useNavigation(); const colors = useNoteColors(); const { actorId, book } = useNoteContext(userBookId);
  const [filter, setFilter] = useState<NoteCategory | null>(null);
  const anchor = useRef(0); const list = useRef<FlatList<ManualNote>>(null);
  const operations = useNoteOperations(actorId, userBookId);
  const query = useQuery({ queryKey: noteKeys.collection(actorId, userBookId), queryFn: ({ signal }) => manualNotesGateway.list(actorId, userBookId, signal), enabled: !!actorId && !!book.data });
  const notes = query.data ?? []; const filtered = filter ? notes.filter(note => note.tag === filter) : notes;
  const add = () => openNoteComposer(router, actorId, userBookId, 'collection');
  const header = <View style={{ gap: 12, paddingBottom: 20 }}>
    {query.data && <NoteMessage message={`${notes.length} saved note${notes.length === 1 ? '' : 's'}`} />}
    <CategoryPicker selected={filter} includeAll onChange={value => { setFilter(value); anchor.current = 0; list.current?.scrollToOffset({ offset: 0, animated: false }); }} />
    {filter && <NoteMessage message={`Showing ${categoryLabel(filter)} notes. Notes in other categories are available under All.`} />}
    {operations.map(operation => <View key={operation.submission.id} style={{ padding: 14, gap: 8, borderWidth: 1, borderRadius: 12, borderColor: colors.border, backgroundColor: colors.bgCard }}>
      <NoteMessage message={operation.status === 'confirmed' ? 'Saved submission ready to read' : operation.status === 'failed' ? 'Submission was not saved' : operation.status === 'conflict' ? 'Submission needs comparison' : 'Pending submission — save not confirmed'} />
      <NoteButton label={operation.status === 'confirmed' ? 'Open saved submission' : 'Open pending submission'} secondary onPress={() => {
        const contextId = registerNoteContext({ actorId, bookId: userBookId, origin: operation.submission.origin, canBack: true });
        router.push(composeHref(userBookId, contextId, operation.submission.mode === 'edit' ? operation.submission.noteId : undefined, operation.submission.id));
      }} />
    </View>)}
    {query.isError && !!query.data && <NoteMessage message="Refresh failed. Previously loaded notes are still shown." error />}
  </View>;
  const unavailable = !actorId || !userBookId || book.isError;
  return <NoteScreen title="Notes" bookTitle={book.data?.title} backLabel="Book details" onBack={() => returnToBook(router, navigation, userBookId)}
    footer={!unavailable && book.data ? <NoteButton label="Add note" onPress={add} /> : undefined}>
    {unavailable ? <View style={ui.content}>{!!actorId && operations.length > 0 && header}<NoteMessage message="This book couldn't be opened." error /><NoteButton label="Try again" onPress={() => { void book.refetch(); }} /></View>
      : book.isPending || query.isPending ? operations.length > 0 ? <View style={ui.content}>{header}<NoteLoading /></View> : <NoteLoading />
      : query.isError && !query.data ? <View style={ui.content}>{header}<NoteMessage message="Couldn't load your notes." error /><NoteButton label="Retry" onPress={() => { void query.refetch(); }} /></View>
      : <FlatList ref={list} data={filtered} keyExtractor={note => note.id} contentContainerStyle={ui.content}
        ListHeaderComponent={header} renderItem={({ item }) => <NoteCard note={item} onRead={() => openNoteReader(router, actorId, userBookId, item.id, 'collection')} />}
        ListEmptyComponent={<View style={{ gap: 12 }}><Text accessibilityRole="header" style={[ui.title, { color: colors.textPrimary }]}>{filter ? `No ${categoryLabel(filter)} notes` : 'No notes yet'}</Text>
          <NoteMessage message={filter ? 'This filter has no matching notes.' : 'Add a note for this book.'} />
          {filter ? <NoteButton label="Show all notes" secondary onPress={() => setFilter(null)} /> : <NoteButton label="Add your first note" onPress={add} />}</View>}
        onScroll={event => { anchor.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={100}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} tintColor={colors.accent} />} />}
  </NoteScreen>;
}
