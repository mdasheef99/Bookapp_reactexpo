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

export function BookSpine({ item, onPress, isReduceMotion, playTak, onInteractionChange, tiltDeg = 0, swept = false, gapAfter = 0 }: {
    item: LibraryBookEntry;
    index: number;
    onPress: () => void;
    isReduceMotion: boolean;
    playTak: () => void;
    onInteractionChange?: (item: LibraryBookEntry, active: boolean) => void;
    tiltDeg?: number;
    swept?: boolean;
    gapAfter?: number;
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
        sweepLift.value = isReduceMotion ? 0 : withTiming(swept || hovered || focused ? 1 : 0, { duration: 120 });
    }, [swept, hovered, focused, isReduceMotion]);

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
        transform: [
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
        if (isReduceMotion) return;
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
                accessibilityLabel={`Open ${item.book.title}${item.book.authors?.[0] ? ` by ${item.book.authors[0]}` : ''}`}
                testID={`library-shelf-spine-${item.id}`}
                style={[styles.spine, { backgroundColor, width, height }]}
            >
                <Image source={{ uri: BOOK_CLOTH_TEXTURE_URI }} style={StyleSheet.absoluteFill} contentFit="fill" pointerEvents="none" accessible={false} />
                <LinearGradient colors={['rgba(0,0,0,0.28)', 'rgba(255,255,255,0.25)', 'rgba(255,255,255,0.07)', 'transparent', 'rgba(0,0,0,0.38)']}
                    locations={[0, 0.16, 0.38, 0.68, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
                <View style={styles.bindingCrease} pointerEvents="none" />
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
    bindingTop: { position: 'absolute', left: 0, right: 0, top: 4, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
    bindingCrease: { position: 'absolute', left: 2, top: 5, bottom: 3, width: 1, backgroundColor: 'rgba(0,0,0,0.23)' },
    footShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4 },
    bindingBand: { position: 'absolute', top: 16, alignSelf: 'center', opacity: 0.8 },
    // Rotate the sized frame, so Text's web max-width is the label length, not the narrow spine.
    labelFrame: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
    title: { width: '100%', textAlign: 'center', includeFontPadding: false },
});
