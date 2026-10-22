import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { LibraryBookEntry } from '@/features/books/utils/libraryShelf';
import { stableSeed, spineColorFromTitle, spineTextColor } from '@/features/books/utils/shelfLayout';
import { BOOK_CLOTH_TEXTURE_URI } from './bookClothTexture';
import { useLibraryAppearance } from './LibraryAppearance';
import { useLibraryTypography } from './LibraryTypography';

export function HorizontalBookVolume({ item, width, height, selected = false, arranging = false, disabled = false,
    onPress, onQuickLook, cancelSignal = 0, decorative = false, reading = false, onInteractionChange }: {
    item: LibraryBookEntry; width: number; height: number; selected?: boolean; arranging?: boolean; disabled?: boolean;
    onPress: () => void; onInteractionChange?: (item: LibraryBookEntry, source: 'hover' | 'focus', active: boolean) => void;
    onQuickLook?: () => void; cancelSignal?: number; decorative?: boolean; reading?: boolean;
}) {
    const fonts = useLibraryTypography();
    const colors = useLibraryAppearance();
    const [focused, setFocused] = React.useState(false);
    const [hovered, setHovered] = React.useState(false);
    const [pressed, setPressed] = React.useState(false);
    const cancelled = React.useRef(false);
    const consumed = React.useRef(false);
    const origin = React.useRef<{ x: number; y: number } | null>(null);
    const reduceMotion = !!useReducedMotion();
    const lift = useSharedValue(0);
    const feedback = !arranging && !disabled && !decorative && (hovered || focused || pressed);
    React.useEffect(() => { lift.value = reduceMotion ? 0 : withTiming(feedback ? -2 : 0, { duration: 150 }); }, [feedback, reduceMotion]);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
    const cancel = () => { cancelled.current = true; setPressed(false); };
    React.useEffect(() => { if (origin.current) cancel(); }, [cancelSignal, disabled, arranging]);
    const point = (event: any) => {
        const e = event.nativeEvent;
        const touch = e.touches?.[0] ?? e.changedTouches?.[0] ?? e;
        return typeof touch.pageX === 'number' && typeof touch.pageY === 'number' ? { x: touch.pageX, y: touch.pageY } : null;
    };
    const move = (event: any) => {
        const p = point(event);
        if (origin.current && p && Math.hypot(p.x - origin.current.x, p.y - origin.current.y) > 8) cancel();
    };
    const authors = item.book.authors?.filter((author) => author.trim()).join(', ');
    const authorLabel = item.book.authors?.find((author) => author.trim())?.trim().split(/\s+/).pop();
    const backgroundColor = spineColorFromTitle(item.book.title);
    const color = spineTextColor(backgroundColor);
    const seed = Math.abs(stableSeed(item.id, item.book.title));
    const hasRibs = seed % 3 !== 0;
    const paperWidth = seed % 4 === 0 ? 7 : 4;
    return <Pressable testID={`library-horizontal-book-${item.id}`} accessibilityRole="button"
        accessibilityLabel={`${arranging ? 'Select' : 'Open'} ${item.book.title}${authors ? ` by ${authors}` : ''}${reading ? ', Reading' : ''}`}
        accessible={!decorative} accessibilityElementsHidden={decorative} importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
        accessibilityHint={arranging ? 'Tap to select, then drag to move. Earlier and Later buttons are also available.' : 'Hold for a quick look. Quick look is also available in Choose a book.'}
        accessibilityState={{ disabled, selected: arranging && selected }} disabled={disabled || decorative}
        onPress={() => { if (!cancelled.current && !consumed.current) onPress(); }}
        onPressIn={(event) => { cancelled.current = false; consumed.current = false; origin.current = point(event); setPressed(true); }}
        onPressOut={() => { setPressed(false); origin.current = null; }} delayLongPress={450}
        onLongPress={() => { if (!arranging && !cancelled.current && onQuickLook) { consumed.current = true; setPressed(false); onQuickLook(); } }}
        onTouchMove={move} onTouchCancel={cancel}
        {...(Platform.OS === 'web' ? { delayPressIn: 0, onMouseMove: move,
            onContextMenu: (event: any) => { if (consumed.current) event.preventDefault(); } } : {})}
        onHoverIn={() => { setHovered(true); onInteractionChange?.(item, 'hover', true); }}
        onHoverOut={() => { setHovered(false); onInteractionChange?.(item, 'hover', false); }}
        onFocus={() => { setFocused(true); onInteractionChange?.(item, 'focus', true); }}
        onBlur={() => { setFocused(false); onInteractionChange?.(item, 'focus', false); }}
        style={{ width, height }}>
        <Animated.View pointerEvents="none" style={[styles.book, { width, height, backgroundColor }, animatedStyle,
            feedback && { shadowOpacity: 0.4, shadowRadius: 5, elevation: 5 }]}>
        <View style={styles.face}>
        <Image source={{ uri: BOOK_CLOTH_TEXTURE_URI }} contentFit="fill" accessible={false} pointerEvents="none"
            style={{ position: 'absolute', width: height, height: width, left: (width - height) / 2,
                top: (height - width) / 2, transform: [{ rotate: '90deg' }], opacity: 0.85 }} />
        <LinearGradient colors={['rgba(0,0,0,0.34)', 'rgba(255,255,255,0.24)', 'rgba(255,255,255,0.08)', 'rgba(0,0,0,0.06)', 'rgba(0,0,0,0.34)']}
            locations={[0, 0.14, 0.36, 0.74, 1]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={styles.caseInset} pointerEvents="none" />
        <View style={styles.topEdge} pointerEvents="none" />
        <View style={styles.bottomEdge} pointerEvents="none" />
        <View style={styles.binding} pointerEvents="none">
            <View style={styles.bindingRidge} />
        </View>
        {hasRibs ? [9, width - paperWidth - 14].map((left) => <LinearGradient key={left}
            colors={['rgba(255,245,220,0.28)', 'rgba(17,11,7,0.24)', 'rgba(255,255,255,0.10)']}
            locations={[0, 0.52, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.spineRib, { left }]} pointerEvents="none" />) : null}
        <View style={styles.bindingCrease} pointerEvents="none" />
        <View style={[styles.pageBlock, { width: paperWidth }]} pointerEvents="none" accessible={false}
            accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <LinearGradient colors={['#f3e8cc', '#c3ab83', '#e8d9b9']} locations={[0, 0.72, 1]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <View style={[styles.pageRule, { top: '24%' }]} />
            <View style={[styles.pageRule, { top: '51%' }]} />
            <View style={[styles.pageRule, { top: '78%' }]} />
        </View>
        <Text numberOfLines={1} style={[styles.title, { color, backgroundColor, fontFamily: fonts.serif }]}>{item.book.title}</Text>
        {authors && width >= 220 ? <Text numberOfLines={1} style={[styles.author, { color, backgroundColor, fontFamily: fonts.label }]}>
            {authorLabel}
        </Text> : null}
        {selected || focused ? <View style={styles.outline} pointerEvents="none" accessible={false} /> : reading && !decorative ? <>
          <View testID={`library-horizontal-reading-outline-${item.id}`} style={[styles.readingOuter, { borderColor: colors.readingOutline }]} pointerEvents="none" accessible={false} />
          <View testID={`library-horizontal-reading-outline-inner-${item.id}`} style={[styles.readingInner, { borderColor: colors.readingOutlineInner }]} pointerEvents="none" accessible={false} />
        </> : null}
        </View>
        </Animated.View>
    </Pressable>;
}

const styles = StyleSheet.create({
    book: { borderTopLeftRadius: 6, borderBottomLeftRadius: 5, borderTopRightRadius: 2, borderBottomRightRadius: 2,
        shadowColor: '#170f08', shadowOffset: { width: 1, height: 2 }, shadowRadius: 2, shadowOpacity: 0.42, elevation: 3 },
    face: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', paddingLeft: 17, paddingRight: 19, gap: 7,
        borderTopLeftRadius: 6, borderBottomLeftRadius: 5, borderTopRightRadius: 2, borderBottomRightRadius: 2,
        borderWidth: 1, borderColor: 'rgba(0,0,0,0.28)', overflow: 'hidden' },
    title: { fontSize: 16, lineHeight: 20, flex: 1, minWidth: 0 },
    author: { fontSize: 9, lineHeight: 12, width: 52, maxWidth: '28%', flexShrink: 0,
        textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.6 },
    caseInset: { ...StyleSheet.absoluteFillObject, margin: 1, borderRadius: 2, borderWidth: 0.75, borderColor: 'rgba(255,246,222,0.16)' },
    binding: { width: 4, height: 18, borderRadius: 1, backgroundColor: '#b89452', justifyContent: 'center', overflow: 'hidden' },
    bindingRidge: { position: 'absolute', left: 1, top: 1, bottom: 1, width: 1, backgroundColor: 'rgba(255,238,188,0.58)' },
    spineRib: { position: 'absolute', top: 3, bottom: 3, width: 3 },
    bindingCrease: { position: 'absolute', left: 3, top: 5, bottom: 5, width: 1, backgroundColor: 'rgba(0,0,0,0.32)' },
    topEdge: { position: 'absolute', left: 2, right: 1, top: 1, height: 2, borderTopWidth: 1,
        borderTopColor: 'rgba(255,243,209,0.44)', backgroundColor: 'rgba(0,0,0,0.16)' },
    bottomEdge: { position: 'absolute', left: 1, right: 1, bottom: 0, height: 3, borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.52)', backgroundColor: 'rgba(0,0,0,0.22)' },
    pageBlock: { position: 'absolute', top: 2, bottom: 2, right: 2, width: 4, backgroundColor: '#e9dcc0',
        borderLeftWidth: 1, borderLeftColor: 'rgba(79,53,31,0.38)', borderRightWidth: 1, borderRightColor: 'rgba(255,250,231,0.44)' },
    pageRule: { position: 'absolute', left: 0, right: 0, height: 0.7, backgroundColor: 'rgba(104,78,47,0.32)' },
    outline: { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderRadius: 3, borderColor: '#c5a059' },
    // SDD-09 Unit 2b fix: own two-tone reading ring, thicker outer + inset inner so it
    // differs from the arranging selection by weight and inset, not hue alone.
    readingOuter: { ...StyleSheet.absoluteFillObject, borderWidth: 3, borderRadius: 5 },
    readingInner: { ...StyleSheet.absoluteFillObject, margin: 4, borderWidth: 2, borderRadius: 2 },
});
