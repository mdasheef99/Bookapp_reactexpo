import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { CategoryPicker, NoteButton, NoteDialog, NoteDialogSpec, NoteForm, NoteLoading, NoteMessage, NoteScreen, ScrollView, ui } from '@/components/notes/ManualNoteUi';
import { LIBRARY_SPACING, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { BookButton } from '@/components/library/ui';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { categoryLabel, fieldsChanged, ManualNote, noteFields, NoteFields, noteKeys, validateNote } from '@/features/books/notes/manualNoteContract';
import { manualNotesGateway, noteSaves } from '@/features/books/notes/manualNotesGateway';
import { noteRouteContext, readerHref, registerNoteContext, returnFromNote, returnToSavedReader, SwipeRouteParams } from '@/features/books/notes/noteNavigation';
import { useNoteContext, useNoteOperations, useNoteRefresh } from '@/features/books/notes/useManualNotes';
import { ComposerHistoryGuard, guardComposerHistory } from '@/features/books/notes/composerBrowserHistory';
import { NoteCrop } from '@/components/notes/NoteCrop';
import { createCaptureAdapter, onDeviceAvailability } from '@/features/books/notes/captureAdapter';
import { NoteCaptureSession } from '@/features/books/notes/captureSession';

export default function NoteComposeScreen() {
  const params = useLocalSearchParams() as unknown as SwipeRouteParams & { bookId: string; noteId?: string; contextId?: string; operationId?: string };
  const { bookId = '', noteId, contextId, operationId } = params;
  const router = useRouter(); const navigation = useNavigation(); const colors = useLibraryAppearance();
  const { actorId, book } = useNoteContext(bookId); const refresh = useNoteRefresh(actorId, bookId);
  const context = noteRouteContext(contextId, actorId, bookId, params);
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
  const editNoteId = mode === 'edit' ? targetNoteId : undefined;
  const sessionId = useRef(contextId ?? randomUUID()).current;
  const capture = useMemo(() => new NoteCaptureSession({ actorId, bookId, mode, noteId: editNoteId }, createCaptureAdapter(), noteId || operationId ? 'write' : 'choose'), [actorId, bookId, mode, editNoteId]);
  const captureState = useSyncExternalStore(capture.subscribe, capture.snapshot, capture.snapshot);
  const { fields, baseline, step } = captureState;
  const setFields = capture.setFields;
  const setStep = (next: 'choose' | 'write') => capture.setStep(next);
  const scanStep = ['intake', 'crop', 'no-text', 'failure'].includes(step);
  const formStep = step === 'write' || step === 'review';
  const availability = onDeviceAvailability();
  useEffect(() => capture.mount(), [capture]);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const showErrors = saveAttempt > 0;
  const { isOffline } = useNetworkStatus();
  const offlineRef = useRef(isOffline);
  offlineRef.current = isOffline;
  const [dialog, setDialog] = useState<NoteDialogSpec | null>(null);
  const [feedback, setFeedback] = useState('');
  const [allowExit, setAllowExit] = useState(false);
  const departing = useRef(false);
  const approvedExit = useRef<(() => void) | null>(null);
  const browserHistoryGuard = useRef<ComposerHistoryGuard | null>(null);
  const finishExit = useCallback((action: () => void) => { departing.current = true; approvedExit.current = action; setAllowExit(true); }, []);
  useEffect(() => { if (allowExit && approvedExit.current) { const action = approvedExit.current; approvedExit.current = null; action(); } }, [allowExit]);
  const inputRef = useRef<TextInput>(null); const pageRef = useRef<TextInput>(null); const scrollRef = useRef<ScrollView>(null);
  const initialized = useRef(false); const returned = useRef(false);
  const restoreEditorFocus = useRef(false);
  const originalVersion = useRef<number | undefined>(undefined);
  const previousActor = useRef(actorId);
  const scope = `${actorId}\u0000${bookId}\u0000${mode}\u0000${editNoteId ?? ''}`;
  const previousScope = useRef(scope);
  useEffect(() => {
    if (previousScope.current === scope) return;
    initialized.current = false; originalVersion.current = undefined;
    capture.initialize(noteFields()); setActiveOperation(undefined); setDialog(null); setFeedback('');
    returned.current = false; departing.current = false; setAllowExit(false);
    previousActor.current = actorId; previousScope.current = scope;
  }, [actorId, scope, capture]);
  const loaded = useQuery({ queryKey: noteKeys.record(actorId, bookId, targetNoteId ?? ''),
    queryFn: ({ signal }) => manualNotesGateway.record(actorId, bookId, targetNoteId!, signal), enabled: !!actorId && !!book.data && mode === 'edit' && !!targetNoteId });
  useEffect(() => {
    if (initialized.current) return;
    if (operation) {
      originalVersion.current = operation.submission.expectedVersion;
      capture.initialize({ text: operation.submission.content, category: operation.submission.tag, page: operation.submission.page_number?.toString() ?? '' }, loaded.data ? { ...loaded.data, version: operation.submission.expectedVersion } : undefined);
      initialized.current = true;
    } else if (mode === 'edit' && loaded.data) { originalVersion.current = loaded.data.version; capture.initialize(noteFields(loaded.data), loaded.data); initialized.current = true; }
    else if (mode === 'create' && book.data) { capture.initialize(noteFields()); initialized.current = true; }
  }, [operation, loaded.data, book.data, mode, actorId, capture]);
  const editorReady = initialized.current && previousScope.current === scope;
  const locked = !!operation && ['saving', 'unknown'].includes(operation.status);
  const dirty = mode === 'edit' ? fieldsChanged(fields, baseline) : !!fields.text.trim() || !!fields.page.trim();
  const resumeFailed = operation && ['failed', 'conflict'].includes(operation.status);
  const leave = useCallback((action: () => void) => {
    if (operation?.status === 'confirmed') { finishExit(action); return; }
    if (locked) {
      setDialog({ title: 'Save not confirmed', message: "We couldn't confirm whether your note or changes were saved. Leaving won't cancel the request. Text in this editor may be lost after restarting. If saving succeeds, find the note in this book's Notes.",
        keep: 'Stay here', confirm: 'Leave', action: () => { setDialog(null); finishExit(action); } }); return;
    }
    if (dirty || capture.meaningfulCapture) {
      setDialog({ title: mode === 'edit' ? 'Discard changes?' : 'Discard this note?', message: (mode === 'edit' ? "Your changes haven't been saved." : "Your note hasn't been saved.") + (capture.meaningfulCapture ? ' The selected photo and crop will also be lost.' : ''),
        keep: 'Keep editing', confirm: mode === 'edit' ? 'Discard changes' : 'Discard note', confirmVariant: 'destructive', action: () => {
          if (activeOperation) noteSaves.forget(activeOperation); setDialog(null); finishExit(action);
        } }); return;
    }
    finishExit(action);
  }, [operation?.status, locked, dirty, mode, activeOperation, finishExit, capture, captureState]);
  const browserExit = useRef({ protect: false, leave });
  browserExit.current = { protect: !allowExit && !departing.current && (dirty || locked || capture.meaningfulCapture), leave };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const guard = guardComposerHistory(window,
      () => browserExit.current.protect && navigation.isFocused(),
      action => browserExit.current.leave(action));
    browserHistoryGuard.current = guard;
    return () => { guard.dispose(); browserHistoryGuard.current = null; };
  }, [navigation]);
  const cancelScan = (writeInstead = false) => {
    const restore = () => { setDialog(null); capture.cancelScan(writeInstead); };
    if (capture.meaningfulCapture) setDialog({ title: 'Discard this scan?', message: 'Your selected photo, crop adjustments and text from this attempt will be lost. Return to the note before this scan.', keep: 'Keep scanning', confirm: 'Discard scan', confirmVariant: 'destructive', action: restore });
    else restore();
  };
  const retainedBack = () => {
    if (captureState.busy === 'recognizing' || captureState.busy === 'detecting') { capture.cancelRecognition(); return true; }
    if (step === 'review') { capture.returnToCrop(); return true; }
    if (step === 'crop') { capture.setStep('intake'); return true; }
    if (scanStep) { cancelScan(); return true; }
    return false;
  };
  usePreventRemove(!allowExit && (dirty || locked || capture.meaningfulCapture || !!captureState.checkpoint || (step === 'write' && mode === 'create')), ({ data }) => {
    if (dialog || captureState.warningOpen) { browserHistoryGuard.current?.keepEditing(); setDialog(null); capture.keepPartialEditing(); }
    else if (retainedBack()) return;
    else if (step === 'write' && mode === 'create' && !locked) setStep('choose');
    else leave(() => navigation.dispatch(data.action));
  });
  const returnToReader = () => returnToSavedReader(router, navigation, returnContext, targetNoteId!);
  const exit = () => leave(() => mode === 'edit' ? returnToReader() : returnFromNote(router, context, navigation));
  const startScan = () => {
    const begin = () => { setDialog(null); setSaveAttempt(0); setFeedback(''); capture.beginScan(); };
    if (fields.text.trim()) setDialog({ title: 'Replace text with a scan?', message: 'A new scan replaces the current text. Canceling this attempt returns to this note.', keep: 'Keep editing', confirm: step === 'review' ? 'Scan again' : 'Scan text', action: begin });
    else begin();
  };
  useEffect(() => { if (step === 'write' && !locked && !operationId) inputRef.current?.focus(); }, [step, locked, operationId]);
  useEffect(() => {
    if (!formStep || !captureState.restorePosition) return;
    const restore = () => {
      scrollRef.current?.scrollTo({ y: captureState.position.scroll, animated: false });
      if (captureState.position.focus === 'page') pageRef.current?.focus();
      else if (captureState.position.focus === 'text') inputRef.current?.focus();
    };
    const frame = requestAnimationFrame(restore); return () => cancelAnimationFrame(frame);
  }, [captureState.restorePosition, formStep, capture]);
  useEffect(() => {
    if (departing.current || operation?.status !== 'confirmed' || !operation.record || returned.current) return;
    returned.current = true; refresh(operation.record); setAllowExit(true);
    AccessibilityInfo.announceForAccessibility(mode === 'edit' ? 'Changes saved.' : 'Note saved.');
  }, [operation?.status, operation?.record, refresh, mode]);
  useEffect(() => {
    if (departing.current || !allowExit || !returned.current || operation?.status !== 'confirmed' || !operation.record) return;
    const record = operation.record; noteSaves.forget(operation.submission.id);
    if (mode === 'edit') returnToSavedReader(router, navigation, returnContext, record.id, { justSaved: true });
    else {
      const readerContext = registerNoteContext({ actorId, bookId, origin: mode === 'create' ? 'list' : context.origin,
        canBack: mode === 'create' ? operation.submission.origin === 'list' : context.canBack });
      router.replace(readerHref(bookId, record.id, readerContext, true));
    }
  }, [allowExit, operation, mode, context.readerReturn, context.canBack, context.origin, actorId, bookId, router, navigation]);
  const save = (compared?: ManualNote) => {
    if (offlineRef.current) return;
    if (capture.partialUnaccepted) { capture.openPartialWarning(); return; }
    const validation = validateNote(fields); setSaveAttempt(attempt => attempt + 1);
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
  const scanOriginLabel = captureState.checkpoint?.step === 'review' ? 'Back to review' : mode === 'edit' ? 'Back to edit' : captureState.checkpoint?.step === 'choose' ? 'Back to options' : 'Back to note';
  const title = step === 'review' ? 'Review scanned text' : step === 'intake' ? 'Scan text' : step === 'crop' ? 'Prepare photo' : step === 'no-text' ? 'No text found' : step === 'failure' ? "Couldn't read this page" : mode === 'edit' ? 'Edit note' : 'Add note';
  const partialDialog: NoteDialogSpec | null = captureState.warningOpen ? {
    title: 'Some text may be missing', message: 'This page had more text than one scan can hold, so the end may be cut off. Check the text before you use it.',
    keep: 'Keep editing', confirm: 'Use this text', action: () => capture.acceptPartial(),
  } : null;
  return <NoteScreen scrollChrome={scanStep} title={title} bookTitle={book.data?.title} backLabel={locked ? 'Leave' : captureState.busy === 'detecting' ? 'Cancel reading' : captureState.busy === 'recognizing' ? 'Cancel reading' : step === 'review' ? 'Back to photo' : step === 'crop' ? 'Back to scan' : scanStep ? scanOriginLabel : step === 'write' && mode === 'create' ? 'Back to options' : 'Back'}
    onBack={() => {
      if (retainedBack()) return;
      else if (step === 'write' && mode === 'create' && !locked) setStep('choose');
      else exit();
    }}
    footer={formStep ? <>
      {operation?.status === 'saving' && <NoteMessage message="Saving…" />}
      {operation?.status === 'unknown' && <><NoteMessage message={operation.checking ? 'Checking save status…' : 'Save not confirmed. Your submitted text is retained while this app remains open.'} />
        <NoteButton label="Check status" secondary disabled={operation.checking} onPress={() => { void noteSaves.check(operation.submission.id); }} /></>}
      {!locked && !compare && isOffline && <NoteMessage message="Saving needs a connection. Your text stays here." caption />}
      {!locked && !compare && <NoteButton label={mode === 'edit' ? 'Save changes' : 'Save note'} disabled={!fields.text.trim() || allowExit || isOffline} onPress={() => save()} />}
      {step === 'review' && !!captureState.checkpoint && !capture.firstScan && !locked ? <NoteButton label="Cancel scan" variant="text" onPress={() => cancelScan()} /> : mode === 'create' && !locked && <BookButton label="Cancel note" variant="text" onPress={exit} />}
    </> : step === 'crop' ? <>
      {captureState.busy === 'detecting' ? <><NoteMessage message="Finding the printed text…" caption /><NoteButton label="Cancel reading" onPress={() => capture.cancelRecognition()} /></>
        : captureState.busy === 'recognizing' ? <><NoteMessage message="Reading the text…" caption /><NoteButton label="Cancel reading" onPress={() => capture.cancelRecognition()} /></>
        : availability.available ? <NoteButton label="Read text" disabled={!!captureState.busy} onPress={() => { void capture.recognize(); }} />
        : <NoteButton label={capture.firstScan ? 'Write note instead' : scanOriginLabel} onPress={() => cancelScan(capture.firstScan)} />}
      {captureState.busy !== 'detecting' && captureState.busy !== 'recognizing' && <NoteButton label="Cancel scan" variant="text" onPress={() => cancelScan()} />}
    </> : undefined}>
    {(header, footer) => <>
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={formStep || scanStep ? { flexGrow: 1 } : undefined} scrollEventThrottle={32}
      onScroll={event => { if (formStep) capture.setPosition({ scroll: event.nativeEvent.contentOffset.y }); }}>
      {header}
      <View style={[ui.content, (formStep || scanStep) && { flexGrow: 1 }]}>
      {editorReady && (book.isError || (mode === 'edit' && loaded.isError)) && <>
        <NoteMessage message="Refresh failed. Your current text is still here." error />
        <NoteButton label="Retry refresh" secondary onPress={() => { void book.refetch(); if (mode === 'edit') void loaded.refetch(); }} />
      </>}
      {step === 'choose' ? <>
        <Text style={[ui.label, { color: colors.textPrimary }]}>Category (optional)</Text>
        <CategoryPicker selected={fields.category} includeNone onChange={category => setFields({ ...fields, category })} />
        {/* DP-03 approved exception: Write and Scan are the two equal ways in. */}
        <NoteButton label="Write note" onPress={() => setStep('write')} />
        {Platform.OS !== 'web' && <NoteButton label="Scan text" onPress={startScan} />}
      </> : formStep ? <>
        <NoteForm fields={fields} onChange={setFields} locked={locked} showErrors={showErrors} saveAttempt={saveAttempt} inputRef={inputRef} pageRef={pageRef}
          onFocusField={focus => capture.setPosition({ focus })} onSelectionChange={selection => capture.setPosition({ selection })} selection={captureState.position.selection} />
        {step === 'review' && <NoteMessage message={`Check the scanned text and fix any mistakes. Nothing is saved until you choose ${mode === 'edit' ? 'Save changes' : 'Save note'}.`} />}
        {/* DP-04: a possibly cut-off scan is a caution, not an error, so it uses secondary ink. */}
        {!!captureState.partial && <NoteMessage message={capture.partialUnaccepted ? 'Some text may be missing from this scan. Save will ask you to check it first.' : 'You chose to use this scan. Check that nothing is missing before saving.'} />}
        {!locked && Platform.OS !== 'web' && <NoteButton label={step === 'review' ? 'Scan again' : 'Scan text'} secondary onPress={startScan} />}
        {!!feedback && <NoteMessage message={feedback} error />}
        {operation?.status === 'failed' && <NoteMessage message={operation.message ?? "This note wasn't saved. Your text is still here."} error />}
        {!!compare && <View style={{ gap: LIBRARY_SPACING.sm }}>
          <NoteMessage message="The saved note changed. Your draft is still above." error />
          <Text accessibilityRole="header" style={[ui.label, { color: colors.textPrimary }]}>Latest saved version</Text>
          <Text selectable style={[LIBRARY_TEXT.bodySerif, { color: colors.textPrimary }]}>{compare.content}</Text>
          <NoteMessage message={`Category: ${categoryLabel(compare.tag)}${compare.page_number === null ? '' : ` · Page ${compare.page_number}`}`} />
          <NoteButton label="Keep editing" secondary onPress={() => { noteSaves.forget(operation!.submission.id); setActiveOperation(undefined); inputRef.current?.focus(); }} />
          <NoteButton label="Use saved version" secondary onPress={useSavedVersion} />
          {isOffline && <NoteMessage message="Saving needs a connection. Your text stays here." caption />}
          <NoteButton label="Replace saved version" disabled={isOffline} onPress={() => setDialog({ title: 'Replace saved version?', message: 'Save your draft in place of the version shown here. If that version changes again, comparison will reopen.', keep: 'Keep editing', confirm: 'Replace saved version', action: () => { if (offlineRef.current) return; setDialog(null); save(compare); } })} />
        </View>}
      </> : <>
        <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Category: {categoryLabel(fields.category)}</Text>
        {/* SDD-07 D07-19: where a photo can't be read, offer the way back instead of a photo path that ends nowhere. */}
        {step === 'intake' && !availability.available && <>
          <NoteMessage message={availability.message} />
          <NoteButton label={capture.firstScan ? 'Write note instead' : scanOriginLabel} onPress={() => cancelScan(capture.firstScan)} />
        </>}
        {step === 'intake' && availability.available && <>
          <NoteMessage message="Take a clear photo of a printed page, or choose one from this device." />
          <NoteButton label="Take photo" disabled={!!captureState.busy} onPress={() => { void capture.pick('camera'); }} />
          <NoteButton label="Choose photo" secondary disabled={!!captureState.busy} onPress={() => { void capture.pick('gallery'); }} />
          {captureState.photo && <NoteButton label="Continue with this photo" secondary disabled={!!captureState.busy} onPress={() => capture.setStep('crop')} />}
          {capture.firstScan && <NoteButton label="Write note instead" variant="text" disabled={!!captureState.busy} onPress={() => cancelScan(true)} />}
        </>}
        {step === 'crop' && captureState.photo && <>
          <NoteCrop photo={captureState.photo} crop={captureState.crop} disabled={!!captureState.busy} cropMode={captureState.cropMode} autoDetected={!!captureState.autoCrop}
            cropNotice={captureState.cropNotice} onChange={crop => capture.setCrop(crop)} onReset={() => capture.resetCrop()} />
          <NoteButton label="Rotate photo" secondary disabled={!!captureState.busy} onPress={() => { void capture.rotate(); }} />
          <NoteButton label="Choose another photo" secondary disabled={!!captureState.busy} onPress={() => { void capture.pick('gallery'); }} />
        </>}
        {step === 'no-text' && <>
          <NoteMessage message="No printed text was found. Try a sharper, well-lit photo of printed English text." />
          <NoteButton label={captureState.photo ? 'Adjust photo' : 'Choose another photo'} onPress={() => captureState.photo ? capture.setStep('crop') : void capture.pick('gallery')} />
          {capture.firstScan && <NoteButton label="Write note instead" variant="text" onPress={() => cancelScan(true)} />}
        </>}
        {step === 'failure' && <>
          <NoteMessage message={captureState.error?.message ?? "This page couldn't be read. Your earlier text is still here."} error />
          {captureState.error?.engine ? <NoteButton label={capture.firstScan ? 'Write note instead' : scanOriginLabel} onPress={() => cancelScan(capture.firstScan)} /> : <>
            <NoteButton label="Choose another photo" disabled={!!captureState.busy} onPress={() => { void capture.pick('gallery'); }} />
            {capture.firstScan && <NoteButton label="Write note instead" variant="text" onPress={() => cancelScan(true)} />}
          </>}
        </>}
        {((step === 'intake' && availability.available) || step === 'crop') && <NoteMessage message={availability.message} />}
        {captureState.busy === 'picking' && <NoteMessage message="Opening photos…" caption />}
        {captureState.busy === 'rotating' && <NoteMessage message="Rotating the photo…" caption />}
        {captureState.busy === 'recognizing' && <NoteMessage message="If you cancel, this result won't be used." />}
        {step !== 'failure' && !!captureState.error && <NoteMessage message={captureState.error.message} error />}
      </>}
      </View>
      {footer}
    </ScrollView>
    <NoteDialog spec={partialDialog ?? dialog} confirmDisabled={isOffline && dialog?.confirm === 'Replace saved version'} onKeep={() => {
      browserHistoryGuard.current?.keepEditing(); restoreEditorFocus.current = formStep; setDialog(null); capture.keepPartialEditing();
      if (Platform.OS !== 'web' && formStep) inputRef.current?.focus();
    }} onDismiss={() => {
      // Web Modal restores prior focus while unmounting its focus trap.
      if (restoreEditorFocus.current) { restoreEditorFocus.current = false; inputRef.current?.focus(); }
    }} />
    </>}
  </NoteScreen>;
}
