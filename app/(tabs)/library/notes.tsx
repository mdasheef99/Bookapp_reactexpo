import React, { useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { NotePassageLink } from '@/components/notes';
import { CategoryPicker, NoteButton, NoteLoading, NoteMessage, NoteScreen, ui } from '@/components/notes/ManualNoteUi';
import { BookButton, BookEmpty, BookError, BookOffline } from '@/components/library/ui';
import { LIBRARY_SPACING, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { categoryLabel, NoteCategory, ManualNote, noteKeys } from '@/features/books/notes/manualNoteContract';
import { manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { composeHref, openNoteComposer, openNoteReader, registerNoteContext, returnToBook } from '@/features/books/notes/noteNavigation';
import { useNoteContext, useNoteOperations } from '@/features/books/notes/useManualNotes';
import { ExportButton, ExportNotesDialog } from '@/components/library/export';
import { exportDeliveryAvailable } from '@/features/books/export/deliver';
import { NotesExportChoice, useNotesExport } from '@/features/books/export/useExportActions';

export default function NotesScreen() {
  const { userBookId = '' } = useLocalSearchParams<{ userBookId: string }>();
  const router = useRouter(); const navigation = useNavigation(); const colors = useLibraryAppearance(); const { actorId, book } = useNoteContext(userBookId);
  const { isOffline } = useNetworkStatus();
  const exports = useNotesExport(actorId, userBookId);
  const [exportOpen, setExportOpen] = useState(false);
  const lastExport = useRef<NotesExportChoice>({ format: 'markdown', scope: 'book' });
  const exportNotes = async (choice: NotesExportChoice) => {
    lastExport.current = choice;
    const pdfReady = await exports.run(choice);
    setExportOpen(pdfReady);
  };
  const closeExport = () => { exports.cancel(); setExportOpen(false); };
  const [filter, setFilter] = useState<NoteCategory | null>(null);
  const anchor = useRef(0); const list = useRef<FlatList<ManualNote>>(null);
  const operations = useNoteOperations(actorId, userBookId);
  const query = useQuery({ queryKey: noteKeys.collection(actorId, userBookId), queryFn: ({ signal }) => manualNotesGateway.list(actorId, userBookId, signal), enabled: !!actorId && !!book.data });
  const notes = query.data ?? []; const filtered = filter ? notes.filter(note => note.tag === filter) : notes;
  const add = () => openNoteComposer(router, actorId, userBookId, 'collection');
  const header = <View style={{ gap: LIBRARY_SPACING.sm, paddingBottom: LIBRARY_SPACING.lg }}>
    {isOffline && <BookOffline message="Offline · Showing saved content." />}
    {query.data && <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{`${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}</Text>}
    {exportDeliveryAvailable() && query.data && <View style={{ gap: LIBRARY_SPACING.xxs }}>
      <ExportButton label={exports.busy ? 'Exporting…' : 'Export'} accessibilityLabel={`Export notes for ${book.data?.title ?? 'Selected book'}`} variant="text"
        busy={exports.busy} disabled={isOffline || exports.busy} onPress={() => setExportOpen(true)} />
      {isOffline && <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Export needs a connection.</Text>}
    </View>}
    {exports.feedback && <View style={styles.refreshRow}>
      <Text accessibilityLiveRegion="polite" aria-live="polite"
        style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{exports.feedback.message}</Text>
      {exports.feedback.kind === 'error' && <BookButton label="Try again" variant="text" disabled={isOffline || exports.busy}
        onPress={() => { void exportNotes(lastExport.current); }} />}
    </View>}
    <CategoryPicker selected={filter} includeAll onChange={value => { setFilter(value); anchor.current = 0; list.current?.scrollToOffset({ offset: 0, animated: false }); }} />
    {filter && <NoteMessage caption message={`Showing ${categoryLabel(filter)} notes.`} />}
    {operations.map(operation => <View key={operation.submission.id} style={[styles.pendingRow, { borderColor: colors.divider }]}>
      <NoteMessage caption message={operation.status === 'confirmed' ? 'Saved submission ready to read' : operation.status === 'failed' ? 'Submission was not saved' : operation.status === 'conflict' ? 'Submission needs comparison' : 'Pending submission — save not confirmed'} />
      <BookButton label={operation.status === 'confirmed' ? 'Open saved submission' : 'Open pending submission'} variant="text" onPress={() => {
        const contextId = registerNoteContext({ actorId, bookId: userBookId, origin: operation.submission.origin, canBack: true });
        router.push(composeHref(userBookId, contextId, operation.submission.mode === 'edit' ? operation.submission.noteId : undefined, operation.submission.id));
      }} />
    </View>)}
    {query.isError && !!query.data && <View style={styles.refreshRow}>
      <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>Couldn&apos;t refresh.</Text>
      <BookButton label="Try again" variant="text" onPress={() => { void query.refetch(); }} />
    </View>}
  </View>;
  const unavailable = !actorId || !userBookId || book.isError;
  return <NoteScreen title="Notes" bookTitle={book.data?.title} backLabel="Book details" backAccessibilityLabel="Back to Book details" onBack={() => returnToBook(router, navigation, userBookId)}
    footer={!unavailable && book.data && !(query.isError && !query.data) ? <>
      {isOffline && <Text testID="book-connection-notice" style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Changes need a connection.</Text>}
      <NoteButton label="Add note" disabled={isOffline} onPress={add} />
    </> : undefined}>
    {unavailable ? <View style={ui.content}>{!!actorId && operations.length > 0 && header}<NoteMessage message="This book couldn't be opened." error /><NoteButton label="Try again" onPress={() => { void book.refetch(); }} /></View>
      : book.isPending || query.isPending ? operations.length > 0 ? <View style={ui.content}>{header}<NoteLoading variant="list" /></View> : <NoteLoading variant="list" />
      : query.isError && !query.data ? <View style={ui.content}>{header}<BookError kind={isOffline ? 'offline' : 'server'} subject="your notes" onRetry={() => { void query.refetch(); }} /></View>
      : <FlatList ref={list} data={filtered} keyExtractor={note => note.id} contentContainerStyle={ui.content}
        ListHeaderComponent={header} renderItem={({ item }) => <NotePassageLink note={item} onPress={() => openNoteReader(router, actorId, userBookId, item.id, 'collection')} />}
        ListEmptyComponent={<View style={{ gap: LIBRARY_SPACING.sm }}>
          <BookEmpty title={filter ? `No ${categoryLabel(filter)} notes` : 'No notes yet'} message={filter ? undefined : 'Add a note for this book.'} />
          {filter ? <BookButton label="Show all notes" variant="text" onPress={() => setFilter(null)} /> : null}
        </View>}
        onScroll={event => { anchor.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={100}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} tintColor={colors.accent} />} />}
    {exportOpen && <ExportNotesDialog visible busy={exports.busy} disabled={isOffline} ready={exports.ready} onClose={closeExport}
      onPrint={() => { exports.print(); setExportOpen(false); }} onDispose={exports.dispose}
      onExport={choice => { void exportNotes(choice); }} />}
  </NoteScreen>;
}

const styles = StyleSheet.create({
  pendingRow: {
    gap: LIBRARY_SPACING.xxs,
    paddingVertical: LIBRARY_SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  refreshRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: LIBRARY_SPACING.sm,
  },
});
