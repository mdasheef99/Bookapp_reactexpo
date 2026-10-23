import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Clipboard, Platform, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { NoteButton, NoteDialog, NoteDialogSpec, NoteLoading, NoteMessage, NoteScreen, ScrollView, ui } from '@/components/notes/ManualNoteUi';
import { BookButton, BookOffline } from '@/components/library/ui';
import { ExportButton, PassageCardPreview } from '@/components/library/export';
import { LIBRARY_SPACING, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { bookNoteDate } from '@/components/library/bookDetails/NotePassages';
import { NoteProgressPrompt } from '@/components/library/history/NoteProgressPrompt';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { categoryLabel, noteKeys, NoteWriteError } from '@/features/books/notes/manualNoteContract';
import { isManualNoteDeleteAuthorized, manualNoteDeleteAdapter, manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { composeHref, noteRouteContext, registerNoteContext, retainedReaderKey, returnFromNote, SwipeRouteParams } from '@/features/books/notes/noteNavigation';
import { useNoteContext, useNoteOperations, useNoteRemovalRefresh } from '@/features/books/notes/useManualNotes';

export default function NoteReaderScreen() {
  const params = useLocalSearchParams() as unknown as SwipeRouteParams & {
    bookId: string;
    noteId: string;
    contextId?: string;
    justSaved?: string;
  };
  const { bookId = '', noteId = '', contextId, justSaved } = params;
  const router = useRouter(); const navigation = useNavigation(); const colors = useLibraryAppearance(); const { actorId, book } = useNoteContext(bookId);
  const justSavedFlag = justSaved === '1';
  const [promptArmed, setPromptArmed] = useState(false);
  const armedForNote = useRef<string | null>(null);
  useEffect(() => {
    if (justSavedFlag) {
      if (armedForNote.current !== noteId) {
        armedForNote.current = noteId;
        setPromptArmed(true);
      }
      try {
        (router as unknown as { setParams?: (params: Record<string, string | undefined>) => void }).setParams?.({
          justSaved: undefined,
        });
      } catch {
        // Best effort: clearing avoids re-offering on refresh/back.
      }
    } else if (armedForNote.current !== noteId) {
      armedForNote.current = noteId;
      setPromptArmed(false);
    }
  }, [justSavedFlag, noteId, router]);
  const { isOffline } = useNetworkStatus();
  const offlineRef = useRef(isOffline);
  offlineRef.current = isOffline;
  const context = noteRouteContext(contextId, actorId, bookId, params); const removeFromCache = useNoteRemovalRefresh(actorId, bookId);
  const query = useQuery({ queryKey: noteKeys.record(actorId, bookId, noteId), queryFn: ({ signal }) => manualNotesGateway.record(actorId, bookId, noteId, signal), enabled: !!actorId && !!book.data && !!noteId });
  const operations = useNoteOperations(actorId, bookId);
  const pending = operations.find(op => op.submission.mode === 'edit' && op.submission.noteId === noteId && ['saving', 'unknown'].includes(op.status));
  const deleteAuthorized = isManualNoteDeleteAuthorized();
  const [feedback, setFeedback] = useState(''); const [feedbackError, setFeedbackError] = useState(false);
  const [dialog, setDialog] = useState<NoteDialogSpec | null>(null); const [deleting, setDeleting] = useState(false);
  const [passagePreview, setPassagePreview] = useState(false);
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
      setFeedback('Note text copied.'); setFeedbackError(false);
    } catch { setFeedback('Copy failed. You can select the note text to copy it.'); setFeedbackError(true); }
  };
  const remove = () => setDialog({ title: 'Delete this note?', message: "This note will be deleted. You can't undo this.", keep: 'Keep note', confirm: 'Delete note', confirmVariant: 'destructive', action: () => {
    if (offlineRef.current) return;
    setDialog(null); setDeleting(true); setFeedback(''); setFeedbackError(false);
    void manualNoteDeleteAdapter.remove(actorId, bookId, noteId).then(async () => { await removeFromCache(noteId); if (navigation.isFocused()) back(); AccessibilityInfo.announceForAccessibility('Note deleted.'); }).catch((error: unknown) => { setFeedback(error instanceof NoteWriteError ? error.message : 'Deletion was not confirmed. Refresh Notes before trying again.'); setFeedbackError(true); }).finally(() => setDeleting(false));
  } });
  const unavailable = !actorId || !bookId || !noteId || (book.isError && !book.data) || (query.isError && !query.data) || (!query.isPending && !query.data);
  const meta = query.data ? [
    query.data.tag ? categoryLabel(query.data.tag) : null,
    query.data.page_number == null ? null : `Page ${query.data.page_number}`,
    bookNoteDate(query.data.created_at),
  ].filter(Boolean).join(' · ') : '';
  return <NoteScreen backLabel={context.origin === 'swipe' ? 'Back to your notes' : context.origin === 'book' ? 'Book details' : 'Notes'} backAccessibilityLabel={context.origin === 'swipe' ? 'Back to your notes' : context.origin === 'book' ? 'Back to Book details' : 'Back to Notes'} onBack={back}
    footer={!unavailable && query.data ? <>
      {pending ? <><NoteMessage message="A previous save for this note is not confirmed. Check it before editing again." /><NoteButton label="Open pending submission" secondary onPress={() => router.push(composeHref(bookId, editorContext(), noteId, pending.submission.id))} /></>
        : <><NoteButton label="Edit note" disabled={isOffline || deleting} onPress={() => router.push(composeHref(bookId, editorContext(), noteId))} /></>}
      <BookButton label="Copy text" variant="text" disabled={deleting} onPress={() => { void copy(); }} />
      {Platform.OS !== 'web' && query.data.tag === 'quote' && <ExportButton label="Share as image" variant="text"
        accessibilityLabel="Share quote as image" disabled={deleting} onPress={() => setPassagePreview(true)} />}
    </> : undefined}>
    {unavailable ? <View style={ui.content}><NoteMessage message="This note is missing or couldn't be opened." error /><NoteButton label="Try again" onPress={() => { void book.refetch(); void query.refetch(); }} /></View>
      : book.isPending || query.isPending ? <NoteLoading /> : <ScrollView ref={scroll} contentContainerStyle={ui.content} onScroll={event => { readingPosition.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={100}
        onContentSizeChange={() => scroll.current?.scrollTo({ y: readingPosition.current, animated: false })}>
        {isOffline && <BookOffline message="Offline · Showing saved content." />}
        {((query.isError && !!query.data) || (book.isError && !!book.data)) && <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>Couldn&apos;t refresh.</Text>}
        {!!book.data?.title && <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{book.data.title}</Text>}
        {!!meta && <Text style={[LIBRARY_TEXT.caption, { color: colors.textTertiary }]}>{meta}</Text>}
        <Text selectable style={[LIBRARY_TEXT.bodySerif, { color: colors.textPrimary }]}>{query.data?.tag === 'quote' ? `“${query.data?.content}”` : query.data?.content}</Text>
        {query.data && promptArmed ? (
          <NoteProgressPrompt
            actorId={actorId}
            userBookId={bookId}
            pageNumber={query.data.page_number}
            justSaved
          />
        ) : null}
        {!!feedback && <NoteMessage message={feedback} error={feedbackError} />}
        <View style={[styles.deleteSection, { borderColor: colors.divider }]}>
          {isOffline && <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Changes need a connection.</Text>}
          <BookButton label={deleting ? 'Deleting…' : 'Delete note'} variant="text" disabled={deleting || !!pending || !deleteAuthorized || isOffline} onPress={remove} />
        </View>
      </ScrollView>}
    <NoteDialog spec={dialog} confirmDisabled={isOffline} onKeep={() => setDialog(null)} />
    {passagePreview && Platform.OS !== 'web' && query.data?.tag === 'quote' && book.data && <PassageCardPreview visible onClose={() => setPassagePreview(false)}
      quote={query.data.content} title={book.data.title} author={book.data.authors[0] ?? null} page={query.data.page_number ?? null} />}
  </NoteScreen>;
}

const styles = StyleSheet.create({
  deleteSection: {
    gap: LIBRARY_SPACING.xs,
    paddingTop: LIBRARY_SPACING.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
