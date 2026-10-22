import React, { forwardRef } from 'react';
import { Text, View } from 'react-native';
import { getLibraryAppearance, LIBRARY_SPACING } from '../LibraryAppearance';
import { LIBRARY_TEXT, useLibraryTypography } from '../LibraryTypography';
import { yearCardTitle } from '@/features/books/history/readingStats';
import { PASSAGE_CARD_ASPECT, PASSAGE_CARD_REFERENCE_WIDTH } from '@/features/books/export/passageCard';

export interface YearCardProps {
  width: number;
  year: number;
  books: number;
  pages: number;
  quote: string | null;
}

const FOOTER = LIBRARY_TEXT.caption;
const DIVIDER_HEIGHT = 1;

/**
 * Year-in-review card (SDD-09 §4.7 H-18), modelled on the SDD-08 passage
 * card: text-led, fixed aspect for PNG capture, daylight appearance and the
 * small BookConnect footer (D08-07 style).
 */
export const YearCard = forwardRef<View, YearCardProps>(function YearCard(
  { width, year, books, pages, quote },
  ref,
) {
  const colors = getLibraryAppearance('daylight');
  const fonts = useLibraryTypography();
  const scale = width / PASSAGE_CARD_REFERENCE_WIDTH;
  const height = width * PASSAGE_CARD_ASPECT;
  const padding = LIBRARY_SPACING.lg * scale;
  const gap = LIBRARY_SPACING.sm * scale;
  const footerGap = LIBRARY_SPACING.lg * scale;
  const footerHeight = FOOTER.lineHeight * scale;
  const dividerHeight = DIVIDER_HEIGHT * scale;
  const title = yearCardTitle(year);
  const booksLine = `${books} ${books === 1 ? 'book' : 'books'} finished`;
  const pagesLine = `${pages} ${pages === 1 ? 'page' : 'pages'} read`;
  const label = `Year card: ${title}. ${booksLine}. ${pagesLine}.${quote ? ` Quote: ${quote}` : ''}`;

  return (
    <View
      ref={ref}
      collapsable={false}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID="library-year-card"
      style={{ width, height, padding, backgroundColor: colors.bgPrimary }}
    >
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: fonts.heading,
          fontSize: LIBRARY_TEXT.title.fontSize * scale,
          lineHeight: LIBRARY_TEXT.title.lineHeight * scale,
          color: colors.textPrimary,
        }}
      >
        {title}
      </Text>
      <Text
        allowFontScaling={false}
        testID="library-year-card-stats"
        style={{
          marginTop: gap,
          fontFamily: fonts.body,
          fontSize: LIBRARY_TEXT.body.fontSize * scale,
          lineHeight: LIBRARY_TEXT.body.lineHeight * scale,
          color: colors.textPrimary,
        }}
      >
        {`${booksLine} · ${pagesLine}`}
      </Text>
      <View
        style={{
          width: LIBRARY_SPACING.xl * scale,
          height: dividerHeight,
          marginTop: gap,
          backgroundColor: colors.divider,
        }}
      />
      {quote ? (
        <Text
          allowFontScaling={false}
          numberOfLines={8}
          testID="library-year-card-quote"
          style={{
            marginTop: gap,
            fontFamily: fonts.serif,
            fontSize: LIBRARY_TEXT.bodySerif.fontSize * scale,
            lineHeight: LIBRARY_TEXT.bodySerif.lineHeight * scale,
            color: colors.textPrimary,
          }}
        >
          {`“${quote}”`}
        </Text>
      ) : null}
      <View style={{ flex: 1, minHeight: footerGap }} />
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: fonts.label,
          fontSize: FOOTER.fontSize * scale,
          lineHeight: footerHeight,
          color: colors.textSecondary,
        }}
      >
        BookConnect
      </Text>
    </View>
  );
});
