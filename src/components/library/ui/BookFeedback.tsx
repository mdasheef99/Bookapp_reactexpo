import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, findNodeHandle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LIBRARY_RADIUS, LIBRARY_SPACING, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { useLibraryTypography } from '@/components/library/LibraryTypography';
import { BookButton } from './BookButton';

export type BookFeedbackKind = 'success' | 'error' | 'info';
export interface BookConfirmSpec { title: string; message: string; keep: string; confirm: string; destructive?: boolean }
export interface BookFeedbackAction { label: string; onPress: () => void }
export type BookFeedbackNotifyInput =
  | { kind: 'error'; message: string; action?: BookFeedbackAction }
  | { kind: 'success' | 'info'; message: string; action?: never };
export interface BookFeedbackApi {
  notify(input: BookFeedbackNotifyInput): void;
  confirm(spec: BookConfirmSpec): Promise<boolean>;
}

type Toast = Parameters<BookFeedbackApi['notify']>[0] & { id: number };
type Confirmation = { spec: BookConfirmSpec; resolve: (confirmed: boolean) => void };
type ToastContextValue = {
  toast: Toast | null;
  dismiss: () => void;
  slotCount: number;
  activeSlot: symbol | undefined;
  registerSlot: (id: symbol) => () => void;
};
const ApiContext = createContext<BookFeedbackApi | null>(null);
const ToastContext = createContext<ToastContextValue | null>(null);
const providerError = 'Book feedback must be used inside BookFeedbackProvider.';

export function useBookFeedback(): BookFeedbackApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error(providerError);
  return api;
}

function useToastState() {
  const state = useContext(ToastContext);
  if (!state) throw new Error(providerError);
  return state;
}

function ToastRegion({ toast, dismiss }: { toast: Toast | null; dismiss: () => void }) {
  const colors = useLibraryAppearance();
  const fonts = useLibraryTypography();
  return <View accessibilityLiveRegion="polite" testID="book-feedback-live-region" pointerEvents="box-none" style={styles.region}>
    {toast && <View key={toast.id} testID="book-feedback-toast" pointerEvents={toast.kind === 'error' ? 'auto' : 'none'} style={[styles.toast, {
      backgroundColor: colors[`${toast.kind}Surface`], borderColor: colors[toast.kind],
    }]}>
      <Text accessibilityRole={toast.kind === 'error' ? 'alert' : undefined}
        style={[styles.message, { color: colors.textPrimary, fontFamily: fonts.body }]}>{toast.message}</Text>
      {toast.kind === 'error' && toast.action ? <BookButton label={toast.action.label} variant="text" onPress={toast.action.onPress} testID="book-feedback-action" /> : null}
      {toast.kind === 'error' && <BookButton label="Dismiss" variant="text" onPress={dismiss} />}
    </View>}
  </View>;
}

function ToastHost() {
  const { toast, dismiss, slotCount } = useToastState();
  const insets = useSafeAreaInsets();
  return <View testID="book-feedback-host" pointerEvents="box-none" style={[styles.host, { top: insets.top + LIBRARY_SPACING.xs }]}>
    <ToastRegion toast={slotCount ? null : toast} dismiss={dismiss} />
  </View>;
}

export function BookFeedbackSlot(): React.JSX.Element {
  const { toast, dismiss, activeSlot, registerSlot } = useToastState();
  const id = useRef(Symbol('book-feedback-slot')).current;
  useEffect(() => registerSlot(id), [id, registerSlot]);
  return <View testID="book-feedback-slot">
    <ToastRegion toast={activeSlot === id ? toast : null} dismiss={dismiss} />
  </View>;
}

