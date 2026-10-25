import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { DIALOG_MAX_WIDTH } from '../bookDetails/bookDetailsTokens';
import { BookButton, BookFeedbackSlot, useBookFeedback } from '../ui';
import { captureOrganisingActor, ORGANISING_LIMIT, OrganisingEntity, OrganisingError, OrganisingKind, validateOrganisingName } from '@/features/books/organising/organisingGateway';
import { useOrganising } from '@/features/books/organising/useOrganising';

type Step = 'pick' | 'manage' | 'new' | 'rename' | 'delete' | 'discard' | 'partial' | 'uncertain';
export interface OrganisingSheetProps {
  actor: string; kind: OrganisingKind; mode: 'membership' | 'filter' | 'manage'; target?: string;
  selectedId?: string; onSelect?: (id: string) => void; onClose: () => void; onChanged?: () => void;
  initialStep?: 'new' | 'rename' | 'delete'; original?: OrganisingEntity;
  returnFocusRef?: React.RefObject<View | null>;
  fallbackFocusRef?: React.RefObject<View | null>;
}
export function OrganisingSheet({ actor, kind, mode, target, selectedId, onSelect, onClose, onChanged, initialStep, original, returnFocusRef, fallbackFocusRef }: OrganisingSheetProps) {
  return <OrganisingSheetSession key={JSON.stringify([actor, kind, mode, target, original?.id])} {...{ actor, kind, mode, target, selectedId, onSelect, onClose, onChanged, initialStep, original, returnFocusRef, fallbackFocusRef }} />;
}
function OrganisingSheetSession({ actor, kind, mode, target, selectedId, onSelect, onClose, onChanged, initialStep, original, returnFocusRef, fallbackFocusRef }: OrganisingSheetProps) {
  const colors = useLibraryAppearance(), { notify } = useBookFeedback();
  const api = useOrganising(actor, kind, mode === 'membership');
  const noun = kind === 'labels' ? 'label' : 'collection';
  const [step, setStep] = useState<Step>(initialStep ?? (mode === 'manage' ? 'manage' : 'pick'));
  const [editing, setEditing] = useState(original);
  const [draft, setDraft] = useState(initialStep === 'rename' ? original?.name ?? '' : '');
  const [fieldError, setFieldError] = useState('');
  const [message, setMessage] = useState('');
  const nameError = useRef(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<OrganisingEntity>();
  const [deleted, setDeleted] = useState(false);
  const [focusedChoice, setFocusedChoice] = useState('');
  const choiceRefs = useRef<Record<string, View | null>>({});
  const resume = useRef<Step>('pick'), discardAction = useRef<() => void>(() => {});
  const mounted = useRef(true), submitted = useRef(false), inFlight = useRef(false);
  const closeRef = useRef<View>(null), fieldRef = useRef<TextInput>(null);
  const [keyboardPad, setKeyboardPad] = useState(0);
  const panelLayout = useRef({ y: 0, height: 0 });
  useEffect(() => {
    // iOS only: lift the centered dialog's content above the software keyboard
    // so the name field stays visible. KeyboardAvoidingView's own offset is
    // disabled below to avoid shifting twice.
    if (Platform.OS !== 'ios') return;
    const subscription = Keyboard.addListener('keyboardWillChangeFrame', event => {
      setKeyboardPad(Math.max(0, event.endCoordinates.height));
    });
    return () => subscription.remove();
  }, []);
  const identity = `${actor}:${kind}:${target ?? ''}`, currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const entities = [...(api.entities.data ?? [])].sort(kind === 'labels'
    ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  const capped = entities.length >= ORGANISING_LIMIT;
  const deleteCount = editing && api.members.data ? api.members.data.filter(row => row.entity_id === editing.id).length : undefined;
  const dataReady = api.entities.data !== undefined && (mode !== 'membership' || api.members.data !== undefined);
  const dirty = (step === 'new' || step === 'rename') && draft !== (step === 'rename' ? editing?.name ?? '' : '');
  const close = useCallback(() => onClose(), [onClose]);
  const transition = (action: () => void) => {
    if (step === 'discard') { setStep(resume.current); return; }
    if (dirty && !submitted.current) { resume.current = step; discardAction.current = action; setStep('discard'); }
    else action();
  };
  const back = () => transition(() => {
    if (initialStep || step === 'pick' || (mode === 'manage' && step === 'manage')) close();
    else { setStep(step === 'rename' || step === 'delete' ? 'manage' : 'pick'); setFieldError(''); setMessage(''); }
  });
  useEffect(() => {
    mounted.current = true;
    const native = Platform.OS !== 'web';
    const previous = Platform.OS === 'web' && typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null;
    return () => {
      mounted.current = false;
      if (!previous && !returnFocusRef?.current && !fallbackFocusRef?.current) return;
      requestAnimationFrame(() => {
        const trigger = returnFocusRef?.current ?? fallbackFocusRef?.current;
        if (!native && trigger) trigger.focus();
        else if (previous?.isConnected) previous.focus();
        else if (native && trigger) {
          const node = findNodeHandle(trigger);
          if (node) AccessibilityInfo.setAccessibilityFocus(node);
        }
      });
    };
  }, [returnFocusRef, fallbackFocusRef]);
  useEffect(() => { if (step === 'new' || step === 'rename') fieldRef.current?.focus(); }, [step]);
  const alive = (guard: () => void) => {
    try { guard(); return mounted.current && currentIdentity.current === identity; } catch { return false; }
  };
  const perform = async (work: () => Promise<void>) => {
    if (inFlight.current || api.isOffline) return;
    let guard: () => void;
    try { guard = captureOrganisingActor(actor); guard(); } catch { return; }
    inFlight.current = true; submitted.current = true; setBusy(true); setMessage(''); nameError.current = false;
    try { await work(); }
    catch (error) {
      if (alive(guard)) {
        const text = error instanceof Error ? error.message : `Couldn't save this ${noun}. Try again.`;
        nameError.current = error instanceof OrganisingError && (error.kind === 'duplicate' || error.kind === 'invalid');
        setMessage(text); notify({ kind: 'error', message: text, action: { label: 'Try again', onPress: () => { if (mounted.current) api.refresh(); } } });
        if (error instanceof OrganisingError && (error.kind === 'conflict' || error.kind === 'missing' || error.kind === 'unknown')) {
          if (error.current) setEditing(error.current);
          if (error.kind === 'missing' && step === 'rename') setDeleted(true);
          api.refresh();
        }
      }
    } finally { inFlight.current = false; submitted.current = false; if (alive(guard)) setBusy(false); }
  };
  const announce = (text: string) => { if (mounted.current && currentIdentity.current === identity) notify({ kind: 'success', message: text }); };
  const attach = async (saved: OrganisingEntity) => {
    if (!target) return;
    await api.membership(target, saved.id, true);
    if (!mounted.current || currentIdentity.current !== identity) return;
    if (kind === 'collections') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    announce(`Added to ${saved.name}`); onChanged?.(); setStep('pick'); setCreated(undefined); setDraft('');
  };
  const save = (input = draft) => {
    const validated = validateOrganisingName(input, kind);
    if (validated.error) { setFieldError(validated.error); return; }
    void perform(async () => {
      if (step === 'rename' && editing) {
        await api.rename(editing, validated.name);
        if (mounted.current && currentIdentity.current === identity) { announce('Name saved'); if (initialStep) close(); else { setStep('manage'); setDraft(''); } }
      } else {
        let saved: OrganisingEntity;
        try { saved = await api.create(validated.name); }
        catch (error) {
          if (mounted.current && error instanceof OrganisingError && error.kind === 'unknown') { setStep('uncertain'); api.refresh(); }
          throw error;
        }
        if (!target) { announce('Collection created'); if (mounted.current) close(); return; }
        if (mounted.current) setCreated(saved);
        try { await attach(saved); }
        catch (error) {
          if (error instanceof OrganisingError && error.kind === 'identity') throw error;
          if (mounted.current && currentIdentity.current === identity) {
            const partial = `Created ${noun} “${saved.name}”, but attachment was not confirmed. Retry attachment without creating it again.`;
            setStep('partial'); setMessage(partial);
            notify({ kind: 'error', message: partial, action: { label: 'Try again', onPress: () => { if (mounted.current && currentIdentity.current === identity) void perform(() => attach(saved)); } } });
          }
          // The partial step explains the known create separately from its missing link.
        }
      }
    });
  };
  const choose = (item: OrganisingEntity) => {
    if (busy || !dataReady || (mode !== 'filter' && api.isOffline)) return;
    if (mode === 'filter') { onSelect?.(item.id); close(); return; }
    if (!target) return;
    const present = (api.members.data ?? []).some(row => row.entity_id === item.id && row.target_id === target);
    void perform(async () => {
      await api.membership(target, item.id, !present);
      if (kind === 'collections' && !present && mounted.current && currentIdentity.current === identity) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      announce(`${present ? 'Removed from' : 'Added to'} ${item.name}`);
      if (mounted.current && currentIdentity.current === identity) onChanged?.();
    });
  };
  const start = (next: 'new' | 'rename' | 'delete', item?: OrganisingEntity) => { setEditing(item); setDeleted(false); setDraft(next === 'rename' ? item?.name ?? '' : ''); setFieldError(''); setMessage(''); setStep(next); };
  const title = step === 'discard' ? 'Discard changes?' : step === 'new' ? `New ${noun}` : step === 'rename' ? `Rename ${noun}` : step === 'delete' ? `Delete ${noun}` : step === 'manage' ? `Manage ${kind}` : step === 'partial' ? 'Attachment not completed' : step === 'uncertain' ? 'Check the result' : kind === 'labels' ? 'Labels' : 'Add to collection';
  const textStyle = [LIBRARY_TEXT.body, { color: colors.textPrimary }];
  const creation = <BookButton label={`New ${noun}`} variant="text" disabled={busy || api.isOffline || capped || !dataReady} onPress={() => start('new')} />;
  const picker = <>
    {kind === 'collections' && creation}
    <View accessibilityRole={mode === 'filter' ? 'radiogroup' : undefined} accessibilityLabel={mode === 'filter' ? 'Filter books by label' : undefined}>{entities.map((item, index) => {
      const checked = mode === 'filter' ? selectedId === item.id : (api.members.data ?? []).some(row => row.entity_id === item.id && row.target_id === target);
      const tabChoice = entities.some(row => row.id === focusedChoice) ? focusedChoice : selectedId || entities[0]?.id;
      return <Pressable key={item.id} ref={node => { choiceRefs.current[item.id] = node; }} onFocus={() => setFocusedChoice(item.id)} accessibilityRole={mode === 'filter' ? 'radio' : 'checkbox'} aria-checked={checked} accessibilityState={{ checked, disabled: busy || (mode !== 'filter' && api.isOffline) || !dataReady }}
        tabIndex={mode === 'filter' ? tabChoice === item.id ? 0 : -1 : 0}
        accessibilityLabel={mode === 'filter' ? `Filter by ${item.name}` : item.name} disabled={busy || (mode !== 'filter' && api.isOffline) || !dataReady}
        {...(Platform.OS === 'web' ? { onKeyDown: (event: { key: string; preventDefault: () => void }) => {
          if (event.key === ' ') { event.preventDefault(); choose(item); }
          else if (mode === 'filter' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
            event.preventDefault();
            const next = entities[(index + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : entities.length - 1)) % entities.length];
            setFocusedChoice(next.id); choiceRefs.current[next.id]?.focus();
          }
        } } : {})}
        onPress={() => choose(item)} style={styles.choice}><Text style={textStyle}>{checked ? '✓ ' : ''}{item.name}</Text></Pressable>;
    })}</View>
    {kind === 'labels' && <>
      {mode === 'membership' && !api.suggestions?.isError && api.suggestions?.data?.map(name => <BookButton key={name} label={`Use ${name}`} variant="text" disabled={busy || capped || api.isOffline || !dataReady} onPress={() => {
        setDraft(name); save(name);
      }} />)}
      {api.suggestions?.isError && <BookButton label="Try suggestions again" variant="text" disabled={api.isOffline} onPress={api.refresh} />}
      {mode === 'membership' && creation}
      <BookButton label="Manage" variant="text" disabled={busy} onPress={() => setStep('manage')} />
    </>}
  </>;
  return <Modal visible transparent animationType="none" role="dialog" aria-modal accessibilityLabel={title} onRequestClose={back}
    onShow={() => {
      if (Platform.OS === 'web') closeRef.current?.focus();
      else { const node = findNodeHandle(closeRef.current); if (node) AccessibilityInfo.setAccessibilityFocus(node); }
    }}>
    <GestureHandlerRootView style={styles.root}>
      <Pressable testID="organising-backdrop" accessible={false} tabIndex={-1} onPress={() => transition(close)} style={[styles.scrim, { backgroundColor: colors.overlay }]}>
        <Pressable accessible={false} focusable={false} tabIndex={-1} accessibilityViewIsModal onPress={event => event.stopPropagation()}
          {...(Platform.OS === 'web' ? { onKeyDownCapture: (event: React.KeyboardEvent<HTMLElement>) => {
            if (event.key !== 'Tab') return;
            const panel = event.currentTarget;
            const controls = Array.from(panel.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]'))
              .filter(node => node.tabIndex >= 0 && !node.hasAttribute('disabled') && node.getAttribute('aria-disabled') !== 'true' && !node.closest('[hidden], [aria-hidden="true"], [inert]'));
            const first = controls[0], last = controls[controls.length - 1];
            const active = panel.ownerDocument.activeElement;
            if (first && (event.shiftKey ? active === first : active === last)) {
              event.preventDefault(); (event.shiftKey ? last : first).focus();
            }
          } } : {})}
          style={[styles.dialog, { backgroundColor: colors.bgRaised }]}>
          <KeyboardAvoidingView enabled={false} onLayout={event => { panelLayout.current = { y: event.nativeEvent.layout.y, height: event.nativeEvent.layout.height }; }} style={{ paddingBottom: keyboardPad }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <BookButton ref={closeRef} label="Back" accessibilityLabel={`Back in ${kind}`} variant="text" onPress={back} />
            <Text accessibilityRole="header" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>{title}</Text>
            {api.isOffline && <Text accessibilityLiveRegion="polite" style={textStyle}>You&apos;re offline.</Text>}
            {!!message && <Text style={textStyle}>{message}</Text>}
            {busy && <Text accessibilityLiveRegion="polite" style={textStyle}>Saving…</Text>}
            {step === 'discard' ? <>
              <Text style={textStyle}>Your unsaved name will be discarded.</Text>
              <BookButton label="Keep editing" variant="text" onPress={() => setStep(resume.current)} />
              <BookButton label="Discard changes" variant="destructive" onPress={() => { setDraft(''); discardAction.current(); }} />
            </> : step === 'new' || step === 'rename' ? <>
              <TextInput ref={fieldRef} accessibilityLabel={kind === 'labels' ? 'Label name' : 'Collection name'} value={draft} onChangeText={value => {
                if (value !== draft && nameError.current) { setMessage(''); nameError.current = false; }
                setDraft(value); setFieldError('');
              }} editable={!busy && !api.isOffline}
                style={[LIBRARY_TEXT.body, styles.input, { color: colors.textPrimary, borderColor: colors.controlBorder }]} />
              <Text style={textStyle}>{[...draft.trim()].length} / {kind === 'labels' ? 24 : 40} characters</Text>
              {!!fieldError && <Text accessibilityRole="alert" style={[LIBRARY_TEXT.body, { color: colors.error }]}>{fieldError}</Text>}
              <BookButton label={step === 'rename' ? 'Save name' : target ? kind === 'labels' ? 'Add label' : 'Create and add' : 'Create collection'} variant="primary" disabled={busy || deleted || api.isOffline || (step === 'new' && capped)} onPress={() => save()} />
            </> : step === 'delete' && editing ? <>
              <Text style={textStyle}>Delete “{editing.name}”?</Text>
              <Text style={textStyle}>{kind === 'collections' ? 'Only the collection is deleted. Your notes will be kept.' : deleteCount === undefined ? 'It will be removed from every book using it.' : `It will be removed from ${deleteCount} ${deleteCount === 1 ? 'book' : 'books'}.`}</Text>
              <BookButton label="Cancel" variant="text" onPress={back} />
              <BookButton label="Delete" variant="destructive" disabled={busy || api.isOffline} onPress={() => { void perform(async () => {
                await api.remove(editing.id); announce(`${kind === 'labels' ? 'Label' : 'Collection'} deleted`);
                if (mounted.current && currentIdentity.current === identity) { if (initialStep) close(); else setStep('manage'); }
              }); }} />
            </> : step === 'partial' ? <>
              <BookButton label="Retry attachment" variant="text" disabled={busy || api.isOffline} onPress={() => { if (created) void perform(() => attach(created)); }} />
              <BookButton label="Done" variant="primary" onPress={close} />
            </> : step === 'uncertain' ? <>
              <Text style={textStyle}>Creation could not be confirmed. Refresh, then explicitly choose an existing {noun}. A matching name does not confirm who created it.</Text>
              <BookButton label="Refresh" variant="text" disabled={busy || api.isOffline} onPress={api.refresh} />
              {entities.map(item => <BookButton key={item.id} label={`Use existing ${item.name}`} variant="text" disabled={busy || api.isOffline} onPress={() => { if (target) void perform(() => attach(item)); else close(); }} />)}
              <BookButton label="Done" variant="primary" onPress={close} />
            </> : <>
              {!dataReady && !api.entities.isError && !api.members.isError && <Text style={textStyle}>Loading {kind}…</Text>}
              {(api.entities.isError || api.members.isError) && <><Text accessibilityRole="alert" style={textStyle}>Couldn&apos;t refresh {kind}.</Text><BookButton label="Try again" variant="text" disabled={api.isOffline} onPress={api.refresh} /></>}
              {dataReady && entities.length === 0 && <Text style={textStyle}>No {kind} yet.</Text>}
              {step === 'manage' ? <>
                {entities.map(item => <View key={item.id} style={styles.manageRow}><Text style={textStyle}>{item.name}</Text>
                  <BookButton label="Rename" accessibilityLabel={`Rename ${item.name}`} variant="text" disabled={busy || api.isOffline} onPress={() => start('rename', item)} />
                  <BookButton label="Delete" accessibilityLabel={`Delete ${item.name}`} variant="text" disabled={busy || api.isOffline} onPress={() => start('delete', item)} />
                </View>)}
              </> : picker}
              {capped && <Text style={textStyle}>You have {ORGANISING_LIMIT} {kind}. Delete one to create another.</Text>}
              <BookButton label="Done" variant="primary" onPress={close} />
            </>}
          </ScrollView>
          <BookFeedbackSlot />
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </GestureHandlerRootView>
  </Modal>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { flex: 1, justifyContent: 'center', padding: LIBRARY_SPACING.md },
  dialog: { width: '100%', maxWidth: DIALOG_MAX_WIDTH, maxHeight: '90%', alignSelf: 'center', borderRadius: LIBRARY_RADIUS.dialog, padding: LIBRARY_SPACING.lg },
  content: { gap: LIBRARY_SPACING.md },
  choice: { minHeight: MIN_TARGET, justifyContent: 'center', paddingVertical: LIBRARY_SPACING.sm },
  manageRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: LIBRARY_SPACING.sm },
  input: { minHeight: MIN_TARGET, borderWidth: StyleSheet.hairlineWidth, padding: LIBRARY_SPACING.sm, borderRadius: LIBRARY_RADIUS.card },
});
