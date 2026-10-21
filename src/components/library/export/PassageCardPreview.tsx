import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, PixelRatio, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LIBRARY_RADIUS, LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT, useLibraryTypography } from '../LibraryTypography';
import { BookButton } from '../ui';
import { ExportButton } from './ExportNotesDialog';
import { PassageCard } from './PassageCard';
import type { PassageCardProps } from './PassageCard';
import { buildFileName } from '@/features/books/export/fileName';
import { passageCardLayout, PASSAGE_CARD_PIXELS, PASSAGE_CARD_REFERENCE_WIDTH } from '@/features/books/export/passageCard';
import type { PassageCardFit } from '@/features/books/export/passageCard';
import { captureCardPng, releaseCardCapture } from '@/features/books/export/captureCard';
import { deliverImageFile, ExportUnavailableError } from '@/features/books/export/deliver';

export interface PassageCardPreviewProps extends Omit<PassageCardProps, 'width' | 'fit' | 'onFit'> {
  visible: boolean;
  onClose: () => void;
}

export function PassageCardPreview(props: PassageCardPreviewProps) {
  // Each opening/quote owns its fit and pending work. Old promises retain only the old session.
  return props.visible ? <OpenPassageCardPreview key={props.quote} {...props} /> : null;
}

function OpenPassageCardPreview({ onClose, quote, title, author, page }: PassageCardPreviewProps) {
  const colors = useLibraryAppearance();
  const fonts = useLibraryTypography();
  const { width: windowWidth } = useWindowDimensions();
  const captureCardRef = useRef<View>(null);
  const cancelRef = useRef<View>(null);
  const lifecycle = useRef({ active: true, generation: 0, inFlight: false }).current;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fontsLoaded = fonts.serif === 'LibraryGaramondMedium';
  const captureWidth = PASSAGE_CARD_PIXELS.width / PixelRatio.get();
  const fitKey = JSON.stringify([quote, captureWidth, fonts.serif, author, page]);
  const [reportedFit, setReportedFit] = useState<{ key: string; fit: PassageCardFit } | null>(null);
  const fit = reportedFit?.key === fitKey ? reportedFit.fit : undefined;
  useEffect(() => {
    lifecycle.active = true;
    lifecycle.inFlight = false;
    setBusy(false); setError('');
    return () => { lifecycle.active = false; lifecycle.generation++; };
  }, [lifecycle]);
  useEffect(() => {
    // New card inputs remount the capture surface; an attempt against the old one must not finish.
    setBusy(false);
    setError('');
    return () => { lifecycle.generation++; lifecycle.inFlight = false; };
  }, [fitKey, lifecycle]);
  const close =() => { lifecycle.active = false; lifecycle.generation++; onClose(); };
  const share = async () => {
    if (!lifecycle.active || lifecycle.inFlight || !fontsLoaded || !fit) return;
    lifecycle.inFlight = true;
    const attempt = lifecycle.generation;
    const isCurrent = () => lifecycle.active && lifecycle.generation === attempt;
    setBusy(true); setError('');
    try {
      const sourceUri = await captureCardPng(captureCardRef);
      if (!isCurrent()) { releaseCardCapture(sourceUri); return; }
      await deliverImageFile({ fileName: buildFileName('quote-png', { kind: 'book', title }, new Date()), sourceUri });
      if (isCurrent()) {
        lifecycle.inFlight = false;
        setBusy(false);
        close();
      }
    } catch (failure) {
      if (isCurrent()) setError(failure instanceof ExportUnavailableError
        ? "Sharing isn't available on this device." : "Couldn't share. Try again.");
    } finally {
      if (isCurrent()) { lifecycle.inFlight = false; setBusy(false); }
    }
  };

  return <Modal visible transparent animationType="fade" accessible role="dialog" aria-modal
    accessibilityLabel="Share quote as image" onRequestClose={close}
    onShow={() => {
      if (Platform.OS === 'web') cancelRef.current?.focus();
      else {
        const node = findNodeHandle(cancelRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }
    }}>
    <View style={[styles.scrim, { backgroundColor: colors.overlay }]}>
      <View accessibilityViewIsModal accessibilityLabel="Share quote as image"
        style={[styles.dialog, { backgroundColor: colors.bgRaised }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>Share quote as image</Text>
          <PassageCard width={Math.min(windowWidth - 2 * LIBRARY_SPACING.lg, PASSAGE_CARD_REFERENCE_WIDTH)}
            quote={quote} title={title} author={author} page={page} fit={fit ?? passageCardLayout(quote)} />
          {fontsLoaded && <View style={styles.capture} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <PassageCard key={fitKey} ref={captureCardRef} width={captureWidth} quote={quote} title={title} author={author} page={page}
              onFit={value => setReportedFit({ key: fitKey, fit: value })} />
          </View>}
          {fit?.shortened && <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Shortened to fit the card.</Text>}
          {!!error && <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.body, { color: colors.error }]}>{error}</Text>}
          <View style={styles.buttons}>
            <ExportButton label="Share image" variant="primary" busy={busy} disabled={busy || !fontsLoaded || !fit} onPress={() => { void share(); }} />
            <BookButton ref={cancelRef} label="Cancel" variant="text" onPress={close} />
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dialog: { width: '100%', maxHeight: '90%', maxWidth: PASSAGE_CARD_REFERENCE_WIDTH + 2 * LIBRARY_SPACING.lg,
    borderRadius: LIBRARY_RADIUS.dialog, padding: LIBRARY_SPACING.lg },
  content: { alignItems: 'center', gap: LIBRARY_SPACING.md },
  capture: { position: 'absolute', left: -10000, top: 0 },
  buttons: { alignSelf: 'stretch', gap: LIBRARY_SPACING.xs },
});