export function BookFeedbackProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const colors = useLibraryAppearance();
  const fonts = useLibraryTypography();
  const [toast, setToast] = useState<Toast | null>(null);
  const [dialog, setDialog] = useState<Confirmation | null>(null);
  const [slotCount, setSlotCount] = useState(0);
  const [activeSlot, setActiveSlot] = useState<symbol>();
  const slots = useRef(new Set<symbol>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastId = useRef(0);
  const pending = useRef<Confirmation | null>(null);
  const mounted = useRef(true);
  const keepRef = useRef<View>(null);

  const dismiss = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);
  const notify = useCallback<BookFeedbackApi['notify']>(input => {
    if (!mounted.current) return;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setToast({ ...input, id: ++toastId.current });
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(input.message);
    if (input.kind !== 'error') timer.current = setTimeout(dismiss, 4000);
  }, [dismiss]);
  const confirm = useCallback<BookFeedbackApi['confirm']>(spec => {
    if (!mounted.current) return Promise.resolve(false);
    return new Promise<boolean>(resolve => {
      const previous = pending.current;
      const request = { spec, resolve };
      pending.current = request;
      setDialog(request);
      previous?.resolve(false);
    });
  }, []);
  const settle = useCallback((request: Confirmation, confirmed: boolean) => {
    if (pending.current !== request) return;
    pending.current = null;
    setDialog(null);
    request.resolve(confirmed);
  }, []);
  const registerSlot = useCallback((id: symbol) => {
    slots.current.add(id);
    setSlotCount(count => count + 1);
    setActiveSlot(slots.current.values().next().value);
    return () => {
      slots.current.delete(id);
      setSlotCount(count => count - 1);
      setActiveSlot(slots.current.values().next().value);
    };
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      const request = pending.current;
      pending.current = null;
      request?.resolve(false);
    };
  }, []);

  const api = useMemo(() => ({ notify, confirm }), [notify, confirm]);
  const toastState = useMemo(() => ({ toast, dismiss, slotCount, activeSlot, registerSlot }), [toast, dismiss, slotCount, activeSlot, registerSlot]);
  return <ApiContext.Provider value={api}><ToastContext.Provider value={toastState}>
    <View style={styles.area}>
      {children}
      <ToastHost />
      <Modal visible={!!dialog} transparent animationType="none" onRequestClose={() => { if (dialog) settle(dialog, false); }} onShow={() => {
        if (Platform.OS !== 'web') {
          const node = findNodeHandle(keepRef.current);
          if (node) AccessibilityInfo.setAccessibilityFocus(node);
        }
      }}>
        {dialog && <Pressable testID="book-confirm-scrim" accessible={false} focusable={false} style={[styles.scrim, { backgroundColor: colors.overlay }]} onPress={() => settle(dialog, false)}>
          <Pressable testID="book-confirm-card" accessible={false} focusable={false} accessibilityViewIsModal onPress={event => event.stopPropagation()} style={[styles.dialog, { backgroundColor: colors.bgRaised }]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialogContent}>
              <BookFeedbackSlot />
              <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.heading }]}>{dialog.spec.title}</Text>
              <Text style={[styles.message, { color: colors.textPrimary, fontFamily: fonts.body }]}>{dialog.spec.message}</Text>
              <BookButton ref={keepRef} label={dialog.spec.keep} variant="secondary" onPress={() => settle(dialog, false)} />
              <BookButton label={dialog.spec.confirm} variant={dialog.spec.destructive ? 'destructive' : 'primary'} onPress={() => settle(dialog, true)} />
            </ScrollView>
          </Pressable>
        </Pressable>}
      </Modal>
    </View>
  </ToastContext.Provider></ApiContext.Provider>;
}

const styles = StyleSheet.create({
  area: { flex: 1 },
  host: { position: 'absolute', left: LIBRARY_SPACING.md, right: LIBRARY_SPACING.md, alignItems: 'center', zIndex: 1000 },
  region: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  toast: { padding: LIBRARY_SPACING.md, borderRadius: LIBRARY_RADIUS.control, borderWidth: 1, gap: LIBRARY_SPACING.xs },
  message: { fontSize: 16, lineHeight: 24 },
  scrim: { flex: 1, justifyContent: 'center', padding: LIBRARY_SPACING.lg },
  dialog: { padding: LIBRARY_SPACING.lg, borderRadius: LIBRARY_RADIUS.dialog, maxHeight: '90%', width: '100%', maxWidth: 480, alignSelf: 'center' },
  dialogContent: { gap: LIBRARY_SPACING.sm },
  title: { fontSize: 25, fontWeight: '700' },
});
