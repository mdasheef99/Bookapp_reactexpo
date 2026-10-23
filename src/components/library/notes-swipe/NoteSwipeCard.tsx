import React, { useEffect, useState } from 'react';
import { Image, PixelRatio, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LIBRARY_RADIUS, LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT_BASE, scaledLineHeight } from '../LibraryTypography';
import { categoryLabel, NoteDeckCard } from '@/features/books/notes/manualNoteContract';
import { spineColorFromTitle } from '@/features/books/utils/shelfLayout';

export function noteCardName(card: NoteDeckCard, at: number, total: number) {
  const { note, book } = card;
  const visible = note.content.length > 200 ? `${note.content.slice(0, 200).trimEnd()}…` : note.content;
  return [`Note ${at + 1} of ${total}.`, note.tag ? `${categoryLabel(note.tag)}.` : '',
    `From ${book.title}${book.authors.length ? ` by ${book.authors.join(', ')}` : ''}.`,
    note.page_number === null ? '' : `Page ${note.page_number}.`, visible].filter(Boolean).join(' ');
}
export function NoteSwipeCard({ card, lines = 6, undercard = false, onChromeHeight }: {
  card: NoteDeckCard; lines?: number; undercard?: boolean; onChromeHeight?: (height: number) => void;
}) {
  const colors = useLibraryAppearance(); const { note, book } = card;
  const meta = [note.tag ? categoryLabel(note.tag) : null, note.page_number === null ? null : `p. ${note.page_number}`].filter(Boolean).join(' · ');
  // Measure the real text region so the ellipsis is drawn by numberOfLines (a whole
  // number of lines), never by a fractional-height box clipping mid-line. The line
  // budget is scaled once; native Text scales the base lineHeight itself.
  const { fontScale: windowFontScale } = useWindowDimensions();
  const [bodyHeight, setBodyHeight] = useState<number>();
  const [cardHeight, setCardHeight] = useState<number>();
  const [metaHeight, setMetaHeight] = useState<number>();
  const [footerHeight, setFooterHeight] = useState<number>();
  const [footerTextHeight, setFooterTextHeight] = useState<number>();
  const scale = typeof windowFontScale === 'number' && Number.isFinite(windowFontScale) && windowFontScale >= 1
    ? windowFontScale
    : (() => { try { const raw = PixelRatio.getFontScale?.(); return typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 ? raw : 1; } catch { return 1; } })();
  const tokenLine = scaledLineHeight(LIBRARY_TEXT_BASE.bodySerif.lineHeight, scale);
  const paddingVertical = scale >= 2 ? LIBRARY_SPACING.xs : LIBRARY_SPACING.lg;
  const metaBudget = meta ? metaHeight ?? scaledLineHeight(LIBRARY_TEXT_BASE.caption.lineHeight, scale) : 0;
  const fullFooterBudget = Math.max(styles.cover.height, footerTextHeight ?? 2 * scaledLineHeight(LIBRARY_TEXT_BASE.caption.lineHeight, scale));
  const footerBudget = footerHeight ?? fullFooterBudget;
  const chromeHeight = paddingVertical * 2 + metaBudget + footerBudget + LIBRARY_SPACING.sm * (meta ? 2 : 1);
  useEffect(() => { onChromeHeight?.(chromeHeight); }, [onChromeHeight, chromeHeight]);
  const availableBody = cardHeight === undefined ? bodyHeight : Math.max(0, Math.min(bodyHeight ?? Infinity, cardHeight - chromeHeight));
  const measured = availableBody === undefined ? undefined : Math.max(0, Math.min(12, Math.floor(availableBody / tokenLine)));
  const resolvedLines = measured ?? lines;
  // Prefer title/author and a complete note line to the decorative thumbnail.
  // Compare against the cover plus independently measured text, never the current
  // footer: hiding the cover changes that footer and used to toggle it forever.
  const compact = cardHeight !== undefined && cardHeight - paddingVertical * 2 - metaBudget - LIBRARY_SPACING.sm * (meta ? 2 : 1) - tokenLine < fullFooterBudget;
  return <View testID="note-card-paper" pointerEvents="none" importantForAccessibility="no-hide-descendants" aria-hidden onLayout={event => setCardHeight(event.nativeEvent.layout.height)} style={[styles.paper, { paddingVertical, backgroundColor: undercard ? colors.bgSecondary : colors.bgCard }]}>
    <View testID="note-spine-strip" style={[styles.spine, { backgroundColor: spineColorFromTitle(book.title) }]} />
    {note.tag === 'quote' && <Text testID="note-quote-mark" accessible={false} style={[LIBRARY_TEXT_BASE.display, styles.quote, { color: colors.textSecondary }]}>“</Text>}
    {!!meta && <Text testID="note-card-meta" onLayout={event => setMetaHeight(event.nativeEvent.layout.height)} numberOfLines={1} style={[LIBRARY_TEXT_BASE.caption, { flexShrink: 0, color: colors.textSecondary }]}>{meta}</Text>}
    <View testID="note-card-body" onLayout={event => setBodyHeight(event.nativeEvent.layout.height)} style={styles.body}>{resolvedLines > 0 && <Text numberOfLines={resolvedLines} ellipsizeMode="tail" style={[LIBRARY_TEXT_BASE.bodySerif, { color: colors.textPrimary }]}>{note.content}</Text>}</View>
    <View testID="note-card-footer" onLayout={event => setFooterHeight(event.nativeEvent.layout.height)} style={styles.footer}>
      {!compact && (book.cover_url ? <Image accessible={false} source={{ uri: book.cover_url }} style={styles.cover} />
        : <View testID="note-cover-placeholder" style={[styles.cover, { backgroundColor: colors.coverPlaceholder }]} />)}
      <View onLayout={event => setFooterTextHeight(event.nativeEvent.layout.height)} style={styles.book}><Text numberOfLines={1} style={[LIBRARY_TEXT_BASE.caption, { color: colors.textPrimary }]}>{book.title}</Text>
        <Text numberOfLines={1} style={[LIBRARY_TEXT_BASE.caption, { color: colors.textSecondary }]}>{book.authors.join(', ')}</Text></View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  paper: { flex: 1, borderRadius: LIBRARY_RADIUS.card, padding: LIBRARY_SPACING.lg, gap: LIBRARY_SPACING.sm, overflow: 'hidden' },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  quote: { position: 'absolute', top: LIBRARY_SPACING.xs, right: LIBRARY_SPACING.md, opacity: 0.16 },
  body: { flex: 1, minHeight: 0, overflow: 'hidden' },
  footer: { flexDirection: 'row', flexShrink: 0, gap: LIBRARY_SPACING.sm, alignItems: 'center' },
  cover: { width: 32, height: 46, borderRadius: 2 },
  book: { flex: 1, minWidth: 0 },
});
