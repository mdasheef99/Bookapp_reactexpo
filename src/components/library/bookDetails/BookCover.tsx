import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import {
  COVER_RADIUS,
  COVER_SIZE,
  MIN_TITLE_BLOCK_WIDTH,
  NARROW_COVER_BELOW,
  NARROW_COVER_SIZE,
  TITLE_LINE_LIMIT,
} from './bookDetailsTokens';

export function bookTitleInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const filtered = words.filter((word) => !/^(the|a|an|and|of|in|on|to)$/i.test(word));
  return (filtered.length > 0 ? filtered : words)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

interface BookCoverProps {
  title: string;
  authors: string[];
  coverUrl: string | null | undefined;
}

export function BookCover({ title, authors, coverUrl }: BookCoverProps) {
  const colors = useLibraryAppearance();
  const { fontScale } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(0);
  const [longTitle, setLongTitle] = useState(false);

  useEffect(() => {
    setLongTitle(false);
  }, [fontScale, title]);

  const narrow = rowWidth < NARROW_COVER_BELOW;
  const coverWidth = narrow ? NARROW_COVER_SIZE.width : COVER_SIZE.width;
  const stacked = longTitle || rowWidth - coverWidth - LIBRARY_SPACING.md < MIN_TITLE_BLOCK_WIDTH;
  const coverStyle = [styles.cover, narrow && styles.narrowCover];

  return (
    <View
      testID="book-cover-row"
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth !== rowWidth) {
          setRowWidth(nextWidth);
          setLongTitle(false);
        }
      }}
      style={[styles.coverRow, stacked && styles.stacked]}
    >
      <View style={[styles.shadow, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} accessible={false} style={coverStyle} contentFit="cover" />
        ) : (
          <View
            testID="book-cover-placeholder"
            accessible={false}
            aria-hidden
            importantForAccessibility="no-hide-descendants"
            style={[coverStyle, { backgroundColor: colors.coverPlaceholder }]}
          >
            <Text style={[LIBRARY_TEXT.heading, { color: colors.coverPlaceholderInk }]}>
              {bookTitleInitials(title)}
            </Text>
          </View>
        )}
      </View>
      <View testID="book-title-block" style={[styles.titleBlock, stacked && styles.stackedTitle]}>
        <Text
          role="heading"
          aria-level={1}
          accessibilityRole="header"
          style={[LIBRARY_TEXT.title, Platform.OS === 'web' && styles.wrapWords, { color: colors.textPrimary }]}
          onLayout={(event) => {
            if (!stacked && event.nativeEvent.layout.height > LIBRARY_TEXT.title.lineHeight * fontScale * TITLE_LINE_LIMIT) {
              setLongTitle(true);
            }
          }}
          onTextLayout={(event) => {
            if (event.nativeEvent.lines.length > TITLE_LINE_LIMIT) setLongTitle(true);
          }}
        >
          {title}
        </Text>
        <Text style={[LIBRARY_TEXT.body, Platform.OS === 'web' && styles.wrapWords, { color: colors.textSecondary }]}>
          {authors.join(', ')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  coverRow: {
    flexDirection: 'row',
    minWidth: 0,
    maxWidth: '100%',
    alignItems: 'flex-start',
    gap: LIBRARY_SPACING.md,
    marginBottom: LIBRARY_SPACING.md,
  },
  stacked: {
    flexDirection: 'column',
  },
  stackedTitle: {
    width: '100%',
  },
  cover: {
    width: COVER_SIZE.width,
    height: COVER_SIZE.height,
    borderRadius: COVER_RADIUS,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  narrowCover: {
    width: NARROW_COVER_SIZE.width,
    height: NARROW_COVER_SIZE.height,
  },
  shadow: {
    borderRadius: COVER_RADIUS,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: LIBRARY_SPACING.xs,
    elevation: 2,
  },
  titleBlock: {
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 0,
    gap: LIBRARY_SPACING.xs,
  },
  wrapWords: {
    minWidth: 0,
    maxWidth: '100%',
    wordBreak: 'normal',
    wordWrap: 'normal',
    overflowWrap: 'normal',
  } as Record<string, unknown>,
});
