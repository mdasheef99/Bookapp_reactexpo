import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NoteDeckCard, noteKeys } from '@/features/books/notes/manualNoteContract';
import { dailyNoteSeed, deckOrder } from '@/features/books/notes/noteDeck';
import { loadDeckCards } from '@/features/books/notes/noteDeckCache';
import { noteWasDeleted } from '@/features/books/notes/useManualNotes';
import { useNoteDeckIndex } from '@/features/books/notes/useNoteDeck';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { useReducedNoteMotion } from './useNoteSwipeMotion';

/** Binary search the next day boundary in an explicit zone, including 23/25-hour DST days. */
export function nextNoteDayDelay(zone: string, now: Date) {
  const day = dailyNoteSeed(zone, now); const start = now.getTime();
  let low = start; let high = start + 27 * 60 * 60 * 1000;
  while (high - low > 1000) { const middle = Math.floor((low + high) / 2); if (dailyNoteSeed(zone, new Date(middle)) === day) low = middle; else high = middle; }
  return Math.max(1000, high - start);
}
export function NoteSwipeHomeTile({ actorId, hidden = false, onPress }: { actorId: string; hidden?: boolean; onPress: () => void }) {
  const colors = useLibraryAppearance(); const reduced = useReducedNoteMotion(); const client = useQueryClient();
  const [day, setDay] = useState(() => dailyNoteSeed(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone; const now = new Date();
      setDay(dailyNoteSeed(zone, now)); clearTimeout(timer); timer = setTimeout(refresh, nextNoteDayDelay(zone, now));
    };
    refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('focus', refresh);
    return () => { clearTimeout(timer); subscription?.remove?.(); if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('focus', refresh); };
  }, []);
  const index = useNoteDeckIndex(actorId, { kind: 'all' }, !hidden);
  const rows = useMemo(() => (index.data ?? []).filter(row => !noteWasDeleted(client, actorId, row.user_book_id, row.id)), [index.data, client, actorId]);
  const id = useMemo(() => deckOrder(rows, 'shuffle', day)[0]?.id, [rows, day]);
  const query = useQuery<NoteDeckCard>({ queryKey: noteKeys.deckCard(actorId, id ?? ''), enabled: !!actorId && !!id && !hidden,
    queryFn: async ({ signal }) => {
      const cards = await loadDeckCards(client, actorId, [id!], signal);
      const card = cards.find(c => c.note.id === id); if (!card) throw new Error('Note unavailable.'); return card;
    }, retry: false, staleTime: Infinity });
  if (hidden || index.isPending || index.isError || query.isPending || query.isError || !id || !query.data) return null;
  const countLabel = `Your notes · ${rows.length} ${rows.length === 1 ? 'note' : 'notes'}`;
  return <Pressable testID="note-swipe-home-tile" accessibilityRole="button" accessibilityLabel={`${countLabel}. ${query.data.note.content}. ${query.data.book.title}`} onPress={onPress} style={styles.tile}>
    <View pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" testID="note-home-underclip" style={[styles.underClip]}>
      <View pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" testID="note-home-under-0" style={[styles.under, styles.under0, { backgroundColor: colors.bgCard, shadowColor: colors.shadow, transform: [{ rotate: reduced ? '0deg' : '-3deg' }] }]} />
      <View pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" testID="note-home-under-1" style={[styles.under, styles.under1, { backgroundColor: colors.bgCard, shadowColor: colors.shadow, transform: [{ rotate: reduced ? '0deg' : '2deg' }] }]} />
    </View>
    <View style={[styles.front, { backgroundColor: colors.bgCard }]}>
      <Text numberOfLines={1} style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{countLabel}</Text>
      <Text numberOfLines={2} style={[LIBRARY_TEXT.bodySerif, { color: colors.textPrimary }]}>{query.data.note.content}</Text>
      <Text numberOfLines={1} style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{query.data.book.title}</Text>
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  // Reserve room inside the tile so the two undercard edges show below/aside the
  // front card, bounded inside the tile box (no negative margins, overflow hidden).
  tile: { minHeight: MIN_TARGET, marginVertical: LIBRARY_SPACING.md, marginHorizontal: LIBRARY_SPACING.xs, paddingHorizontal: LIBRARY_SPACING.xs, paddingBottom: LIBRARY_SPACING.xs, overflow: 'hidden', borderRadius: LIBRARY_RADIUS.card },
  underClip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', borderRadius: LIBRARY_RADIUS.card },
  under: { ...StyleSheet.absoluteFillObject, borderRadius: LIBRARY_RADIUS.card, shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  under0: { left: LIBRARY_SPACING.xxs, right: LIBRARY_SPACING.xxs, top: LIBRARY_SPACING.xxs / 2, bottom: LIBRARY_SPACING.xxs, zIndex: 2 },
  under1: { left: 0, right: 0, top: 0, bottom: LIBRARY_SPACING.xxs / 2, zIndex: 1 },
  front: { minHeight: MIN_TARGET, borderRadius: LIBRARY_RADIUS.card, padding: LIBRARY_SPACING.md, gap: LIBRARY_SPACING.xs },
});
