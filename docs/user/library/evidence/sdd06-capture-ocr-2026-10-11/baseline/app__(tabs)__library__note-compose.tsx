import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { CategoryPicker, NoteButton, NoteDialog, NoteDialogSpec, NoteForm, NoteLoading, NoteMessage, NoteScreen, ScrollView, ui, useNoteColors } from '@/components/notes/ManualNoteUi';
import { categoryLabel, fieldsChanged, ManualNote, noteFields, NoteFields, noteKeys, validateNote } from '@/features/books/notes/manualNoteContract';
import { manualNotesGateway, noteSaves } from '@/features/books/notes/manualNotesGateway';
import { noteRouteContext, readerHref, registerNoteContext, returnFromNote, returnToSavedReader } from '@/features/books/notes/noteNavigation';
import { useNoteContext, useNoteOperations, useNoteRefresh } from '@/features/books/notes/useManualNotes';
import { ComposerHistoryGuard, guardComposerHistory } from '@/features/books/notes/composerBrowserHistory';

export default function NoteComposeScreen() {
  const { bookId = '', noteId, contextId, operationId } = useLocalSearchParams<{ bookId: string; noteId?: string; contextId?: string; operationId?: string }>();
  const router = useRouter(); const navigation = useNavigation(); const colors = useNoteColors();
  const { actorId, book } = useNoteContext(bookId); const refresh = useNoteRefresh(actorId, bookId);
  const context = noteRouteContext(contextId, actorId, bookId);
  const operations = useNoteOperations(actorId, bookId);
  const [activeOperation, setActiveOperation] = useState<string | undefined>(operationId);
  const operation = operations.find(op => op.submission.id === activeOperation);
  const retainedEditReturn = useRef<typeof context | undefined>(undefined);
  if (operation?.submission.mode === 'edit') retainedEditReturn.current = {
    ...context, origin: operation.submission.origin,
    readerKey: noteRouteContext(operation.submission.sessionId, actorId, bookId).readerKey ?? context.readerKey
      ?? (retainedEditReturn.current?.actorId === actorId && retainedEditReturn.current.bookId === bookId ? retainedEditReturn.current.readerKey : undefined),
  };
  const returnContext = retainedEditReturn.current?.actorId === actorId && retainedEditReturn.current.bookId === bookId ? retainedEditReturn.current : context;
  const mode = operation?.submission.mode ?? (noteId ? 'edit' : 'create');
  const targetNoteId = operation?.submission.noteId ?? noteId;
  const sessionId = useRef(contextId ?? randomUUID()).current;
  const [fields, setFields] = useState<NoteFields>(() => noteFields());
  const [baseline, setBaseline] = useState<ManualNote>();
  const [step, setStep] = useState<'choose' | 'write'>(noteId || operationId ? 'write' : 'choose');
  const [showErrors, setShowErrors] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [dialog, setDialog] = useState<NoteDialogSpec | null>(null);
  const [feedback, setFeedback] = useState('');
  const [allowExit, setAllowExit] = useState(false);
  const departing = useRef(false);
  const approvedExit = useRef<(() => void) | null>(null);
  const browserHistoryGuard = useRef<ComposerHistoryGuard | null>(null);
  const finishExit = useCallback((action: () => void) => { departing.current = true; approvedExit.current = action; setAllowExit(true); }, []);
  useEffect(() => { if (allowExit && approvedExit.current) { const action = approvedExit.current; approvedExit.current = null; action(); } }, [allowExit]);
  const inputRef = useRef<TextInput>(null); const initialized = useRef(false); const returned = useRef(false);
  const restoreEditorFocus = useRef(false);
  const originalVersion = useRef<number | undefined>(undefined);
  const previousActor = useRef(actorId);
  useEffect(() => {
    if (previousActor.current === actorId) return;
    initialized.current = false; originalVersion.current = undefined;
    setFields(noteFields()); setBaseline(undefined); setActiveOperation(undefined); setDialog(null); setFeedback('');
    previousActor.current = actorId;
  }, [actorId]);
  const loaded = useQuery({ queryKey: noteKeys.record(actorId, bookId, targetNoteId ?? ''),
    queryFn: ({ signal }) => manualNotesGateway.record(actorId, bookId, targetNoteId!, signal), enabled: !!actorId && !!book.data && mode === 'edit' && !!targetNoteId });
  useEffect(() => {
    if (initialized.current) return;
    if (operation) {
      originalVersion.current = operation.submission.expectedVersion;
      setFields({ text: operation.submission.content, category: operation.submission.tag, page: operation.submission.page_number?.toString() ?? '' });
      if (loaded.data) setBaseline({ ...loaded.data, version: operation.submission.expectedVersion });
      initialized.current = true;
    } else if (mode === 'edit' && loaded.data) { originalVersion.current = loaded.data.version; setBaseline(loaded.data); setFields(noteFields(loaded.data)); initialized.current = true; }
    else if (mode === 'create' && book.data) { setFields(noteFields()); initialized.current = true; }
  }, [operation, loaded.data, book.data, mode, actorId]);
  const editorReady = initialized.current && previousActor.current === actorId;
  const locked = !!operation && ['saving', 'unknown'].includes(operation.status);
  const dirty = mode === 'edit' ? fieldsChanged(fields, baseline) : !!fields.text.trim() || !!fields.page.trim();
  const resumeFailed = operation && ['failed', 'conflict'].includes(operation.status);
  const leave = useCallback((action: () => void) => {
    if (operation?.status === 'confirmed') { finishExit(action); return; }
    if (locked) {
      setDialog({ title: 'Save not confirmed', message: "We couldn't confirm whether your note or changes were saved. Leaving won't cancel the request. Text in this editor may be lost after restarting. If saving succeeds, find the note in this book's Notes.",
        keep: 'Stay here', confirm: 'Leave', action: () => { setDialog(null); finishExit(action); } }); return;
    }
    if (dirty) {
      setDialog({ title: mode === 'edit' ? 'Discard changes?' : 'Discard this note?', message: mode === 'edit' ? "Your changes haven't been saved." : "Your note hasn't been saved.",
        keep: 'Keep editing', confirm: mode === 'edit' ? 'Discard changes' : 'Discard note', action: () => {
          if (activeOperation) noteSaves.forget(activeOperation); setDialog(null); finishExit(action);
        } }); return;
    }
    finishExit(action);
  }, [operation?.status, locked, dirty, mode, activeOperation, finishExit]);
  const browserExit = useRef({ protect: false, leave });
  browserExit.current = { protect: !allowExit && !departing.current && (dirty || locked), leave };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const guard = guardComposerHistory(window,
      () => browserExit.current.protect && navigation.isFocused(),
      action => browserExit.current.leave(action));
    browserHistoryGuard.current = guard;
    return () => { guard.dispose(); browserHistoryGuard.current = null; };
  }, [navigation]);
  usePreventRemove(!allowExit && (dirty || locked || (step === 'write' && mode === 'create')), ({ data }) => {
    if (categoryOpen) setCategoryOpen(false);
    else if (step === 'write' && mode === 'create' && !locked) setStep('choose');
    else leave(() => navigation.dispatch(data.action));
  });
  const returnToReader = () => returnToSavedReader(router, navigation, returnContext, targetNoteId!);
  const exit = () => leave(() => mode === 'edit' ? returnToReader() : returnFromNote(router, context, navigation));
  useEffect(() => { if (step === 'write' && !locked && !operationId) inputRef.current?.focus(); }, [step, locked, operationId]);
  useEffect(() => {
    if (departing.current || operation?.status !== 'confirmed' || !operation.record || returned.current) return;
    returned.current = true; refresh(operation.record); setAllowExit(true);
    AccessibilityInfo.announceForAccessibility(mode === 'edit' ? 'Changes saved.' : 'Note saved.');
  }, [operation?.status, operation?.record, refresh, mode]);
  useEffect(() => {
    if (departing.current || !allowExit || !returned.current || operation?.status !== 'confirmed' || !operation.record) return;
    const record = operation.record; noteSaves.forget(operation.submission.id);
    if (mode === 'edit') returnToSavedReader(router, navigation, returnContext, record.id);
    else {
      const readerContext = registerNoteContext({ actorId, bookId, origin: mode === 'create' ? 'collection' : context.origin,
        canBack: mode === 'create' ? operation.submission.origin === 'collection' : context.canBack });
      router.replace(readerHref(bookId, record.id, readerContext));
    }
  }, [allowExit, operation, mode, context.readerReturn, context.canBack, context.origin, actorId, bookId, router, navigation]);
  const save = (compared?: ManualNote) => {
    const validation = validateNote(fields); setShowErrors(true);
    if (!validation.valid || locked || departing.current || returned.current || !actorId) return;
    if (activeOperation && resumeFailed) noteSaves.forget(activeOperation);
    const id = randomUUID();
    // A re-entry context may lack the original reader key; keep the resolved destination with each edit attempt.
    const operationSessionId = mode === 'edit' ? registerNoteContext(returnContext) : sessionId;
    const operationKey = noteSaves.start({ id, actorId, bookId, noteId: mode === 'edit' ? targetNoteId! : randomUUID(), sessionId: operationSessionId, mode,
      origin: mode === 'edit' ? returnContext.origin : context.origin, content: validation.content, tag: fields.category, page_number: validation.pageNumber,
      expectedVersion: compared?.version ?? baseline?.version ?? originalVersion.current });
    setActiveOperation(operationKey); AccessibilityInfo.announceForAccessibility('Saving.');
  };
  const useSavedVersion = () => setDialog({ title: 'Use saved version?', message: 'Your unsaved changes will be discarded. The saved note will be read again.', keep: 'Keep editing', confirm: 'Use saved version', action: () => {
    setDialog(null);
    void loaded.refetch().then(result => {
      if (departing.current || previousActor.current !== actorId) return;
      if (result.isError || !result.data) { setFeedback("Couldn't load the saved version. Your changes are still here."); return; }
      if (activeOperation) noteSaves.forget(activeOperation); refresh(result.data); finishExit(returnToReader);
    });
  } });
  if (!actorId || !bookId || (!operation && !editorReady && (book.isError || (mode === 'edit' && (loaded.isError || (!loaded.isPending && !loaded.data)))))) {
    return <NoteScreen title="Note unavailable" backLabel="Back" onBack={exit}><View style={ui.content}><NoteMessage message="This book or note couldn't be opened." error /><NoteButton label="Try again" onPress={() => { void book.refetch(); if (mode === 'edit') void loaded.refetch(); }} /></View></NoteScreen>;
  }
  if (!operation && !editorReady) return <NoteScreen title={mode === 'edit' ? 'Edit note' : 'Add note'} backLabel="Back" onBack={exit}><NoteLoading /></NoteScreen>;
  if (operationId && activeOperation === operationId && !operation) return <NoteScreen title="Submission unavailable" bookTitle={book.data?.title} backLabel="Back to Notes" onBack={() => returnFromNote(router, context, navigation)}><View style={ui.content}><NoteMessage message="This submission is no longer in memory. Check Notes for any saved result. Its earlier outcome may not be recoverable." /></View></NoteScreen>;
  const compare = operation?.status === 'conflict' ? operation.compared : undefined;
  return <NoteScreen title={mode === 'edit' ? 'Edit note' : 'Add note'} bookTitle={book.data?.title} backLabel={locked ? 'Leave' : categoryOpen ? 'Back to editor' : step === 'write' && mode === 'create' ? 'Back to options' : 'Back'}
    onBack={() => {
      if (categoryOpen) { setCategoryOpen(false); inputRef.current?.focus(); }
      else if (step === 'write' && mode === 'create' && !locked) setStep('choose');
      else exit();
    }}
    footer={step === 'write' ? <>
      {operation?.status === 'saving' && <NoteMessage message="Saving…" />}
      {operation?.status === 'unknown' && <><NoteMessage message={operation.checking ? 'Checking save status…' : 'Save not confirmed. Your submitted text is retained while this app remains open.'} />
        <NoteButton label="Check status" secondary disabled={operation.checking} onPress={() => { void noteSaves.check(operation.submission.id); }} /></>}
      {!locked && !compare && <NoteButton label={mode === 'edit' ? 'Save changes' : 'Save note'} disabled={!fields.text.trim() || allowExit} onPress={() => save()} />}
      {mode === 'create' && !locked && <NoteButton label="Cancel note" secondary onPress={exit} />}
    </> : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
      {editorReady && (book.isError || (mode === 'edit' && loaded.isError)) && <>
        <NoteMessage message="Refresh failed. Your current text is still here." error />
        <NoteButton label="Retry refresh" secondary onPress={() => { void book.refetch(); if (mode === 'edit') void loaded.refetch(); }} />
      </>}
      {step === 'choose' ? <>
        <Text style={[ui.label, { color: colors.textPrimary }]}>Category (optional)</Text>
        <CategoryPicker selected={fields.category} onChange={category => setFields({ ...fields, category })} />
        <NoteButton label="Skip category" secondary onPress={() => setFields({ ...fields, category: null })} />
        <NoteButton label="Write note" onPress={() => setStep('write')} />
        <NoteButton label="Scan text" secondary disabled onPress={() => {}} />
        <NoteMessage message="Scanning will be available after the manual-note flow is verified." />
      </> : <>
        <NoteForm fields={fields} onChange={setFields} locked={locked} showErrors={showErrors} onCategory={() => setCategoryOpen(true)} inputRef={inputRef} />
        {!!feedback && <NoteMessage message={feedback} error />}
        {operation?.status === 'failed' && <NoteMessage message={operation.message ?? "This note wasn't saved. Your text is still here."} error />}
        {!!compare && <View style={{ gap: 12 }}>
          <NoteMessage message="The saved note changed. Your draft is still above." error />
          <Text accessibilityRole="header" style={[ui.label, { color: colors.textPrimary }]}>Latest saved version</Text>
          <Text selectable style={{ color: colors.textPrimary, fontSize: 17, lineHeight: 27 }}>{compare.content}</Text>
          <NoteMessage message={`Category: ${categoryLabel(compare.tag)}${compare.page_number === null ? '' : ` · Page ${compare.page_number}`}`} />
          <NoteButton label="Keep editing" secondary onPress={() => { noteSaves.forget(operation!.submission.id); setActiveOperation(undefined); inputRef.current?.focus(); }} />
          <NoteButton label="Use saved version" secondary onPress={useSavedVersion} />
          <NoteButton label="Replace saved version" onPress={() => setDialog({ title: 'Replace saved version?', message: 'Save your draft in place of the version shown here. If that version changes again, comparison will reopen.', keep: 'Keep editing', confirm: 'Replace saved version', action: () => { setDialog(null); save(compare); } })} />
        </View>}
      </>}
      {categoryOpen && <View style={{ gap: 12 }}><Text accessibilityRole="header" style={[ui.label, { color: colors.textPrimary }]}>Change category</Text>
        <CategoryPicker selected={fields.category} onChange={category => { setFields({ ...fields, category }); setCategoryOpen(false); inputRef.current?.focus(); }} />
        <NoteButton label="No category" secondary onPress={() => { setFields({ ...fields, category: null }); setCategoryOpen(false); inputRef.current?.focus(); }} />
        <NoteButton label="Close category choices" secondary onPress={() => { setCategoryOpen(false); inputRef.current?.focus(); }} /></View>}
    </ScrollView>
    <NoteDialog spec={dialog} onKeep={() => {
      browserHistoryGuard.current?.keepEditing(); restoreEditorFocus.current = true; setDialog(null);
      if (Platform.OS !== 'web') inputRef.current?.focus();
    }} onDismiss={() => {
      // Web Modal restores prior focus while unmounting its focus trap.
      if (restoreEditorFocus.current) { restoreEditorFocus.current = false; inputRef.current?.focus(); }
    }} />
  </NoteScreen>;
}
