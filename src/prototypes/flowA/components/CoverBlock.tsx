import React, { useEffect, useState } from 'react';
import { Image, Platform, Text, View, useWindowDimensions } from 'react-native';
import { SPACE, COVER_SIZE, NARROW_COVER_SIZE, NARROW_COVER_BELOW, MIN_TITLE_BLOCK_WIDTH, TITLE_LINE_LIMIT, styles, usePrototypeText } from '../prototypeTokens';
import type { Appearance } from '../prototypeTokens';
import type { PrototypeBook } from '../fixtures';

export const titleInitials = (title: string) => title.split(/\s+/)
    .filter(word => !/^(the|a|an|and|of|in|on|to)$/i.test(word)).slice(0, 2)
    .map(word => word[0]).join('').toUpperCase();

export function CoverBlock({ book, colors }: { book: PrototypeBook; colors: Appearance }) {
    const text = usePrototypeText();
    const { fontScale } = useWindowDimensions();
    const [rowWidth, setRowWidth] = useState(0);
    const [longTitle, setLongTitle] = useState(false);
    useEffect(() => {
        setLongTitle(false);
    }, [fontScale]);
    const narrow = rowWidth < NARROW_COVER_BELOW;
    const coverWidth = narrow ? NARROW_COVER_SIZE.width : COVER_SIZE.width;
    const stacked = longTitle || rowWidth - coverWidth - SPACE.md < MIN_TITLE_BLOCK_WIDTH;
    const coverStyle = [styles.cover, narrow && styles.narrowCover];
    return <View testID="fa-cover-row" onLayout={event => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth !== rowWidth) { setRowWidth(nextWidth); setLongTitle(false); }
    }}
        style={[styles.coverRow, stacked && styles.stacked]}>
        <View style={[styles.shadow, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>
            {book.cover ? <Image source={book.cover} accessible={false} style={coverStyle} resizeMode="cover" /> :
                <View testID="fa-cover-placeholder" accessible={false} aria-hidden importantForAccessibility="no-hide-descendants"
                    style={[coverStyle, { backgroundColor: colors.coverPlaceholder }]}>
                    <Text style={[text.heading, { color: colors.coverPlaceholderInk }]}>{titleInitials(book.title)}</Text>
                </View>}
        </View>
        <View testID="fa-title-block" style={[styles.titleBlock, stacked && styles.stackedTitle]}>
            <Text role="heading" aria-level={1} accessibilityRole="header" style={[text.title, Platform.OS === 'web' && styles.wrapWords, { color: colors.textPrimary }]}
                onLayout={event => {
                    // RN-web supports onLayout, not onTextLayout. Keep the stacked layout
                    // once measured so the narrower title cannot cause an oscillation.
                    if (!stacked && event.nativeEvent.layout.height > text.title.lineHeight * fontScale * TITLE_LINE_LIMIT) setLongTitle(true);
                }}
                onTextLayout={event => { if (event.nativeEvent.lines.length > TITLE_LINE_LIMIT) setLongTitle(true); }}>
                {book.title}
            </Text>
            <Text style={[text.body, Platform.OS === 'web' && styles.wrapWords, { color: colors.textSecondary }]}>{book.authors.join(', ')}</Text>
        </View>
    </View>;
}
