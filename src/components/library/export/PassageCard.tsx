import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { TextProps } from 'react-native';
import { getLibraryAppearance, LIBRARY_SPACING } from '../LibraryAppearance';
import { LIBRARY_TEXT_BASE, useLibraryTypography } from '../LibraryTypography';
import { passageCardLayout, truncateToVisible, PASSAGE_CARD_ASPECT, PASSAGE_CARD_REFERENCE_WIDTH } from '@/features/books/export/passageCard';
import type { PassageCardFit } from '@/features/books/export/passageCard';

export interface PassageCardProps {
  width: number;
  quote: string;
  title: string;
  author: string | null;
  page: number | null;
  onFit?: (fit: PassageCardFit) => void;
  fit?: PassageCardFit;
}

// Fixed capture geometry opts out of font scaling, so it reads the unscaled base scale.
const FOOTER = LIBRARY_TEXT_BASE.caption;
const TITLE_LINES = 2;
const DIVIDER_HEIGHT = 1;
const MAX_FIT_ITERATIONS = 12;
export const PASSAGE_CARD_FIT_TIMEOUT_MS = 2000;

function QuoteText({ quote, fit, onFit, scale, availableHeight, fontFamily, color }: {
  quote: string; fit?: PassageCardFit; onFit?: PassageCardProps['onFit']; scale: number;
  availableHeight: number; fontFamily: string | undefined; color: string;
}) {
  const [measurement, setMeasurement] = useState(() => ({ candidate: passageCardLayout(quote), iterations: 0, settled: false }));
  const reported = useRef(false);
  const layout = fit ?? measurement.candidate;
  const lineHeight = layout.lineHeight * scale;
  const maxLines = Math.floor(availableHeight / lineHeight);
  const settled = !!fit || measurement.settled;

  useEffect(() => {
    if (settled) return;
    const timer = setTimeout(() => {
      setMeasurement(current => current === measurement && !current.settled ? { ...current, settled: true } : current);
    }, PASSAGE_CARD_FIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [measurement, settled]);

  useEffect(() => {
    if (!fit && measurement.settled && !reported.current) {
      reported.current = true;
      onFit?.(measurement.candidate);
    }
  }, [fit, measurement, onFit]);

  const measure: TextProps['onTextLayout'] = event => {
    const lines = event.nativeEvent.lines;
    setMeasurement(current => {
      // Ignore events from an earlier candidate, or duplicate native layout events.
      if (current !== measurement || current.settled) return current;
      if (lines.length <= maxLines || current.iterations === MAX_FIT_ITERATIONS) return { ...current, settled: true };
      if (layout.fontSize > 18) {
        const [fontSize, nextLineHeight] = layout.fontSize > 22 ? [22, 31] : [18, 26];
        return { ...current, candidate: { ...layout, fontSize, lineHeight: nextLineHeight } };
      }
      // The native line text includes our opening quotation mark.
      let visiblePrefix = lines.slice(0, maxLines).map(line => line.text).join('').slice(1);
      if (current.iterations > 0) {
        const groups = layout.text.replace(/…$/u, '').match(/\P{M}\p{M}*|\p{M}+/gu) ?? [];
        const shorterPrefix = groups.slice(0, Math.max(0, groups.length - 5)).join('');
        if (shorterPrefix.length < visiblePrefix.length) visiblePrefix = shorterPrefix;
      }
      return {
        candidate: { ...layout, text: truncateToVisible(layout.text, visiblePrefix), shortened: true },
        iterations: current.iterations + 1, settled: false,
      };
    });
  };

  return <Text key={`${layout.fontSize}:${measurement.iterations}`} allowFontScaling={false}
    numberOfLines={settled ? maxLines : undefined} onTextLayout={settled ? undefined : measure}
    style={{ fontFamily, fontSize: layout.fontSize * scale, lineHeight, color }}>{`“${layout.text}”`}</Text>;
}

export const PassageCard = forwardRef<View, PassageCardProps>(function PassageCard({ width, quote, title, author, page, fit, onFit }, ref) {
  const colors = getLibraryAppearance('daylight');
  const fonts = useLibraryTypography();
  const scale = width / PASSAGE_CARD_REFERENCE_WIDTH;
  const height = width * PASSAGE_CARD_ASPECT;
  const padding = LIBRARY_SPACING.lg * scale;
  const gap = LIBRARY_SPACING.sm * scale;
  const metaGap = LIBRARY_SPACING.xs * scale;
  const footerGap = LIBRARY_SPACING.lg * scale;
  const meta = [author, page == null ? null : `p. ${page}`].filter(Boolean).join(' · ');
  const titleHeight = LIBRARY_TEXT_BASE.bodySerif.lineHeight * scale * TITLE_LINES;
  const metaHeight = meta ? (LIBRARY_TEXT_BASE.caption.lineHeight * scale + metaGap) : 0;
  const footerHeight = FOOTER.lineHeight * scale;
  const dividerHeight = DIVIDER_HEIGHT * scale;
  const availableHeight = height - padding * 2 - gap * 2 - dividerHeight - titleHeight - metaHeight - footerGap - footerHeight;

  return <View ref={ref} collapsable={false} accessible accessibilityRole="image"
    accessibilityLabel={`Quote card: ${quote}. ${title}${author ? ', ' + author : ''}`}
    style={{ width, height, padding, backgroundColor: colors.bgPrimary }}>
    <View style={{ height: availableHeight, justifyContent: 'center' }}>
      <QuoteText key={JSON.stringify([quote, width, availableHeight, fonts.serif])} quote={quote} fit={fit} onFit={onFit}
        scale={scale} availableHeight={availableHeight} fontFamily={fonts.serif} color={colors.textPrimary} />
    </View>
    <View style={{ width: LIBRARY_SPACING.xl * scale, height: dividerHeight, marginTop: gap, backgroundColor: colors.divider }} />
    <Text allowFontScaling={false} numberOfLines={TITLE_LINES}
      style={{ marginTop: gap, fontFamily: fonts.heading, fontSize: LIBRARY_TEXT_BASE.bodySerif.fontSize * scale,
        lineHeight: LIBRARY_TEXT_BASE.bodySerif.lineHeight * scale, color: colors.textPrimary }}>{title}</Text>
    {!!meta && <Text allowFontScaling={false} numberOfLines={1}
      style={{ marginTop: metaGap, fontFamily: fonts.body, fontSize: LIBRARY_TEXT_BASE.caption.fontSize * scale,
        lineHeight: LIBRARY_TEXT_BASE.caption.lineHeight * scale, color: colors.textSecondary }}>{meta}</Text>}
    <View style={{ flex: 1, minHeight: footerGap }} />
    <Text allowFontScaling={false} style={{ fontFamily: fonts.label, fontSize: FOOTER.fontSize * scale,
      lineHeight: footerHeight, color: colors.textSecondary }}>BookConnect</Text>
  </View>;
});
