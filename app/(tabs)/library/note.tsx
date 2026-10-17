import React, { useRef, useState } from 'react';
import { Clipboard, Platform, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { NoteButton, NoteDialog, NoteDialogSpec, NoteLoading, NoteMessage, NoteScreen, ScrollView, ui, useNoteColors } from '@/components/notes/ManualNoteUi';
import { categoryLabel, noteKeys, NoteWriteError } from '@/features/books/notes/manualNoteContract';
import { isManualNoteDeleteAuthorized, manualNoteDeleteAdapter, manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { composeHref, noteRouteContext, registerNoteContext, retainedReaderKey, returnFromNote } from '@/features/books/notes/noteNavigation';
import { useNoteContext, useNoteOperations, useNoteRemovalRefresh } from '@/features/books/notes/useManualNotes';

export default function NoteReaderScreen() {
  const { bookId = '', noteId = '', contextId } = useLocalSearchParams<{ bookId: string; noteId: string; contextId?: string }>();
  const router = useRouter(); const navigation = useNavigation(); const colors = useNoteColors(); const { actorId, book } = useNoteContext(bookId);
  const context = noteRouteContext(contextId, actorId, bookId); const removeFromCache = useNoteRemovalRefresh(actorId, bookId);
  const query = useQuery({ queryKey: noteKeys.record(actorId, bookId, noteId), queryFn: ({ signal }) => manualNotesGateway.record(actorId, bookId, noteId, signal), enabled: !!actorId && !!book.data && !!noteId });
  const operations = useNoteOperations(actorId, bookId);
  const pending = operations.find(op => op.submission.mode === 'edit' && op.submission.noteId === noteId && ['saving', 'unknown'].includes(op.status));
  const deleteAuthorized = isManualNoteDeleteAuthorized();
  const [feedback, setFeedback] = useState(''); const [dialog, setDialog] = useState<NoteDialogSpec | null>(null); const [deleting, setDeleting] = useState(false);
  const scroll = useRef<ScrollView>(null); const readingPosition = useRef(0);
  const back = () => returnFromNote(router, context, navigation);
  const editorContext = () => registerNoteContext({ ...context, canBack: true, readerReturn: true, readerKey: retainedReaderKey(navigation, bookId, noteId) });
  const copy = async () => {
    if (!query.data) return;
    try {
      if (Platform.OS === 'web') {
        if (!globalThis.navigator?.clipboard) throw new Error('Clipboard unavailable');
        await globalThis.navigator.clipboard.writeText(query.data.content);
      } else {
        Clipboard.setString(query.data.content);
        if (await Clipboard.getString() !== query.data.content) throw new Error('Clipboard did not confirm');
      }
      setFeedback('Note text copied.');
    } catch { setFeedback('Copy failed. You can select the note text to copy it.'); }
  };
  const remove = () => setDialog({ title: 'Delete this note?', message: 'This saved note will be deleted.', keep: 'Keep note', confirm: 'Delete note', action: () => {
    setDialog(null); setDeleting(true); setFeedback('');
    void manualNoteDeleteAdapter.remove(actorId, bookId, noteId).then(async () => { await removeFromCache(noteId); back(); }).catch((error: unknown) => setFeedback(error instanceof NoteWriteError ? error.message : 'Deletion was not confirmed. Refresh Notes before trying again.')).finally(() => setDeleting(false));
  } });
  const unavailable = !actorId || !bookId || !noteId || book.isError || query.isError || (!query.isPending && !query.data);
  return <NoteScreen title="Read note" bookTitle={book.data?.title} backLabel={context.origin === 'book' ? 'Book details' : 'Notes'} onBack={back}
    footer={!unavailable && query.data ? <>
      {pending ? <><NoteMessage message="A previous save for this note is not confirmed. Check it before editing again." /><NoteButton label="Open pending submission" secondary onPress={() => router.push(composeHref(bookId, editorContext(), noteId, pending.submission.id))} /></>
        : <NoteButton label="Edit note" disabled={deleting} onPress={() => router.push(composeHref(bookId, editorContext(), noteId))} />}
      <NoteButton label="Copy text" secondary onPress={() => { void copy(); }} disabled={deleting} />
    </> : undefined}>
    {unavailable ? <View style={ui.content}><NoteMessage message="This note is missing or couldn't be opened." error /><NoteButton label="Try again" onPress={() => { void book.refetch(); void query.refetch(); }} /></View>
      : book.isPending || query.isPending ? <NoteLoading /> : <ScrollView ref={scroll} contentContainerStyle={ui.content} onScroll={event => { readingPosition.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={100}
        onContentSizeChange={() => scroll.current?.scrollTo({ y: readingPosition.current, animated: false })}>
        {query.data?.tag != null && <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{categoryLabel(query.data.tag)}</Text>}
        {query.data?.page_number != null && <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Page {query.data.page_number}</Text>}
        <Text selectable style={{ color: colors.textPrimary, fontSize: 19, lineHeight: 31 }}>{query.data?.content}</Text>
        {!!feedback && <NoteMessage message={feedback} />}
        <NoteButton label={deleting ? 'Deleting…' : 'Delete note'} secondary disabled={deleting || !!pending || !deleteAuthorized} onPress={remove} />
      </ScrollView>}
    <NoteDialog spec={dialog} onKeep={() => setDialog(null)} />
  </NoteScreen>;
}
