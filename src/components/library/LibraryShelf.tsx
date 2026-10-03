import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { GestureDetector } from 'react-native-gesture-handler';
import { ShelfArrangement } from '@/features/books/hooks/useShelfArrangement';
import { LibraryBookEntry } from '@/features/books/utils/libraryShelf';
import { getShelfTrackLayout, splitShelfRows, resolveSweptSpine, SHELF_SIDE_WIDTH, SHELF_BOOKEND_WIDTH } from '@/features/books/utils/shelfLayout';
import { BookSpine } from './BookSpine';
import { LibraryBookPicker } from './LibraryBookPicker';
import { useLibraryTypography } from './LibraryTypography';
import { LIBRARY_RADIUS, LIBRARY_SPACING } from './LibraryAppearance';
import { CABINET_WOOD_TEXTURE_URI } from './cabinetWoodTexture';
import { useVerticalShelfDrag } from './useVerticalShelfDrag';
import { LibraryArrangeSelection } from './LibraryArrangeControls';

type LibraryShelfProps = {
    books: LibraryBookEntry[];
    onBookPress: (item: LibraryBookEntry) => void;
    arrangement?: ShelfArrangement;
    onDraggingChange?: (active: boolean) => void;
};

const TOP_Y = 28;
const ROW_H = 192;
const LEDGE_H = 10;
const TIER_GAP = 8;
const BOTTOM_Y = TOP_Y + ROW_H + LEDGE_H + TIER_GAP;
const SHELF_H = BOTTOM_Y + ROW_H + LEDGE_H;
const ROW_GEOMETRY = {
    top: { y: TOP_Y, height: ROW_H },
    bottom: { y: BOTTOM_Y, height: ROW_H },
};

const ignoreMove = () => {};

