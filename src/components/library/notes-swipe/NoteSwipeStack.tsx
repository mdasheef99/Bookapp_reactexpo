import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PixelRatio, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { NoteDeckCard } from '@/features/books/notes/manualNoteContract';
import { NOTE_SWIPE, swipeDirection, SwipeDirection } from '@/features/books/notes/noteSwipeConstants';
import { spineColorFromTitle } from '@/features/books/utils/shelfLayout';
import { LIBRARY_RADIUS, LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT, LIBRARY_TEXT_BASE, scaledLineHeight } from '../LibraryTypography';
import { NoteSwipeCard, noteCardName } from './NoteSwipeCard';

export interface NoteSwipeControls {
  run: (action: () => void) => void;
  leave: () => void;
}
export interface NoteSwipeStackProps {
  ref?: React.Ref<NoteSwipeControls>;
  availableHeight?: number;
  card?: NoteDeckCard;
  undercards: (NoteDeckCard | undefined)[];
  at: number;
  total: number;
  reduced: boolean;
  hint: boolean;
  enabled: boolean;
  onMove: (direction: 'next' | 'previous') => void;
  onRead: () => void;
  onLeave: () => void;
  onCategory?: () => void;
  canCategory?: boolean;
  categoryKey?: string;
  children?: React.ReactNode;
}
// Flight policy (fix6): inputs DURING a flight are IGNORED (a swipe arriving while
// flight != 0 is dropped by the worklet; a button/key/action arriving while the JS
// flight ref is non-zero is dropped by `run`). A flight always ends via its own
// completion, via the position effect, via unmount/enabled-false, or via the safety
// timer, so an input ~300ms after the previous flight finishes always works.
export function NoteSwipeStack({ ref, availableHeight, card, undercards, at, total, reduced, hint, enabled, onMove, onRead, onLeave, onCategory, canCategory = false, categoryKey = '', children }: NoteSwipeStackProps) {
  const colors = useLibraryAppearance(); const screen = useWindowDimensions();
  const [measuredChrome, setMeasuredChrome] = useState<number>();
  const x = useSharedValue(0); const y = useSharedValue(0); const axis = useSharedValue(0);
  const width = useSharedValue(Math.max(1, screen.width - LIBRARY_SPACING.xxl * 2));
  const opacity = useSharedValue(1);
  // ONE shared source of truth for "a flight is in progress": 0 idle, else the id of
  // the active flight. Written ONLY in worklets (pan onEnd starts it, completions and
  // the JS helpers below clear it) and in the single JS helper `resetFlightToIdle`.
  // JS buttons/keys/actions NEVER read this value; they gate on `jsFlightRef` below.
  const flight = useSharedValue(0);
  // JS-owned mirror for gating: 0 idle, else the active flight id. Set/cleared only on
  // the JS thread (onFlightStart / finishFlight / resetFlightToIdle). `run` gates on
  // this ref alone so a stale worklet read on the JS thread can never deadlock input.
  const jsFlightRef = useRef(0);
  // panActive blocks a tap that races a pan in the same gesture (Exclusive safety net).
  const panActive = useSharedValue(false);
  // Identity never returns to zero with idle. The epoch also fences bridge starts
  // that had not reached JS when a resize/disable/reset cancelled their flight.
  const generation = useSharedValue(0);
  const flightEpoch = useSharedValue(0);
  const jsEpochRef = useRef(0);
  const lastStartedRef = useRef(0);
  const hintConsumedRef = useRef(false);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const background = spineColorFromTitle(card?.book.title ?? '');
  const fromColor = useSharedValue(background); const toColor = useSharedValue(background); const fade = useSharedValue(1);
  useEffect(() => {
    fromColor.value = toColor.value; toColor.value = background;
    fade.value = reduced ? 1 : 0;
    if (!reduced) fade.value = withTiming(1, { duration: NOTE_SWIPE.backgroundMs });
  }, [background, reduced, fade, fromColor, toColor]);
  // Pure-visual Previous entry: set when a `previous` flight finishes, consumed by the
  // position effect as a visual slide-in that NEVER sets flight/jsFlightRef, so inputs
  // during the 180ms simply interrupt it by resetting x. Never blocks input.
  const prevSlideRef = useRef(false);
  // Pure-visual Category entry: set when a `category` flight finishes (or when the
  // category key changes via chips/actions), consumed the same way from below.
  const categorySlideRef = useRef(false);
  const prevCategoryKeyRef = useRef(categoryKey);
  const leaveOnceRef = useRef(false);
  const activeRef = useRef(enabled);
  activeRef.current = enabled;
  // Single JS helper that keeps the two flight states in sync and always leaves the
  // card idle. Fences late worklet/JS completions: they check the JS id and the
  // shared id and are ignored once both are 0.
  const resetFlightToIdle = useCallback((invalidate = true) => {
    if (safetyTimer.current) { clearTimeout(safetyTimer.current); safetyTimer.current = null; }
    if (invalidate) {
      jsEpochRef.current += 1;
      flightEpoch.value = jsEpochRef.current;
    }
    jsFlightRef.current = 0;
    try { flight.value = 0; } catch { /* ignore */ }
    try { panActive.value = false; } catch { /* ignore */ }
    try { x.value = 0; y.value = 0; opacity.value = 1; } catch { /* ignore */ }
  }, [flight, flightEpoch, x, y, opacity, panActive]);
  const invalidateFlight = useCallback(() => {
    prevSlideRef.current = false;
    categorySlideRef.current = false;
    resetFlightToIdle();
  }, [resetFlightToIdle]);
  useEffect(() => () => { activeRef.current = false; invalidateFlight(); }, [invalidateFlight]);
  useEffect(() => {
    if (!enabled) invalidateFlight();
    else leaveOnceRef.current = false;
  }, [enabled, invalidateFlight]);
  const requestLeave = useCallback(() => {
    if (leaveOnceRef.current) return;
    leaveOnceRef.current = true;
    resetFlightToIdle();
    onLeave();
  }, [resetFlightToIdle, onLeave]);
  // Reset depends ONLY on the note position (`at`) and the category key, never on
  // card data arrival (undefined → defined mid-flight). Data arrival alone (same
  // `at` + category) never cancels a flight. A normal in-flight completion clears
  // the flight BEFORE the parent changes `at`/category, so this effect sees an
  // idle flight and only resets visuals / runs the pure Previous/Category slide-in.
  // An EXTERNAL position change mid-flight (or a reduced/width re-run, unmount,
  // enabled=false) cancels the flight cleanly without advancing.
  useEffect(() => {
    const categoryChanged = prevCategoryKeyRef.current !== categoryKey;
    prevCategoryKeyRef.current = categoryKey;
    resetFlightToIdle();
    if (prevSlideRef.current && !reduced) {
      prevSlideRef.current = false;
      categorySlideRef.current = false;
      try {
        x.value = -screen.width;
        y.value = 0;
        opacity.value = 1;
        // Pure visual: no flight id, no busy, no completion touching flight state,
        // so interrupting inputs simply overwrite x and cancel this animation.
        x.value = withTiming(0, { duration: NOTE_SWIPE.exitMs });
      } catch {
        try { x.value = 0; } catch { /* ignore */ }
      }
    } else if ((categorySlideRef.current || categoryChanged) && !reduced) {
      prevSlideRef.current = false;
      categorySlideRef.current = false;
      try {
        x.value = 0;
        y.value = screen.height;
        opacity.value = 1;
        // Pure-visual category entry from below: never a second flight, never blocks
        // input, interrupted by the next input.
        y.value = withTiming(0, { duration: NOTE_SWIPE.exitMs });
      } catch {
        try { y.value = 0; } catch { /* ignore */ }
      }
    } else {
      prevSlideRef.current = false;
      categorySlideRef.current = false;
    }
  }, [at, categoryKey, x, y, opacity, reduced, screen.width, screen.height, resetFlightToIdle]);
  useEffect(() => {
    if (!hint || !card || hintConsumedRef.current) return;
    if (reduced || !enabled) return;
    hintConsumedRef.current = true;
    scheduleOnUI(() => {
      'worklet';
      if (flight.value !== 0 || panActive.value) return;
      x.value = withSequence(withTiming(-NOTE_SWIPE.axisLock, { duration: NOTE_SWIPE.hintMs }), withTiming(NOTE_SWIPE.axisLock, { duration: NOTE_SWIPE.hintMs }), withTiming(0, { duration: NOTE_SWIPE.hintMs }));
    });
  }, [hint, reduced, enabled, card, x, flight, panActive]);
  const finish = useCallback((direction: SwipeDirection) => {
    if (direction === 'leave') {
      requestLeave();
      return;
    }
    if (direction === 'next' || direction === 'previous') {
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (direction === 'previous' && !reduced) prevSlideRef.current = true;
      onMove(direction);
      return;
    }
    if (direction === 'category') {
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (!reduced) categorySlideRef.current = true;
      onCategory?.();
    }
  }, [onMove, onCategory, requestLeave, reduced]);
  // Safety net: if a flight's completion never arrives, release the flight and reset
  // position so the card is never left translated off-screen. Never advances here and
  // does not depend on any other state besides the flight id it was started for.
  const onFlightStart = useCallback((myFlight: number, epoch: number) => {
    if (epoch !== jsEpochRef.current || myFlight <= lastStartedRef.current) return;
    lastStartedRef.current = myFlight;
    if (!activeRef.current || leaveOnceRef.current) { resetFlightToIdle(); return; }
    jsFlightRef.current = myFlight;
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    safetyTimer.current = setTimeout(() => {
      if (jsFlightRef.current === myFlight) {
        resetFlightToIdle();
      }
      safetyTimer.current = null;
    }, NOTE_SWIPE.exitMs * 2 + NOTE_SWIPE.safetyMarginMs);
  }, [resetFlightToIdle]);
  // Exactly-once completion per flight: the first call for a flight advances;
  // late/duplicate completions (done=false cancellation + timeout, double callback,
  // effect rerun, unmount) are ignored via the monotonic id. ALWAYS releases the
  // flight and resets translation/opacity, even when the position did not change or
  // when disabled mid-flight (gesture leaves during the sheet grace are swallowed
  // here after resetting, while the Back button uses requestLeave directly).
  const finishFlight = useCallback((direction: SwipeDirection, myFlight: number, epoch: number) => {
    if (jsFlightRef.current !== myFlight) return;
    if (epoch !== jsEpochRef.current) return;
    resetFlightToIdle(false);
    if (!activeRef.current || leaveOnceRef.current) return;
    finish(direction);
  }, [finish, resetFlightToIdle]);
  const canPrevious = at > 0; const canNext = at < total;
  const canCategoryFlight = canCategory && !!onCategory;
  // Single flight-aware path for non-gesture inputs: a button/key/action pressed
  // while a flight is running is IGNORED (the flight's own completion advances
  // exactly once). Gated ONLY on the JS-owned ref so shared-value staleness can
  // never deadlock buttons, keys, accessibility actions or taps.
  const run = useCallback((action: () => void) => {
    if (!activeRef.current || leaveOnceRef.current || jsFlightRef.current !== 0) return;
    action();
  }, []);
  useImperativeHandle(ref, () => ({ run, leave: requestLeave }), [run, requestLeave]);
  const requestMove = useCallback((direction: 'next' | 'previous') => {
    if (direction === 'next' && !canNext) return;
    if (direction === 'previous' && !canPrevious) return;
    run(() => onMove(direction));
  }, [run, canNext, canPrevious, onMove]);
  const requestCategory = useCallback(() => {
    if (!canCategoryFlight) return;
    run(() => onCategory?.());
  }, [run, canCategoryFlight, onCategory]);
  const requestRead = useCallback(() => {
    if (card) run(onRead);
  }, [run, card, onRead]);
  // Rebuilt whenever the position/availability changes so a swipe right after a move
  // uses the new `at`/`total` (no stale closures). Data arrival alone (same `at`)
  // does not change these deps, so it never rebuilds/cancels a flight in progress.
  const gesture = useMemo(() => {
    const pan = Gesture.Pan().enabled(enabled).minDistance(NOTE_SWIPE.axisLock)
      .onStart(() => { if (flight.value === 0) { axis.value = 0; panActive.value = true; } })
      .onUpdate(event => {
        if (flight.value !== 0) return;
        if (Math.max(Math.abs(event.translationX), Math.abs(event.translationY)) >= NOTE_SWIPE.tapMaxDistance) panActive.value = true;
        if (axis.value === 0 && Math.max(Math.abs(event.translationX), Math.abs(event.translationY)) >= NOTE_SWIPE.axisLock) axis.value = Math.abs(event.translationX) >= Math.abs(event.translationY) ? 1 : 2;
        x.value = axis.value === 1 ? event.translationX : 0;
        y.value = axis.value === 2 ? event.translationY : 0;
      }).onEnd(event => {
        if (flight.value !== 0) return;
        // Mark fast flings whose onUpdate never ran so a racing tap is still blocked.
        if (Math.max(Math.abs(event.translationX), Math.abs(event.translationY)) >= NOTE_SWIPE.tapMaxDistance) panActive.value = true;
        // Use the event's translation (up to date) rather than `x.value`, which may be
        // stale when `onUpdate` returned early or never ran for very fast gestures.
        // Derive the axis from the event when it was never locked.
        const eventAxis = axis.value !== 0 ? axis.value
          : Math.max(Math.abs(event.translationX), Math.abs(event.translationY)) >= NOTE_SWIPE.axisLock
            ? (Math.abs(event.translationX) >= Math.abs(event.translationY) ? 1 : 2) : 0;
        if (eventAxis !== axis.value) axis.value = eventAxis;
        const direction = swipeDirection(eventAxis, event.translationX, event.translationY, event.velocityX, event.velocityY, width.value, screen.height);
        if (direction === 'cancel' || (direction === 'next' && !canNext) || (direction === 'previous' && !canPrevious) || (direction === 'category' && !canCategoryFlight)) {
          x.value = reduced ? 0 : withSpring(0); y.value = reduced ? 0 : withSpring(0); return;
        }
        generation.value += 1;
        const myFlight = generation.value;
        const epoch = flightEpoch.value;
        flight.value = myFlight;
        scheduleOnRN(onFlightStart, myFlight, epoch);
        if (reduced) {
          x.value = 0; y.value = 0;
          opacity.value = withTiming(0, { duration: NOTE_SWIPE.crossFadeMs }, () => {
            if (flight.value === myFlight) scheduleOnRN(finishFlight, direction, myFlight, epoch);
          });
        } else if (direction === 'leave') {
          y.value = withTiming(screen.height, { duration: NOTE_SWIPE.exitMs }, () => {
            if (flight.value === myFlight) scheduleOnRN(finishFlight, direction, myFlight, epoch);
          });
        } else if (direction === 'previous') {
          scheduleOnRN(finishFlight, direction, myFlight, epoch);
        } else if (direction === 'category') {
          y.value = withTiming(-screen.height, { duration: NOTE_SWIPE.exitMs }, () => {
            if (flight.value === myFlight) scheduleOnRN(finishFlight, direction, myFlight, epoch);
          });
          opacity.value = withTiming(0, { duration: NOTE_SWIPE.exitMs });
        } else {
          x.value = withTiming(-screen.width, { duration: NOTE_SWIPE.exitMs }, () => {
            if (flight.value === myFlight) scheduleOnRN(finishFlight, direction, myFlight, epoch);
          });
        }
      }).onFinalize(() => {
        try { panActive.value = false; } catch { /* ignore */ }
        if (flight.value === 0) { x.value = reduced ? 0 : withSpring(0); y.value = reduced ? 0 : withSpring(0); }
      });
    // A swipe must never also count as a tap: the pan claims by distance
    // (minDistance 10) while the tap is bounded (≤8dp, short duration). The shared
    // flag is the second net for the race where the pan has moved but not claimed
    // before the tap ends; the flight guard is the third net for flings whose
    // onUpdate never ran.
    const tap = Gesture.Tap().enabled(enabled).maxDistance(NOTE_SWIPE.tapMaxDistance).maxDuration(NOTE_SWIPE.tapMaxDuration)
      .onEnd((_event, success) => {
        if (panActive.value) { panActive.value = false; return; }
        if (success && flight.value === 0) scheduleOnRN(requestRead);
        panActive.value = false;
      });
    return Gesture.Exclusive(pan, tap);
  }, [enabled, reduced, canNext, canPrevious, canCategoryFlight, screen.width, screen.height, axis, flight, generation, flightEpoch, panActive, x, y, width, opacity, onFlightStart, finishFlight, requestRead]);
  const topStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateX: reduced ? 0 : x.value }, { translateY: reduced ? 0 : y.value }, { rotate: `${reduced ? 0 : Math.max(-NOTE_SWIPE.maxTilt, Math.min(NOTE_SWIPE.maxTilt, x.value / width.value * NOTE_SWIPE.maxTilt))}deg` }] }));
  const underStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ rotate: reduced ? '0deg' : '-3deg' }, { scale: reduced ? 0.97 : 0.96 + Math.min(Math.abs(x.value) / width.value, 1) * 0.04 }, { translateY: (reduced ? 0 : y.value) + LIBRARY_SPACING.xs }] }));
  const backStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ rotate: reduced ? '0deg' : '2deg' }, { scale: 0.92 }, { translateY: (reduced ? 0 : y.value) + LIBRARY_SPACING.md }] }));
  const backgroundStyle = useAnimatedStyle(() => ({ backgroundColor: reduced ? toColor.value : interpolateColor(fade.value, [0, 1], [fromColor.value, toColor.value]) }));
  const shineStyle = useAnimatedStyle(() => ({ opacity: reduced ? 0 : Math.min(1, Math.abs(x.value) / width.value), transform: [{ translateX: x.value * 0.7 }] }));
  const dragStyle = useAnimatedStyle(() => ({ opacity: reduced ? 0 : Math.min(1, Math.abs(x.value) / (width.value * NOTE_SWIPE.horizontalFraction)) }));
  const nextHint = useAnimatedStyle(() => ({ opacity: x.value < 0 ? 1 : 0 }));
  const previousHint = useAnimatedStyle(() => ({ opacity: x.value > 0 ? 1 : 0 }));
  // Stack fills the remaining space between the position line and the button row; the card is
  // sized from that space (flex:1, small minimum) so the footer and the button row stay reachable.
  // The fallback line count is font-scale aware so the ellipsis is drawn by numberOfLines
  // (a whole number of lines) instead of a fractional-height box clipping mid-line; the
  // card body refines this with its measured height (see NoteSwipeCard).
  const fontScaleValue = typeof screen.fontScale === 'number' && Number.isFinite(screen.fontScale) && screen.fontScale >= 1
    ? screen.fontScale
    : (() => { try { const raw = PixelRatio.getFontScale?.(); return typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 ? raw : 1; } catch { return 1; } })();
  // Visible peek reserve below the top card (spacing token step, ~12dp).
  const UNDER_PEEK_STEP = LIBRARY_SPACING.sm;
  const UNDER_PEEK_RESERVE = UNDER_PEEK_STEP * 2;
  const scaledBodyLine = scaledLineHeight(LIBRARY_TEXT_BASE.bodySerif.lineHeight, fontScaleValue);
  const scaledCaptionLine = scaledLineHeight(LIBRARY_TEXT_BASE.caption.lineHeight, fontScaleValue);
  // Reserve the peek strip in the line budget so the footer stays reachable.
  const bodyLines = Math.max(1, Math.min(8, Math.floor(Math.max(0, screen.height - 280 - UNDER_PEEK_RESERVE) / scaledBodyLine)));
  // Minimum stage budgets the real scaled content: meta line + footer + paddings +
  // at least one text line, plus the stage chrome (top + bottom incl. peek reserve).
  // Footer estimates the taller of the cover thumbnail and two caption lines.
  const footerEstimate = Math.max(46, 2 * scaledCaptionLine);
  const paddingVertical = fontScaleValue >= 2 ? LIBRARY_SPACING.xs : LIBRARY_SPACING.lg;
  const hasMeta = !!card && (card.note.tag !== null || card.note.page_number !== null);
  const estimatedChrome = paddingVertical * 2 + (hasMeta ? scaledCaptionLine : 0) + LIBRARY_SPACING.sm * (hasMeta ? 2 : 1) + footerEstimate;
  const cardNeededOneLine = (measuredChrome ?? estimatedChrome) + scaledBodyLine;
  const stageChrome = LIBRARY_SPACING.lg + (LIBRARY_SPACING.xl + UNDER_PEEK_RESERVE);
  const minStage = Math.min(availableHeight ?? Infinity, Math.max(160, Math.ceil(cardNeededOneLine + stageChrome)));
  const underInner = { backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.controlBorder };
  // Undercards sit 7dp/14dp inside the top card horizontally so each edge reads as a
  // separate stacked card; the bottom insets reserve a visible strip below the top
  // card (top largest, then under-1, then under-2). Angles stay -3°/+2° and shadows
  // stay on the non-clipping outer wrapper; the strip is static so reduced-motion
  // (0° angles) keeps it visible.
  const topOuterInsets = { left: LIBRARY_SPACING.lg, right: LIBRARY_SPACING.lg, top: LIBRARY_SPACING.lg, bottom: LIBRARY_SPACING.xl + UNDER_PEEK_RESERVE };
  const underOuterOne = { left: LIBRARY_SPACING.lg + 7, right: LIBRARY_SPACING.lg + 7, top: LIBRARY_SPACING.lg, bottom: LIBRARY_SPACING.xl + UNDER_PEEK_STEP };
  const underOuterTwo = { left: LIBRARY_SPACING.lg + 14, right: LIBRARY_SPACING.lg + 14, top: LIBRARY_SPACING.lg, bottom: LIBRARY_SPACING.xl };
  return <GestureDetector gesture={gesture}><View testID="note-stack-fixed-parent" onLayout={event => { width.value = Math.max(1, event.nativeEvent.layout.width - LIBRARY_SPACING.xxl); }} style={[styles.stage, { minHeight: minStage, maxHeight: 640, maxWidth: 520, width: '100%', alignSelf: 'center' }]}>
    <Animated.View collapsable={false} testID="note-book-background" pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, backgroundStyle]} />
    <Animated.View collapsable={false} testID="note-card-slot-0" accessible={!!card} accessibilityRole={card ? 'button' : undefined}
      accessibilityLabel={card ? noteCardName(card, at, total) : undefined}
      accessibilityActions={card ? [...[{ name: 'next', label: 'Next' }, { name: 'previous', label: 'Previous' }], ...(canCategoryFlight ? [{ name: 'category', label: 'Next category' }] : []), { name: 'read', label: 'Read full note' }] : []}
      onAccessibilityAction={event => { const action = event.nativeEvent.actionName; if (action === 'next') requestMove('next'); else if (action === 'previous') requestMove('previous'); else if (action === 'category') requestCategory(); else if (action === 'read') requestRead(); }}
      focusable={false}
      {...(Platform.OS === 'web' ? { tabIndex: -1, 'data-note-deck-card': 'true', dataSet: { 'note-deck-card': 'true' } } as object : {})}
      style={[styles.slotOuter, topOuterInsets, { shadowColor: colors.shadow, zIndex: 3 }, topStyle, Platform.OS === 'web' ? { userSelect: 'none', touchAction: 'none' } as object : undefined]}>
      <Animated.View collapsable={false} testID="note-card-slot-0-inner" style={[styles.slotInner, { backgroundColor: colors.bgCard }]}>
        {card ? <NoteSwipeCard card={card} lines={bodyLines} onChromeHeight={setMeasuredChrome} /> : children}
        <Animated.View collapsable={false} testID="note-shine" pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, shineStyle]}>
          <LinearGradient colors={[colors.cardShineEdge, colors.cardShine, colors.cardShineEdge]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View collapsable={false} testID="note-drag-hint" pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" style={[styles.dragHint, dragStyle]}>
          <Animated.View collapsable={false} style={nextHint}><Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Next →</Text></Animated.View>
          <Animated.View collapsable={false} style={[StyleSheet.absoluteFill, previousHint]}><Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>← Back</Text></Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
    <Animated.View collapsable={false} testID="note-card-slot-1" pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" style={[styles.slotOuter, { shadowColor: colors.shadow, zIndex: 2 }, underOuterOne, underStyle]}>
      <Animated.View collapsable={false} testID="note-card-slot-1-inner" pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" style={[styles.slotInner, underInner]}>{undercards[0] && <NoteSwipeCard card={undercards[0]} undercard />}</Animated.View>
    </Animated.View>
    <Animated.View collapsable={false} testID="note-card-slot-2" pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" style={[styles.slotOuter, { shadowColor: colors.shadow, zIndex: 1 }, underOuterTwo, backStyle]}>
      <Animated.View collapsable={false} testID="note-card-slot-2-inner" pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" style={[styles.slotInner, underInner]}>{undercards[1] && <NoteSwipeCard card={undercards[1]} undercard />}</Animated.View>
    </Animated.View>
  </View></GestureDetector>;
}
const styles = StyleSheet.create({
  stage: { position: 'relative', overflow: 'hidden', flex: 1, justifyContent: 'center' },
  slotOuter: { position: 'absolute', top: LIBRARY_SPACING.lg, bottom: LIBRARY_SPACING.xl, left: LIBRARY_SPACING.lg, right: LIBRARY_SPACING.lg, borderRadius: LIBRARY_RADIUS.card, shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  slotInner: { flex: 1, borderRadius: LIBRARY_RADIUS.card, overflow: 'hidden' },
  dragHint: { position: 'absolute', bottom: LIBRARY_SPACING.xs, right: LIBRARY_SPACING.md },
});
