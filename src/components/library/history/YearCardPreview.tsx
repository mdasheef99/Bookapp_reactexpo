import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  PixelRatio,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LIBRARY_RADIUS, LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT, useLibraryTypography } from '../LibraryTypography';
import { BookButton } from '../ui';
import { ExportButton } from '../export/ExportNotesDialog';
import { YearCard } from './YearCard';
import type { YearQuote } from '@/features/books/history/readingStats';
import { yearCardTitle } from '@/features/books/history/readingStats';
import { PASSAGE_CARD_PIXELS, PASSAGE_CARD_REFERENCE_WIDTH } from '@/features/books/export/passageCard';
import { captureCardPng, releaseCardCapture } from '@/features/books/export/captureCard';
import { deliverImageFile, ExportUnavailableError } from '@/features/books/export/deliver';
import { buildFileName } from '@/features/books/export/fileName';

export interface YearCardPreviewProps {
  visible: boolean;
  year: number;
  books: number;
  pages: number;
  quotes: YearQuote[];
  onClose: () => void;
}

function quoteFirstLine(content: string): string {
  const line = content.split('\n')[0]?.trim() ?? '';
  if (line.length === 0) return '(No text)';
  return line.length > 80 ? `${line.slice(0, 80)}…` : line;
}

/**
 * Year-card preview + share (SDD-09 §4.7 H-18). Preview first, then share
 * through `captureCardPng` + `deliverImageFile`. Defaults to the newest
 * `quote` note of the year; the reader can pick another from that year's
 * quotes.
 */
export function YearCardPreview({ visible, year, books, pages, quotes, onClose }: YearCardPreviewProps) {
  return visible ? (
    <OpenYearCardPreview
      key={`${year}:${quotes.map((quote) => quote.id).join(',')}`}
      year={year}
      books={books}
      pages={pages}
      quotes={quotes}
      onClose={onClose}
    />
  ) : null;
}

function OpenYearCardPreview({
  year,
  books,
  pages,
  quotes,
  onClose,
}: Omit<YearCardPreviewProps, 'visible'>) {
  const colors = useLibraryAppearance();
  const fonts = useLibraryTypography();
  const { width: windowWidth } = useWindowDimensions();
  const captureCardRef = useRef<View>(null);
  const cancelRef = useRef<View>(null);
  const lifecycle = useRef({ active: true, generation: 0, inFlight: false }).current;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fontsLoaded = fonts.serif === 'LibraryGaramondMedium';
  const captureWidth = PASSAGE_CARD_PIXELS.width / PixelRatio.get();

  // Default to the newest quote of the year, whatever order arrived in.
  const newestFirst = [...quotes].sort((a, b) => {
    const time = Date.parse(b.created_at) - Date.parse(a.created_at);
    if (time !== 0) return time;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
  });
  const selected = newestFirst.find((quote) => quote.id === selectedId) ?? newestFirst[0] ?? null;

  useEffect(() => {
    lifecycle.active = true;
    lifecycle.inFlight = false;
    setBusy(false);
    setError('');
    return () => {
      lifecycle.active = false;
      lifecycle.generation++;
    };
  }, [lifecycle]);

  const close = () => {
    lifecycle.active = false;
    lifecycle.generation++;
    onClose();
  };

  const share = async () => {
    if (!lifecycle.active || lifecycle.inFlight || !fontsLoaded) return;
    lifecycle.inFlight = true;
    const attempt = lifecycle.generation;
    const isCurrent = () => lifecycle.active && lifecycle.generation === attempt;
    setBusy(true);
    setError('');
    try {
      const sourceUri = await captureCardPng(captureCardRef);
      if (!isCurrent()) {
        releaseCardCapture(sourceUri);
        return;
      }
      await deliverImageFile({
        fileName: buildFileName('year-png', { kind: 'all' }, new Date()),
        sourceUri,
      });
      if (isCurrent()) {
        lifecycle.inFlight = false;
        setBusy(false);
        close();
      }
    } catch (failure) {
      if (isCurrent()) {
        setError(
          failure instanceof ExportUnavailableError
            ? "Sharing isn't available on this device."
            : "Couldn't share. Try again.",
        );
      }
    } finally {
      if (isCurrent()) {
        lifecycle.inFlight = false;
        setBusy(false);
      }
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      accessible
      role="dialog"
      aria-modal
      accessibilityLabel="Share year card as image"
      onRequestClose={close}
      onShow={() => {
        if (Platform.OS === 'web') cancelRef.current?.focus();
        else {
          const node = findNodeHandle(cancelRef.current);
          if (node) AccessibilityInfo.setAccessibilityFocus(node);
        }
      }}
    >
      <View style={[styles.scrim, { backgroundColor: colors.overlay }]}>
        <View
          accessibilityViewIsModal
          accessibilityLabel="Share year card as image"
          style={[styles.dialog, { backgroundColor: colors.bgRaised }]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>
              Share year card as image
            </Text>
            <Text
              testID="library-year-card-preview-title"
              style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}
            >
              {yearCardTitle(year)}
            </Text>
            <YearCard
              width={Math.min(windowWidth - 2 * LIBRARY_SPACING.lg, PASSAGE_CARD_REFERENCE_WIDTH)}
              year={year}
              books={books}
              pages={pages}
              quote={selected?.content ?? null}
            />
            {newestFirst.length > 1 ? (
              <View testID="library-year-card-quote-picker" style={styles.picker}>
                <Text style={[LIBRARY_TEXT.label, { color: colors.textSecondary }]}>
                  Choose a quote
                </Text>
                {newestFirst.map((quote) => (
                  <BookButton
                    key={quote.id}
                    label={
                      quote.id === (selected?.id ?? '')
                        ? `${quoteFirstLine(quote.content)}, showing`
                        : quoteFirstLine(quote.content)
                    }
                    variant="secondary"
                    selected={quote.id === (selected?.id ?? '')}
                    onPress={() => setSelectedId(quote.id)}
                    testID={`library-year-card-quote-${quote.id}`}
                  />
                ))}
              </View>
            ) : null}
            {fontsLoaded && (
              <View
                style={styles.capture}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <YearCard
                  ref={captureCardRef}
                  width={captureWidth}
                  year={year}
                  books={books}
                  pages={pages}
                  quote={selected?.content ?? null}
                />
              </View>
            )}
            {!!error && (
              <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.body, { color: colors.error }]}>
                {error}
              </Text>
            )}
            <View style={styles.buttons}>
              <ExportButton
                label="Share image"
                variant="primary"
                busy={busy}
                disabled={busy || !fontsLoaded}
                onPress={() => {
                  void share();
                }}
              />
              <BookButton ref={cancelRef} label="Cancel" variant="text" onPress={close} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dialog: {
    width: '100%',
    maxHeight: '90%',
    maxWidth: PASSAGE_CARD_REFERENCE_WIDTH + 2 * LIBRARY_SPACING.lg,
    borderRadius: LIBRARY_RADIUS.dialog,
    padding: LIBRARY_SPACING.lg,
  },
  content: { alignItems: 'center', gap: LIBRARY_SPACING.md },
  picker: { alignSelf: 'stretch', gap: LIBRARY_SPACING.xs },
  capture: { position: 'absolute', left: -10000, top: 0 },
  buttons: { alignSelf: 'stretch', gap: LIBRARY_SPACING.xs },
});