export function LibraryShelf({ books, onBookPress, arrangement, onDraggingChange }: LibraryShelfProps) {
    const fonts = useLibraryTypography();
    const isReduceMotion = !!useReducedMotion();
    const shelfTranslateY = useSharedValue(isReduceMotion ? 0 : 20);
    const audioPlayerRef = React.useRef<any>(null);
    const scrollRef = React.useRef<ScrollView>(null);
    const frameRef = React.useRef<View>(null);
    const touchOriginRef = React.useRef<{ x: number; y: number } | null>(null);
    const lastTakRef = React.useRef(0);
    const scrollXRef = React.useRef(0);
    const lastSweepTickRef = React.useRef(0);
    const [sweptId, setSweptId] = React.useState<string | null>(null);
    const [viewportWidth, setViewportWidth] = React.useState(0);
    const [activeSpineIds, setActiveSpineIds] = React.useState<string[]>([]);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const arranging = !!arrangement?.active;

    const handleSpineInteraction = React.useCallback((item: LibraryBookEntry, active: boolean) => {
        setActiveSpineIds((current) => {
            const currentIndex = current.indexOf(item.id);
            if (active) {
                if (currentIndex !== -1 && currentIndex === current.length - 1) return current;
                return [...current.filter((id) => id !== item.id), item.id];
            }
            return currentIndex === -1 ? current : current.filter((id) => id !== item.id);
        });
    }, []);

    const activeCaptionBook = React.useMemo(() => {
        for (let index = activeSpineIds.length - 1; index >= 0; index -= 1) {
            const activeBook = books.find((book) => book.id === activeSpineIds[index]);
            if (activeBook) return activeBook;
        }
        return null;
    }, [activeSpineIds, books]);

    React.useEffect(() => {
        shelfTranslateY.value = isReduceMotion ? 0 : withTiming(0, { duration: 800, easing: Easing.bezier(0.16, 1, 0.3, 1) });
    }, [isReduceMotion]);

    React.useEffect(() => {
        let mounted = true;
        void (async () => {
            try {
                const { createAudioPlayer, setAudioModeAsync } = await import('expo-audio');
                await setAudioModeAsync({ playsInSilentMode: false });
                if (!mounted) return;
                const player = createAudioPlayer(require('../../../assets/sounds/tak.mp3'));
                player.volume = 0.3;
                audioPlayerRef.current = player;
            } catch {}
        })();
        return () => {
            mounted = false;
            audioPlayerRef.current?.remove?.();
            audioPlayerRef.current = null;
        };
    }, []);

    const playTak = React.useCallback(() => {
        if (isReduceMotion) return;
        const now = Date.now();
        if (now - lastTakRef.current < 100) return;
        lastTakRef.current = now;
        const player = audioPlayerRef.current;
        if (!player) return;
        try {
            const seek = player.seekTo(0);
            void Promise.resolve(seek).then(() => player.play()).catch(() => {});
        } catch {}
    }, [isReduceMotion]);

    const shelfAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: shelfTranslateY.value }],
    }));
    const { top, bottom } = React.useMemo(() => splitShelfRows(books), [books]);
    const { contentWidth, bookLayouts } = React.useMemo(
        () => getShelfTrackLayout(top, bottom, viewportWidth), [top, bottom, viewportWidth],
    );
    const layoutByBookId = React.useMemo(
        () => new Map(bookLayouts.map((book) => [book.id, book] as const)), [bookLayouts],
    );
    const visibleMembership = JSON.stringify(books.map((book) => book.id).sort());
    // A filter change starts at the first books, with no stale brush state.
    React.useEffect(() => {
        scrollRef.current?.scrollTo({ x: 0, animated: false });
        scrollXRef.current = 0;
        setSweptId(null);
    }, [visibleMembership]);
    React.useEffect(() => {
        const visibleIds = new Set(books.map((book) => book.id));
        setActiveSpineIds((current) => {
            const remaining = current.filter((id) => visibleIds.has(id));
            return remaining.length === current.length ? current : remaining;
        });
    }, [books]);
    React.useEffect(() => {
        if (!arranging || !books.some((book) => book.id === selectedId)) setSelectedId(null);
        if (arranging) setSweptId(null);
    }, [arranging, books, selectedId]);

    const { drag, gesture } = useVerticalShelfDrag({
        enabled: arranging && !arrangement?.saving, selectedId, books, layouts: bookLayouts, rows: ROW_GEOMETRY,
        viewportWidth, contentWidth, frameRef, scrollRef, scrollXRef, onMove: arrangement?.move ?? ignoreMove, onDraggingChange,
    });
    const selectBook = (item: LibraryBookEntry) => {
        setSelectedId(item.id);
        const layout = layoutByBookId.get(item.id);
        if (layout && (layout.offsetLeft < scrollXRef.current + SHELF_SIDE_WIDTH
            || layout.offsetLeft + layout.width > scrollXRef.current + viewportWidth - SHELF_SIDE_WIDTH)) {
            const x = Math.max(0, Math.min(contentWidth - viewportWidth, layout.offsetLeft - 48));
            scrollXRef.current = x;
            scrollRef.current?.scrollTo({ x, animated: !isReduceMotion });
        }
    };
    const selectedBook = books.find((book) => book.id === selectedId);
    const selectedIndex = books.findIndex((book) => book.id === selectedId);
    const draggedBook = drag ? books.find((book) => book.id === drag.id) : undefined;

    const handleSweepMove = React.useCallback((event: any) => {
        if (arranging || isReduceMotion || !touchOriginRef.current) return;
        const { pageX, pageY } = event.nativeEvent;
        if (typeof pageX !== 'number' || typeof pageY !== 'number') return;
        const id = resolveSweptSpine({
            scrollX: scrollXRef.current,
            touchX: pageX - touchOriginRef.current.x,
            touchY: pageY - touchOriginRef.current.y,
            rowGeometry: ROW_GEOMETRY,
            bookLayouts,
        });
        if (id !== sweptId && id && Date.now() - lastSweepTickRef.current >= 80) {
            lastSweepTickRef.current = Date.now();
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        setSweptId(id);
    }, [bookLayouts, isReduceMotion, sweptId, arranging]);

    const renderRow = (entries: LibraryBookEntry[], indexOffset: number, y: number, row: 'top' | 'bottom') => (
        <View testID={`library-shelf-row-${row}`} style={[styles.bookRow, { top: y }]}>
            {entries.map((item, index) => {
                const selected = arranging && selectedId === item.id;
                const spine = <View key={item.id} collapsable={false} style={{ flexShrink: 0, opacity: drag?.id === item.id ? 0 : 1 }}>
                    <LinearGradient colors={['rgba(17,10,5,0.52)', 'rgba(17,10,5,0.28)', 'transparent']}
                        locations={[0, 0.3, 1]} pointerEvents="none" accessible={false}
                        accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                        style={[styles.bookContactShadow, { width: layoutByBookId.get(item.id)?.width,
                            opacity: !arranging && (activeSpineIds.includes(item.id) || sweptId === item.id) ? 0.25 : 0.85 }]} />
                <BookSpine item={item} index={indexOffset + index}
                    onPress={() => arranging ? selectBook(item) : onBookPress(item)} isReduceMotion={isReduceMotion}
                    onInteractionChange={handleSpineInteraction}
                    arranging={arranging} selected={selected}
                    playTak={playTak} swept={sweptId === item.id}
                    gapAfter={layoutByBookId.get(item.id)?.gapAfter ?? 0} />
                    {selected ? <View pointerEvents="none" style={styles.selectedOutline} /> : null}
                </View>;
                return selected ? <GestureDetector key={item.id} gesture={gesture} touchAction="none">{spine}</GestureDetector> : spine;
            })}
            {entries.length > 0 ? (
                <View style={styles.bookend} testID={`library-shelf-bookend-${row}`} pointerEvents="none"
                    accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <LinearGradient colors={['#ddc28d', '#a4864f', '#66512e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={styles.bookendUpright} />
                    <View style={styles.bookendFoot} />
                </View>
            ) : null}
        </View>
    );
    const renderFace = (y: number, testID?: string, faceHeight = LEDGE_H) => (
        <View testID={testID} style={[styles.shelfFace, { top: y, height: faceHeight }]} pointerEvents="none">
            <LinearGradient colors={['#ad8559', '#8b623c', '#614025']} locations={[0, 0.4, 1]}
                style={StyleSheet.absoluteFill} />
            <Image source={{ uri: CABINET_WOOD_TEXTURE_URI }} style={[StyleSheet.absoluteFill, styles.faceGrain]} contentFit="fill" accessible={false} />
            <LinearGradient colors={['#d8bb92', '#b58e63', '#8b623e']} locations={[0, 0.4, 1]}
                style={styles.boardTop} />
            <View style={styles.boardFrontHighlight} />
            <LinearGradient colors={['transparent', 'rgba(24,14,7,0.64)']} style={styles.boardUnderside} />
        </View>
    );
    const renderWall = (y: number) => (
        <View style={[styles.shelfWall, { top: y }]} pointerEvents="none">
            <LinearGradient colors={['#342419', '#62452f', '#503622']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(15,9,5,0.48)', 'rgba(15,9,5,0.16)', 'transparent']}
                locations={[0, 0.4, 1]} style={styles.ceilingShadow} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.32)']} style={styles.contactShadow} />
        </View>
    );
    const renderSide = (side: 'left' | 'right') => (
        <View style={[styles.cabinetSide, { [side]: 0 }]} pointerEvents="none" testID={`library-shelf-${side}-support`}
            accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <LinearGradient colors={side === 'left' ? ['#b29067', '#886241', '#48301f'] : ['#48301f', '#886241', '#a3815b']}
                locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <Image source={{ uri: CABINET_WOOD_TEXTURE_URI }} contentFit="fill" style={styles.sideGrain} accessible={false} />
        </View>
    );

    return (
        <View>
        <Animated.View style={[styles.shelfContainer, shelfAnimatedStyle]} testID="library-shelf">
            <View ref={frameRef} style={styles.shelfFrame} testID="library-shelf-frame" onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}>
                <LinearGradient colors={['#ae8b62', '#97704a', '#7b5638']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
                {renderWall(TOP_Y)}
                {renderWall(BOTTOM_Y)}
                <Image source={{ uri: CABINET_WOOD_TEXTURE_URI }} style={[StyleSheet.absoluteFill, styles.wallGrain]} contentFit="fill"
                    testID="library-shelf-wood-grain" pointerEvents="none" accessible={false}
                    accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
                <LinearGradient colors={['rgba(0,0,0,0.28)', 'transparent', 'transparent', 'rgba(0,0,0,0.24)']}
                    locations={[0, 0.06, 0.94, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill} pointerEvents="none" />
                {renderFace(TOP_Y + ROW_H, 'library-shelf-inner-ledge', LEDGE_H + TIER_GAP)}
                {renderFace(BOTTOM_Y + ROW_H, 'library-shelf-bottom-ledge')}
                <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={contentWidth > viewportWidth}
                    scrollEnabled={!drag && !arrangement?.saving}
                    style={styles.scrollViewport} contentContainerStyle={{ width: contentWidth, height: SHELF_H }}
                    testID="library-shelf-scroll" scrollEventThrottle={16} directionalLockEnabled
                    onScroll={(event) => { scrollXRef.current = event.nativeEvent.contentOffset.x; }}
                    onTouchStart={() => {
                        touchOriginRef.current = null;
                        frameRef.current?.measureInWindow((x, y) => { touchOriginRef.current = { x, y }; });
                    }}
                    onTouchMove={handleSweepMove} onTouchEnd={() => setSweptId(null)} onTouchCancel={() => setSweptId(null)}
                >
                    {renderRow(top, 0, TOP_Y, 'top')}
                    {renderRow(bottom, top.length, BOTTOM_Y, 'bottom')}
                </ScrollView>
                {renderSide('left')}
                {renderSide('right')}
                <View style={styles.topBevel} pointerEvents="none" />
                {drag?.target ? <View testID={`library-arrange-drop-${drag.target.beforeId ?? 'end'}`} pointerEvents="none"
                    style={[styles.dropMarker, { left: drag.target.x - scrollXRef.current,
                        top: ROW_GEOMETRY[drag.target.row].y + 24 }]} /> : null}
                {draggedBook && drag ? <View testID="library-arrange-drag-overlay" pointerEvents="none" accessible={false}
                    accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                    style={[styles.dragOverlay, { left: drag.left, top: drag.top }, !isReduceMotion && { transform: [{ scale: 1.04 }] }]}>
                    <BookSpine item={draggedBook} index={0} onPress={() => {}} isReduceMotion playTak={() => {}}
                        arranging testID="library-arrange-drag-preview" />
                </View> : null}
                {books.length === 0 ? (
                    <View style={styles.emptyState} pointerEvents="none">
                        <Ionicons name="library-outline" size={36} color="#f0e0d1" />
                        <Text style={[styles.emptyTitle, { fontFamily: fonts.heading }]}>No books on this shelf</Text>
                        <Text style={[styles.emptyHint, { fontFamily: fonts.body }]}>Try another filter or add a book.</Text>
                    </View>
                ) : null}
            </View>
        </Animated.View>
        {arranging ? <LibraryArrangeSelection title={selectedBook?.book.title}
            canEarlier={selectedIndex > 0} canLater={selectedIndex >= 0 && selectedIndex < books.length - 1}
            disabled={!!arrangement?.saving || !!drag}
            onEarlier={() => { if (selectedId && selectedIndex > 0) arrangement?.move(selectedId, books[selectedIndex - 1].id); }}
            onLater={() => { if (selectedId && selectedIndex >= 0) arrangement?.move(selectedId, books[selectedIndex + 2]?.id ?? null); }} /> : null}
        <LibraryBookPicker books={books} onBookPress={arranging ? selectBook : onBookPress} activeBook={arranging ? selectedBook : activeCaptionBook} selecting={arranging} />
        </View>
    );
}

const styles = StyleSheet.create({
    selectedOutline: { position: 'absolute', top: -3, bottom: -2, left: -3, right: 0, borderWidth: 2, borderColor: '#e9c279', borderRadius: 6 },
    dropMarker: { position: 'absolute', height: ROW_H - 24, width: 3, backgroundColor: '#fff1bd', borderWidth: 0.5, borderColor: '#654329', zIndex: 20 },
    dragOverlay: { position: 'absolute', zIndex: 30, elevation: 12 },
    shelfContainer: {
        marginBottom: LIBRARY_SPACING.large, borderRadius: LIBRARY_RADIUS.cabinet, borderWidth: 1, borderColor: 'rgba(176,143,99,0.42)',
        shadowColor: '#20160e', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14,
        shadowRadius: 14, elevation: 5, backgroundColor: '#896341',
    },
    shelfFrame: { height: SHELF_H, borderRadius: 15, overflow: 'hidden', backgroundColor: '#896341' },
    shelfWall: {
        position: 'absolute', left: 0, right: 0, height: ROW_H,
    },
    shelfFace: {
        position: 'absolute', left: 0, right: 0, height: LEDGE_H,
        shadowColor: '#160e08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2,
    },
    wallGrain: { opacity: 0.65 },
    faceGrain: { opacity: 0.45 },
    boardTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 4 },
    boardFrontHighlight: { position: 'absolute', left: 0, right: 0, top: 4, height: 1, backgroundColor: 'rgba(243,213,167,0.42)' },
    boardUnderside: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4 },
    // Static footprint: book transforms lift above this shadow; it never enters the drag overlay.
    bookContactShadow: { position: 'absolute', left: 0, bottom: -3, height: 3, borderRadius: 2 },
    scrollViewport: { ...StyleSheet.absoluteFillObject },
    bookRow: {
        position: 'absolute', left: SHELF_SIDE_WIDTH, right: 0, height: ROW_H, flexDirection: 'row',
        alignItems: 'flex-end', justifyContent: 'flex-start',
    },
    cabinetSide: { position: 'absolute', top: 0, bottom: 0, width: SHELF_SIDE_WIDTH, zIndex: 2 },
    sideGrain: { position: 'absolute', width: SHELF_H, height: SHELF_SIDE_WIDTH,
        left: (SHELF_SIDE_WIDTH - SHELF_H) / 2, top: (SHELF_H - SHELF_SIDE_WIDTH) / 2, transform: [{ rotate: '90deg' }] },
    ceilingShadow: { position: 'absolute', top: 0, left: 0, right: 0, height: 18 },
    contactShadow: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4 },
    topBevel: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,226,176,0.32)', zIndex: 2 },
    bookend: {
        width: SHELF_BOOKEND_WIDTH, height: 76, flexShrink: 0,
        shadowColor: '#170e07', shadowOffset: { width: 2, height: 1 }, shadowOpacity: 0.4, shadowRadius: 1.5,
    },
    bookendUpright: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
    bookendFoot: { position: 'absolute', left: 0, right: 1, bottom: 0, height: 4, backgroundColor: '#a4864f', borderRadius: 1,
        borderTopWidth: 1, borderTopColor: '#ddc28d' },
    emptyState: { position: 'absolute', left: 16, right: 16, top: TOP_Y, height: ROW_H, alignItems: 'center', justifyContent: 'center', gap: 8 },
    emptyTitle: { fontSize: 24, color: '#f0e0d1' },
    emptyHint: { fontSize: 13, color: '#f0e0d1' },
});
