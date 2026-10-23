import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { View as RNView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused, useRoute } from '@react-navigation/native';
import { randomUUID } from 'expo-crypto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookButton, BookOffline } from '@/components/library/ui';
import { LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';
// Native Text applies font scaling to numeric line heights as well as font sizes.
import { LIBRARY_TEXT_BASE as LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { NoteSwipeControls, NoteSwipeStack } from '@/components/library/notes-swipe/NoteSwipeStack';
import { NoteFullNoteSheet } from '@/components/library/notes-swipe/NoteFullNoteSheet';
import { NoteOrderMenu } from '@/components/library/notes-swipe/NoteOrderMenu';
import { NoteDeckChips } from '@/components/library/notes-swipe/NoteDeckChips';
import { useNoteSwipeHint, useReducedNoteMotion } from '@/components/library/notes-swipe/useNoteSwipeMotion';
import { acceptsDeckKey, noteSwipeOrderKey, parseDeckScope, parseStoredOrder } from '@/features/books/notes/noteDeck';
import { NOTE_CATEGORIES, NoteDeckCategory, NoteDeckOrder, NoteDeckReturnState, categoryLabel } from '@/features/books/notes/manualNoteContract';
import { useNoteDeck } from '@/features/books/notes/useNoteDeck';
import { openNoteComposer, readerHref, registerNoteContext } from '@/features/books/notes/noteNavigation';
import { useNoteContext } from '@/features/books/notes/useManualNotes';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export default function NotesSwipeScreen() {
  const params = useLocalSearchParams<{ scope?: string; userBookId?: string; category?: string; order?: string; seed?: string; noteId?: string; swipeAt?: string; swipeNext?: string }>();
  const scope = useMemo(() => parseDeckScope(params), [params.scope, params.userBookId]);
  const explicitOrder = useMemo(() => {
    const raw = Array.isArray(params.order) ? params.order[0] : params.order;
    return raw === 'shuffle' || raw === 'newest' || raw === 'oldest' ? raw : undefined;
  }, [params.order]);
  const [category, setCategory] = useState<NoteDeckCategory>(() => {
    const raw = Array.isArray(params.category) ? params.category[0] : params.category;
    return NOTE_CATEGORIES.find(c => c.value === raw)?.value ?? 'all';
  });
  const [order, setOrder] = useState<NoteDeckOrder>(() => explicitOrder ?? 'shuffle');
  const [seed, setSeed] = useState(() => params.seed || randomUUID());
  const [orderMenuOpen, setOrderMenuOpen] = useState(false);
  const [orderLoaded, setOrderLoaded] = useState(() => explicitOrder !== undefined);
  // C3: category/order/seed are live screen state. Reload/return fallbacks retain
  // the visit's seed and card; explicit order params win over stored values.
  const initial = useMemo<NoteDeckReturnState>(() => {
    const atRaw = params.swipeAt === undefined ? Number.NaN : Number.parseInt(params.swipeAt, 10);
    const at = Number.isSafeInteger(atRaw) && atRaw >= 0 ? atRaw : undefined;
    const nextId = params.swipeNext === undefined ? undefined : params.swipeNext === '__end__' ? null : params.swipeNext;
    return { scope, category, order, seed, noteId: params.noteId === '__end__' ? null : params.noteId ?? '',
      ...(at === undefined ? {} : { at }), ...(nextId === undefined ? {} : { nextId }) };
  }, [scope, category, order, seed, params.noteId, params.swipeAt, params.swipeNext]);
  const router = useRouter(); const route = useRoute(); const focused = useIsFocused();
  const colors = useLibraryAppearance(); const insets = useSafeAreaInsets(); const { isOffline } = useNetworkStatus();
  const { actorId, book } = useNoteContext(scope.kind === 'book' ? scope.userBookId : '');
  const bookNotFound = book.error instanceof Error && book.error.message === 'This book is unavailable.';
  const invalidBook = scope.kind === 'book' && (!scope.userBookId || (book.isError && !book.data && bookNotFound));
  useEffect(() => {
    if (explicitOrder !== undefined) {
      setOrder(explicitOrder);
      setOrderLoaded(true);
      return;
    }
    if (!actorId) return;
    let live = true;
    void AsyncStorage.getItem(noteSwipeOrderKey(actorId)).then(raw => {
      if (!live) return;
      setOrder(parseStoredOrder(raw));
      setOrderLoaded(true);
    }).catch(() => {
      if (!live) return;
      setOrderLoaded(true);
    });
    return () => { live = false; };
  }, [actorId, explicitOrder]);
  const enabled = focused && !isOffline && !invalidBook && orderLoaded && (scope.kind === 'all' || !!book.data);
  // Offline pauses reads while the focused screen still retains its nearby cards.
  const deck = useNoteDeck(actorId, initial, enabled, focused);
  const deckCategories = (deck as { categories?: readonly NoteDeckCategory[] }).categories ?? (['all'] as const);
  const deckCategory = (deck as { category?: NoteDeckCategory }).category ?? 'all';
  const deckIndexData = (deck as { index?: { data?: unknown } }).index?.data;
  useEffect(() => {
    if (deckIndexData === undefined) return;
    if (deckCategory !== category) setCategory(deckCategory);
  }, [deckCategory, deckIndexData]);
  const reduced = useReducedNoteMotion();
  const [sheetOpen, setSheetOpen] = useState(false);
  const overlayOpen = sheetOpen || orderMenuOpen;
  const populated = !!deck.index.data && orderLoaded && deck.ids.length > 0;
  const end = populated && deck.noteId === null;
  const hint = useNoteSwipeHint(actorId, focused && !!deck.card);
  const [announcement, setAnnouncement] = useState(''); const announced = useRef('');
  const startAgainRef = useRef<RNView>(null);
  const readButtonRef = useRef<RNView>(null);
  const orderButtonRef = useRef<RNView>(null);
  const wasOverlayOpen = useRef(false);
  const lastOverlayRef = useRef<'sheet' | 'order' | null>(null);
  // Sheet/menu-dismiss grace (fix6-3): after either overlay closes, keep the deck
  // pan disabled until the close animation finishes plus a short grace, so the same
  // finger that swiped the sheet header down cannot finish a `leave` gesture on the
  // deck the moment it is re-enabled (Android Modal touches overlap). The stack's
  // finishFlight also swallows gesture leaves while disabled; the Back button still
  // leaves via requestLeave directly.
  const [sheetCooldown, setSheetCooldown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevOverlayForCooldown = useRef(false);
  useEffect(() => {
    if (prevOverlayForCooldown.current && !overlayOpen) {
      setSheetCooldown(true);
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
      cooldownTimer.current = setTimeout(() => { setSheetCooldown(false); cooldownTimer.current = null; }, 400);
    } else if (overlayOpen) {
      setSheetCooldown(false);
      if (cooldownTimer.current) { clearTimeout(cooldownTimer.current); cooldownTimer.current = null; }
    }
    prevOverlayForCooldown.current = overlayOpen;
  }, [overlayOpen]);
  useEffect(() => () => { if (cooldownTimer.current) clearTimeout(cooldownTimer.current); }, []);
  const stackRef = useRef<NoteSwipeControls>(null);
  const [stackHeight, setStackHeight] = useState<number>();
  const { fontScale } = useWindowDimensions();
  const compactBar = fontScale >= 2 ? { paddingVertical: LIBRARY_SPACING.xxs } : undefined;
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const closeOrderMenu = useCallback(() => setOrderMenuOpen(false), []);
  useEffect(() => { if (!deck.card) closeSheet(); }, [deck.card, closeSheet]);
  useEffect(() => {
    if (end && Platform.OS === 'web') {
      (startAgainRef.current as unknown as { focus?: () => void } | null)?.focus?.();
    }
  }, [end]);
  useEffect(() => {
    if (sheetOpen) lastOverlayRef.current = 'sheet';
    else if (orderMenuOpen) lastOverlayRef.current = 'order';
  }, [sheetOpen, orderMenuOpen]);
  useEffect(() => {
    if (wasOverlayOpen.current && !overlayOpen && Platform.OS === 'web') {
      if (lastOverlayRef.current === 'order') {
        (orderButtonRef.current as unknown as { focus?: () => void } | null)?.focus?.();
      } else {
        (readButtonRef.current as unknown as { focus?: () => void } | null)?.focus?.();
      }
      lastOverlayRef.current = null;
    }
    wasOverlayOpen.current = overlayOpen;
  }, [overlayOpen]);
  const depart = useCallback(() => {
    deck.abort();
    if (router.canGoBack()) router.back();
    else router.replace(scope.kind === 'book' && scope.userBookId ? { pathname: '/(tabs)/library/notes', params: { userBookId: scope.userBookId } } : '/(tabs)/library');
  }, [router, scope, deck.abort]);
  const leave = useCallback(() => { if (stackRef.current) stackRef.current.leave(); else depart(); }, [depart]);
  const move = useCallback((direction: 'next' | 'previous') => stackRef.current?.run(() => deck.move(direction)), [deck.move]);
  const goToNextCategory = useCallback(() => {
    if (deckCategories.length <= 1) return;
    const at = deckCategories.indexOf(deckCategory);
    const next = deckCategories[(at + 1) % deckCategories.length];
    stackRef.current?.category(next);
  }, [deckCategories, deckCategory]);
  const chooseCategory = useCallback((next: NoteDeckCategory) => {
    stackRef.current?.category(next);
  }, []);
  const chooseOrder = useCallback((next: NoteDeckOrder) => {
    if (next === order && next !== 'shuffle') {
      setOrderMenuOpen(false);
      return;
    }
    if (next === 'shuffle') {
      const newSeed = randomUUID();
      setSeed(newSeed);
      setOrder('shuffle');
      if (actorId) void AsyncStorage.setItem(noteSwipeOrderKey(actorId), 'shuffle').catch(() => {});
    } else {
      setOrder(next);
      if (actorId) void AsyncStorage.setItem(noteSwipeOrderKey(actorId), next).catch(() => {});
    }
    setOrderMenuOpen(false);
  }, [order, actorId]);
  const openSheet = useCallback(() => { if (deck.card && !end) setSheetOpen(true); }, [deck.card, end]);
  const read = useCallback(() => stackRef.current?.run(openSheet), [openSheet]);
  useEffect(() => {
    if (!focused) { closeSheet(); closeOrderMenu(); return; }
    if (Platform.OS === 'web') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (sheetOpen) closeSheet(); else if (orderMenuOpen) closeOrderMenu(); else leave(); return true; });
    return () => subscription?.remove?.();
  }, [focused, sheetOpen, orderMenuOpen, closeSheet, closeOrderMenu, leave]);
  useEffect(() => {
    if (!focused || !populated) return;
    const identity = `${actorId}:${deckCategory}:${deck.noteId ?? '__end__'}`;
    if (announced.current === identity) return;
    announced.current = identity;
    const text = end ? "That's all for now." : deckCategory === 'all'
      ? `All notes. Note ${deck.at + 1} of ${deck.ids.length}.`
      : `${categoryLabel(deckCategory)}. Note ${deck.at + 1} of ${deck.ids.length}.`;
    if (Platform.OS === 'web') setAnnouncement(text); else AccessibilityInfo.announceForAccessibility(text);
  }, [focused, populated, actorId, deckCategory, deck.noteId, end, deck.at, deck.ids.length]);
  useEffect(() => {
    if (Platform.OS !== 'web' || !focused || typeof window === 'undefined') return;
    const key = (event: KeyboardEvent) => {
      if (!acceptsDeckKey(event, overlayOpen)) return;
      if (event.key === 'Escape') leave();
      else if (event.key === 'ArrowRight' && populated && !end) move('next');
      else if (event.key === 'ArrowLeft' && populated && deck.at > 0) move('previous');
      else if (event.key === 'ArrowUp' && populated && deckCategories.length > 1) goToNextCategory();
      else if (event.key === 'Enter') read();
      event.preventDefault();
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [focused, overlayOpen, populated, end, move, deck.at, deckCategories.length, goToNextCategory, read, leave]);
  const retry = () => { if (scope.kind === 'book' && scope.userBookId) void book.refetch(); void deck.index.refetch(); deck.retryCard(); };
  const openReader = () => {
    if (!deck.card) return;
    const contextId = registerNoteContext({ actorId, bookId: deck.card.note.user_book_id, origin: 'swipe', canBack: true, swipeKey: route.key,
      swipe: { scope, category: deckCategory, order, seed, noteId: deck.noteId, at: deck.at, nextId: deck.ids[deck.at + 1] ?? null } });
    closeSheet(); deck.abort(); router.push(readerHref(deck.card.note.user_book_id, deck.card.note.id, contextId));
  };
  let content: React.ReactNode;
  let loading = false;
  if (invalidBook || !actorId) content = <><Text style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>This book is unavailable.</Text><BookButton label="Go to library" variant="primary" onPress={() => router.replace('/(tabs)/library')} /></>;
  else if (isOffline && !deck.index.data) content = <><Text style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>You&apos;re offline. Connect to load your notes.</Text><BookButton label="Try again" variant="primary" onPress={retry} /></>;
  else if ((deck.index.isError && !deck.index.data) || (scope.kind === 'book' && book.isError && !book.data)) content = <><Text style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>Couldn&apos;t load your notes.</Text><BookButton label="Try again" variant="primary" onPress={retry} /></>;
  else if (!deck.index.data || !orderLoaded || (scope.kind === 'book' && !book.data)) {
    loading = true;
    content = <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>Loading your notes…</Text>;
  }
  else if (!deck.ids.length) content = <><Text style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>Your notes will show up here.</Text><BookButton label={scope.kind === 'book' ? 'Add a note' : 'Go to library'} variant="primary" onPress={() => scope.kind === 'book' ? openNoteComposer(router, actorId, scope.userBookId, 'list') : router.replace('/(tabs)/library')} /></>;
  else if (end) content = <><Text accessibilityRole="header" testID="note-end-heading" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>That&apos;s all for now.</Text><BookButton ref={startAgainRef} testID="note-start-again" label="Start again" variant="primary" labelLineHeight={LIBRARY_TEXT.label.lineHeight} onPress={() => stackRef.current?.run(deck.restart)} /></>;
  else if (isOffline) content = <><Text style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>You&apos;re offline. Connect to load this note.</Text><BookButton label="Try again" variant="text" onPress={retry} /></>;
  else if (deck.detailError) content = <><Text style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>Couldn&apos;t load this note.</Text><BookButton label="Try again" variant="text" onPress={deck.retryCard} /></>;
  else content = <><Text style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>Loading note…</Text></>;
  const showCard = populated && !end && !invalidBook;
  const showStack = loading || showCard || (end && !invalidBook);
  const showStateScroll = !showStack;
  const showChrome = populated;
  return <View style={[styles.page, { backgroundColor: colors.bgPrimary }]}>
    <View testID="note-swipe-content" aria-hidden={overlayOpen} importantForAccessibility={overlayOpen ? 'no-hide-descendants' : 'auto'} {...(Platform.OS === 'web' && overlayOpen ? { inert: true } as object : {})}
      style={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View testID="note-swipe-top-bar" style={[styles.bar, styles.top, compactBar, { backgroundColor: colors.bgPrimary }]}>
        <BookButton label="←" accessibilityLabel="Back" variant="text" labelLineHeight={LIBRARY_TEXT.label.lineHeight} onPress={leave} />
        <Text accessibilityRole="header" numberOfLines={2} ellipsizeMode="tail" style={[LIBRARY_TEXT.heading, styles.title, { color: colors.textPrimary }]}>{scope.kind === 'book' ? book.data?.title ?? 'Your notes' : 'Your notes'}</Text>
        {showChrome && <BookButton ref={orderButtonRef} testID="note-order-button" label="Order" variant="text" labelLineHeight={LIBRARY_TEXT.label.lineHeight} expanded={orderMenuOpen} onPress={() => setOrderMenuOpen(true)} />}
      </View>
      {isOffline && deck.index.data && <View style={[styles.bar, { backgroundColor: colors.bgPrimary }]}><BookOffline message="Offline · Showing saved content." /></View>}
      {populated && <View testID="note-position-bar" aria-hidden importantForAccessibility="no-hide-descendants" style={[styles.bar, compactBar, { backgroundColor: colors.bgPrimary }]}>
        <View style={[styles.track, { backgroundColor: colors.controlBorder }]}><View testID="note-position-fill" style={{ height: '100%', width: `${Math.min(1, (deck.at + 1) / deck.ids.length) * 100}%`, backgroundColor: colors.accent }} /></View>
      </View>}
      {populated && <NoteDeckChips categories={deckCategories} selected={deckCategory} onSelect={chooseCategory} disabled={!focused || overlayOpen} />}
      {showStack ? (
        <View testID="note-stack-wrap" onLayout={event => setStackHeight(event.nativeEvent.layout.height)} style={styles.stackWrap}>
          <NoteSwipeStack ref={stackRef} availableHeight={stackHeight} card={showCard ? deck.card : undefined} undercards={showCard ? deck.undercards : []} at={deck.at} total={deck.ids.length} reduced={reduced} hint={hint} enabled={focused && !overlayOpen && !sheetCooldown && populated}
            onMove={deck.move} onRead={openSheet} onLeave={depart} onCategory={target => {
              if (target !== undefined) setCategory(target);
              else { const at = deckCategories.indexOf(deckCategory); setCategory(deckCategories[(at + 1) % deckCategories.length]); }
            }} canCategory={deckCategories.length > 1} categoryKey={deckCategory}><View style={styles.state}>{content}</View></NoteSwipeStack>
        </View>
      ) : (
        <ScrollView testID="note-state-scroll" style={styles.stateScroll} contentContainerStyle={styles.stateScrollContent}>
          <View style={styles.state}>{content}</View>
        </ScrollView>
      )}
      {populated && <View testID="note-swipe-button-bar" style={[styles.bar, styles.buttons, { backgroundColor: colors.bgPrimary }]}>
        <View testID="note-swipe-button-slot-prev" style={styles.buttonSlot}><BookButton label="Previous" variant="text" labelLineHeight={LIBRARY_TEXT.label.lineHeight} disabled={deck.at <= 0} onPress={() => move('previous')} /></View>
        {!end && <><View testID="note-swipe-button-slot-read" style={styles.buttonSlot}><BookButton ref={readButtonRef} testID="note-read-full" label="Read full note" variant="text" labelLineHeight={LIBRARY_TEXT.label.lineHeight} disabled={!deck.card} onPress={read} /></View><View testID="note-swipe-button-slot-next" style={styles.buttonSlot}><BookButton label="Next" variant="primary" labelLineHeight={LIBRARY_TEXT.label.lineHeight} onPress={() => move('next')} /></View></>}
      </View>}
      {Platform.OS === 'web' && <Text testID="note-move-announcement" aria-live="polite" style={[styles.live, { color: colors.textPrimary }]}>{announcement}</Text>}
    </View>
    <NoteOrderMenu visible={orderMenuOpen} order={order} onSelect={chooseOrder} onClose={closeOrderMenu} />
    <NoteFullNoteSheet card={sheetOpen && deck.card ? deck.card : null} reduced={reduced} onClose={closeSheet} onOpenNote={openReader} onOpenBook={() => {
      if (!deck.card) return; closeSheet(); deck.abort(); router.push({ pathname: '/(tabs)/library/[bookId]', params: { bookId: deck.card.note.user_book_id } });
    }} />
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1 }, content: { flex: 1 }, bar: { paddingHorizontal: LIBRARY_SPACING.md, paddingVertical: LIBRARY_SPACING.xs },
  top: { flexDirection: 'row', alignItems: 'center', gap: LIBRARY_SPACING.xs }, title: { flex: 1 },
  track: { height: 3, overflow: 'hidden' }, buttons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: LIBRARY_SPACING.xs, flexShrink: 0 },
  buttonSlot: { flexGrow: 1, flexShrink: 1, minWidth: MIN_TARGET },
  stackWrap: { flex: 1, flexShrink: 1, minHeight: 0, justifyContent: 'center' },
  stateScroll: { flex: 1 }, stateScrollContent: { flexGrow: 1, justifyContent: 'center' },
  state: { flex: 1, justifyContent: 'center', padding: LIBRARY_SPACING.lg, gap: LIBRARY_SPACING.md },
  live: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
