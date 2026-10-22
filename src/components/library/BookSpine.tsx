import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LibraryBookEntry } from '@/features/books/utils/libraryShelf';
import { stableSeed, spineMetrics, spineColorFromTitle, spineTextColor, spineDividerVariant } from '@/features/books/utils/shelfLayout';
import { useLibraryTypography } from './LibraryTypography';
import { BOOK_CLOTH_TEXTURE_URI } from './bookClothTexture';

export function BookSpine({ item, onPress, isReduceMotion, playTak, onInteractionChange, tiltDeg = 0, swept = false, gapAfter = 0, arranging = false, selected = false, reading = false, testID }: {
    item: LibraryBookEntry;
    index: number;
    onPress: () => void;
    isReduceMotion: boolean;
    playTak: () => void;
    onInteractionChange?: (item: LibraryBookEntry, active: boolean) => void;
    tiltDeg?: number;
    swept?: boolean;
    gapAfter?: number;
    arranging?: boolean;
    selected?: boolean;
    reading?: boolean;
    testID?: string;
}) {
    const fonts = useLibraryTypography();
    const [hovered, setHovered] = React.useState(false);
    const [focused, setFocused] = React.useState(false);
    const [pressed, setPressed] = React.useState(false);
    const interactionState = React.useRef({ hovered: false, focused: false, pressed: false });
    const isInteractionActive = hovered || focused || pressed;
    const pullScale = useSharedValue(1);
    const pullTranslateY = useSharedValue(0);
    const pullRotateY = useSharedValue(0);
    const pullShadowDelta = useSharedValue(0);
    const sweepLift = useSharedValue(0);
    React.useEffect(() => {
        sweepLift.value = isReduceMotion || arranging ? 0 : withTiming(swept || hovered || focused ? 1 : 0, { duration: 120 });
    }, [swept, hovered, focused, isReduceMotion, arranging]);

    const updateInteractionState = React.useCallback((key: keyof typeof interactionState.current, value: boolean) => {
        const next = { ...interactionState.current, [key]: value };
        interactionState.current = next;
        onInteractionChange?.(item, next.hovered || next.focused || next.pressed);
    }, [item, onInteractionChange]);

    const handleHoverIn = () => { setHovered(true); updateInteractionState('hovered', true); };
    const handleHoverOut = () => { setHovered(false); updateInteractionState('hovered', false); };
    const handleFocus = () => { setFocused(true); updateInteractionState('focused', true); };
    const handleBlur = () => { setFocused(false); updateInteractionState('focused', false); };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: arranging ? [] : [
            { perspective: 600 }, { rotate: `${tiltDeg}deg` }, { rotateY: `${pullRotateY.value}deg` },
            { translateY: pullTranslateY.value - sweepLift.value * 6 },
            { scale: pullScale.value * (1 + sweepLift.value * 0.06) },
        ],
        zIndex: pullTranslateY.value < 0 || sweepLift.value > 0 ? 10 : 1,
        shadowOpacity: 0.35 + pullShadowDelta.value,
    }));

    const handlePressIn = () => {
        setPressed(true);
        updateInteractionState('pressed', true);
        if (isReduceMotion || arranging) return;
        const easing = Easing.bezier(0.34, 1.56, 0.64, 1);
        pullScale.value = withTiming(1.15, { duration: 220, easing });
        pullTranslateY.value = withTiming(-18, { duration: 220, easing });
        pullRotateY.value = withTiming(6, { duration: 220, easing });
        pullShadowDelta.value = withTiming(0.2, { duration: 220, easing });
        playTak();
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    };
    const handlePressOut = () => {
        setPressed(false);
        updateInteractionState('pressed', false);
        pullScale.value = isReduceMotion ? 1 : withTiming(1, { duration: 220 });
        pullTranslateY.value = isReduceMotion ? 0 : withTiming(0, { duration: 220 });
        pullRotateY.value = isReduceMotion ? 0 : withTiming(0, { duration: 220 });
        pullShadowDelta.value = isReduceMotion ? 0 : withTiming(0, { duration: 220 });
    };

    const seed = stableSeed(item.id, item.book.title);
    const { width, height } = spineMetrics(seed, item.book.page_count);
    const backgroundColor = spineColorFromTitle(item.book.title);
    const color = spineTextColor(backgroundColor);
    const divider = spineDividerVariant(seed);
    const showSpineRibs = Math.abs(seed) % 3 !== 0;
    const showPageEdge = Math.abs(seed) % 4 === 0;
    const upperRibTop = Math.round(height * 0.15);
    const lowerRibTop = Math.round(height * 0.84);
    const fontSize = width >= 40 ? 17 : width >= 36 ? 16 : 15;
    const lineHeight = fontSize * 1.1;
    const textWidth = height - 24;

    return (
        <Animated.View style={[styles.animatedWrap, { marginRight: gapAfter }, animatedStyle]}>
            <Pressable
                onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}
                onHoverIn={handleHoverIn} onHoverOut={handleHoverOut}
                onFocus={handleFocus} onBlur={handleBlur}
                accessibilityRole="button"
                accessibilityLabel={`${arranging ? 'Select' : 'Open'} ${item.book.title}${item.book.authors?.[0] ? ` by ${item.book.authors[0]}` : ''}${reading ? ', Reading' : ''}`}
                accessibilityState={arranging ? { selected } : undefined}
                accessibilityHint={arranging ? 'Select, then drag this book or use the Earlier and Later controls below the shelf' : undefined}
                testID={testID ?? `library-shelf-spine-${item.id}`}
                style={[styles.spine, { backgroundColor, width, height }]}
            >
                <Image source={{ uri: BOOK_CLOTH_TEXTURE_URI }} style={StyleSheet.absoluteFill} contentFit="fill" pointerEvents="none" accessible={false} />
                <LinearGradient colors={['rgba(0,0,0,0.36)', 'rgba(255,255,255,0.23)', 'rgba(255,255,255,0.08)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.32)']}
                    locations={[0, 0.12, 0.34, 0.72, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
                {showPageEdge ? <View testID={`library-shelf-page-edge-${item.id}`} style={styles.pageEdge}
                    pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <LinearGradient colors={['rgba(249,239,216,0.84)', 'rgba(184,156,116,0.72)']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                    <View style={[styles.pageRule, { top: '23%' }]} />
                    <View style={[styles.pageRule, { top: '51%' }]} />
                    <View style={[styles.pageRule, { top: '78%' }]} />
                </View> : null}
                <View style={styles.bindingCrease} pointerEvents="none" />
                {showSpineRibs ? <>
                    <View testID={`library-shelf-spine-ridge-upper-${item.id}`} style={[styles.spineRidge, { top: upperRibTop }]}
                        pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                        <LinearGradient colors={['rgba(255,245,220,0.24)', 'rgba(17,11,7,0.20)', 'rgba(255,255,255,0.10)']}
                            locations={[0, 0.52, 1]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
                    </View>
                    <View testID={`library-shelf-spine-ridge-lower-${item.id}`} style={[styles.spineRidge, { top: lowerRibTop }]}
                        pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                        <LinearGradient colors={['rgba(255,245,220,0.20)', 'rgba(17,11,7,0.18)', 'rgba(255,255,255,0.08)']}
                            locations={[0, 0.52, 1]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
                    </View>
                </> : null}
                <LinearGradient colors={['transparent', 'rgba(16,10,6,0.46)']} style={styles.footShade} pointerEvents="none" />
                <View style={styles.bindingTop} pointerEvents="none" />
                {divider ? <View pointerEvents="none" style={[styles.bindingBand, { height: divider.height, width: divider.width as `${number}%`, backgroundColor: divider.color }]} /> : null}
                {/* Keep texture/edge lighting behind an opaque label region for measured title contrast. */}
                <View pointerEvents="none" testID={`library-shelf-label-${item.id}`} style={[styles.labelFrame, { backgroundColor, width: textWidth, height: lineHeight, left: (width - textWidth) / 2, top: (height - lineHeight) / 2 }]}>
                    <Text numberOfLines={1} ellipsizeMode="tail"
                        style={[styles.title, { fontFamily: fonts.serif, color, fontSize, lineHeight }]}>
                        {item.book.title}
                    </Text>
                </View>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    animatedWrap: { transformOrigin: '50% 100%', shadowColor: '#160e08', shadowOffset: { width: 2, height: 1 }, shadowRadius: 1.5, elevation: 4 },
    spine: {
        borderTopLeftRadius: 5, borderTopRightRadius: 4,
        borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.18)',
        borderRightWidth: 1, borderRightColor: 'rgba(0,0,0,0.22)',
        borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.24)',
        overflow: 'hidden', flexShrink: 0,
    },
    pageEdge: { position: 'absolute', top: 2, bottom: 2, right: 1, width: 2 },
    pageRule: { position: 'absolute', left: 0, right: 0, height: 0.5, backgroundColor: 'rgba(79,53,31,0.28)' },
    bindingTop: { position: 'absolute', left: 0, right: 0, top: 4, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
    bindingCrease: { position: 'absolute', left: 2, top: 5, bottom: 3, width: 1, backgroundColor: 'rgba(0,0,0,0.23)' },
    spineRidge: { position: 'absolute', left: 1, right: 1, height: 3, opacity: 0.72 },
    footShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4 },
    bindingBand: { position: 'absolute', top: 16, alignSelf: 'center', opacity: 0.8 },
    // Rotate the sized frame, so Text's web max-width is the label length, not the narrow spine.
    labelFrame: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
    title: { width: '100%', textAlign: 'center', includeFontPadding: false },
});
