import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useReducedMotion } from 'react-native-reanimated';
import { LibraryBookEntry } from '@/features/books/utils/libraryShelf';
import { ShelfArrangement } from '@/features/books/hooks/useShelfArrangement';
import { getHorizontalShelfLayout, HorizontalTierLayout, HORIZONTAL_PLANK_HEIGHT, HORIZONTAL_SHELF_INSET, HORIZONTAL_PILE_GAP } from '@/features/books/utils/horizontalShelfLayout';
import { HorizontalBookVolume } from './HorizontalBookVolume';
import { LibraryBookPicker } from './LibraryBookPicker';
import { LibraryArrangeSelection } from './LibraryArrangeControls';
import { useLibraryTypography } from './LibraryTypography';
import { LIBRARY_SPACING, useLibraryAppearance } from './LibraryAppearance';
import { CABINET_WOOD_TEXTURE_URI } from './cabinetWoodTexture';
import { useHorizontalShelfDrag } from './useHorizontalShelfDrag';
import { LibraryBookQuickLook } from './LibraryBookQuickLook';

export function LibraryHorizontalShelf({ books, onBookPress, arrangement, onDraggingChange }: {
    books: LibraryBookEntry[]; onBookPress: (book: LibraryBookEntry) => void; arrangement?: ShelfArrangement;
    onDraggingChange?: (active: boolean) => void;
}) {
    const fonts = useLibraryTypography();
    const colors = useLibraryAppearance();
    const { fontScale } = useWindowDimensions();
    const reduceMotion = !!useReducedMotion();
    const [width, setWidth] = React.useState(0);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [hoveredId, setHoveredId] = React.useState<string | null>(null);
    const [focusedId, setFocusedId] = React.useState<string | null>(null);
    const [quickId, setQuickId] = React.useState<string | null>(null);
    const [cancelSignal, cancelPending] = React.useReducer((value: number) => value + 1, 0);
    const [, refreshOffsets] = React.useReducer((value: number) => value + 1, 0);
    const frameRef = React.useRef<View>(null);
    const topRef = React.useRef<ScrollView>(null);
    const bottomRef = React.useRef<ScrollView>(null);
    const offsets = React.useRef({ top: 0, bottom: 0 });
    const layout = React.useMemo(() => getHorizontalShelfLayout(books, width, fontScale, arrangement?.tierIds),
        [books, width, fontScale, arrangement?.tierIds]);
    const arranging = !!arrangement?.active;
    const selectedBook = books.find((book) => book.id === selectedId);
    const selectedIndex = books.findIndex((book) => book.id === selectedId);
    const activeBook = books.find((book) => book.id === (focusedId ?? hoveredId)) ?? null;
    const refs = React.useMemo(() => ({ top: topRef, bottom: bottomRef }), []);
    const membership = JSON.stringify(books.map((book) => book.id).sort());

    React.useEffect(() => {
        setSelectedId(null); setHoveredId(null); setFocusedId(null); setQuickId(null); cancelPending();
    }, [membership, arranging]);
    const { drag, gesture, clear } = useHorizontalShelfDrag({ enabled: arranging && !arrangement?.saving,
        selectedId, books, viewportWidth: width, fontScale, frameRef, scrollRefs: refs, offsets, tierIds: arrangement?.tierIds,
        onMove: arrangement?.moveHorizontal ?? (() => {}), onDraggingChange, onOffsetChange: refreshOffsets });
    useFocusEffect(React.useCallback(() => () => { clear(); cancelPending(); setQuickId(null); }, [clear]));
    const draggedBook = drag ? books.find((book) => book.id === drag.id) : undefined;
    const openQuickLook = (book: LibraryBookEntry) => { if (!arranging && !drag && !arrangement?.saving) setQuickId(book.id); };
    // Clamp each independent track when content shrinks; avoid resets after moves.
    React.useEffect(() => {
        for (const tier of layout.tiers) {
            const next = Math.min(offsets.current[tier.row], Math.max(0, tier.contentWidth - width));
            if (next !== offsets.current[tier.row]) refs[tier.row].current?.scrollTo({ x: next, animated: false });
            offsets.current[tier.row] = next;
        }
        refreshOffsets();
    }, [layout, width]);

    const selectBook = (book: LibraryBookEntry) => {
        setSelectedId(book.id);
        for (const tier of layout.tiers) {
            const volume = tier.piles.flatMap((pile) => pile.volumes).find((entry) => entry.item.id === book.id);
            if (!volume) continue;
            const offset = offsets.current[tier.row];
            if (volume.x < offset || volume.x + volume.width > offset + width) {
                const next = Math.max(0, Math.min(tier.contentWidth - width, volume.x - 16));
                offsets.current[tier.row] = next;
                refs[tier.row].current?.scrollTo({ x: next, animated: !reduceMotion });
            }
        }
    };
    const scrollPile = (tier: HorizontalTierLayout, direction: -1 | 1) => {
        cancelPending();
        const next = Math.max(0, Math.min(tier.contentWidth - width,
            offsets.current[tier.row] + direction * (layout.pileWidth + HORIZONTAL_PILE_GAP)));
        refs[tier.row].current?.scrollTo({ x: next, animated: !reduceMotion });
    };
    const renderTier = (tier: HorizontalTierLayout) => <View key={tier.row} testID={`library-horizontal-tier-${tier.row}`}
        style={{ height: tier.trackHeight + HORIZONTAL_PLANK_HEIGHT }}>
        <LinearGradient colors={['#483222', '#6c4b32', '#493323']} locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill} pointerEvents="none" />
        <Image source={{ uri: CABINET_WOOD_TEXTURE_URI }} contentFit="fill" pointerEvents="none" accessible={false}
            style={[StyleSheet.absoluteFill, { opacity: 0.68 }]} />
        <LinearGradient colors={['rgba(15,9,5,0.44)', 'rgba(15,9,5,0.12)', 'transparent']} pointerEvents="none"
            locations={[0, 0.4, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 40 }} />
        <LinearGradient colors={['rgba(19,11,6,0.38)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.interiorRailLeft} pointerEvents="none" />
        <LinearGradient colors={['transparent', 'rgba(19,11,6,0.38)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.interiorRailRight} pointerEvents="none" />
        <LinearGradient colors={['transparent', 'rgba(19,11,6,0.32)']} pointerEvents="none"
            style={styles.floorContactShade} />
        <Text pointerEvents="none" style={[styles.tierLabel, { fontFamily: fonts.heading }]}>
            {tier.row === 'top' ? 'Upper shelf' : 'Lower shelf'}
        </Text>
        <ScrollView horizontal ref={refs[tier.row]} testID={`library-horizontal-scroll-${tier.row}`}
            accessibilityLabel={`${tier.row === 'top' ? 'Upper' : 'Lower'} shelf books`}
            // A web scrollbar consumes track height and clips the resting faces.
            showsHorizontalScrollIndicator={false}
            scrollEnabled={!drag && !arrangement?.saving} directionalLockEnabled scrollEventThrottle={16}
            onScrollBeginDrag={() => { cancelPending(); setHoveredId(null); }}
            onScroll={(event) => {
                const next = event.nativeEvent.contentOffset.x;
                if (next !== offsets.current[tier.row]) { offsets.current[tier.row] = next; cancelPending(); refreshOffsets(); }
            }}
            style={{ height: tier.trackHeight }} contentContainerStyle={{ width: tier.contentWidth, height: tier.trackHeight }}>
            {tier.piles.map((pile, pileIndex) => <View key={pile.volumes[0].item.id} pointerEvents="box-none"
                testID={`library-horizontal-pile-${tier.row}-${pileIndex}`}
                style={{ position: 'absolute', left: pile.x, width: pile.width, top: 0, height: tier.trackHeight }}>
                <LinearGradient pointerEvents="none" colors={['transparent', 'rgba(16,9,4,0.60)']}
                    style={{ position: 'absolute', bottom: 0, left: -3, right: -3, height: 6 }} />
                {pile.volumes.map((volume) => {
                    const content = <View key={volume.item.id} collapsable={false}
                    pointerEvents={drag?.id === volume.item.id ? 'none' : 'auto'}
                    accessibilityElementsHidden={drag?.id === volume.item.id}
                    importantForAccessibility={drag?.id === volume.item.id ? 'no-hide-descendants' : 'auto'}
                    style={{ position: 'absolute', left: volume.x - pile.x, top: volume.y, opacity: drag?.id === volume.item.id ? 0 : 1 }}>
                    <HorizontalBookVolume item={volume.item} width={volume.width} height={volume.height}
                        onPress={() => arranging ? selectBook(volume.item) : onBookPress(volume.item)}
                        onQuickLook={() => openQuickLook(volume.item)} cancelSignal={cancelSignal}
                        selected={selectedId === volume.item.id} arranging={arranging} disabled={!!arrangement?.saving}
                        onInteractionChange={(book, source, active) => {
                            const setSourceId = source === 'focus' ? setFocusedId : setHoveredId;
                            setSourceId((previous) => active ? book.id : previous === book.id ? null : previous);
                        }} />
                </View>;
                    return arranging && selectedId === volume.item.id
                        ? <GestureDetector key={volume.item.id} gesture={gesture} touchAction="none">{content}</GestureDetector> : content;
                })}
            </View>)}
        </ScrollView>
        {tier.contentWidth > width && width > 0 ? <View style={styles.overflowControls}>
            {([-1, 1] as const).map((direction) => {
                const disabled = !!drag || !!arrangement?.saving || (direction < 0 ? offsets.current[tier.row] <= 1 : offsets.current[tier.row] >= tier.contentWidth - width - 1);
                return <Pressable key={direction} testID={`library-horizontal-${tier.row}-${direction < 0 ? 'previous' : 'next'}`}
                    accessibilityRole="button" accessibilityLabel={`${direction < 0 ? 'Previous' : 'Next'} stack on ${tier.row === 'top' ? 'upper' : 'lower'} shelf`}
                    accessibilityState={{ disabled }} disabled={disabled} onPress={() => scrollPile(tier, direction)}
                    style={[styles.overflowButton, disabled && { opacity: 0.4 }]}>
                    <Text style={{ color: '#30291f', fontSize: 22 }}>{direction < 0 ? '‹' : '›'}</Text>
                </Pressable>;
            })}
        </View> : null}
        <View testID={`library-horizontal-plank-${tier.row}`} pointerEvents="none" style={styles.plank}>
            <LinearGradient colors={['#ae8b62', '#97704a', '#7b5638']} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />
            <Image source={{ uri: CABINET_WOOD_TEXTURE_URI }} contentFit="fill" accessible={false}
                style={[StyleSheet.absoluteFill, { opacity: 0.5 }]} />
            <LinearGradient colors={['#c9a474', '#9b7149', '#795333']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                style={styles.plankTop} />
            <View style={styles.plankJointLeft} /><View style={styles.plankJointRight} />
            <View style={styles.plankHighlight} /><View style={styles.plankUnderside} />
        </View>
    </View>;
    return <View>
        <View ref={frameRef} collapsable={false} testID="library-horizontal-shelf" style={[styles.cabinet, { height: layout.height }]}
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
            {layout.tiers.map(renderTier)}
            <View style={styles.topCap} pointerEvents="none" accessible={false}>
                <LinearGradient colors={['#c5a171', '#97704a', '#654429']} style={StyleSheet.absoluteFill} />
                <Image source={{ uri: CABINET_WOOD_TEXTURE_URI }} contentFit="fill" accessible={false}
                    style={[StyleSheet.absoluteFill, { opacity: 0.5 }]} />
            </View>
            {(['left', 'right'] as const).map((side) => <View key={side} pointerEvents="none" accessible={false}
                testID={`library-horizontal-${side}-support`} style={[styles.cabinetSide, { [side]: 0 }]}>
                <LinearGradient colors={side === 'left' ? ['#b29067', '#886241', '#48301f'] : ['#48301f', '#886241', '#a3815b']}
                    locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                <Image source={{ uri: CABINET_WOOD_TEXTURE_URI }} contentFit="fill" accessible={false}
                    style={{ position: 'absolute', width: layout.height, height: 12,
                        left: (12 - layout.height) / 2, top: (layout.height - 12) / 2, transform: [{ rotate: '90deg' }], opacity: 0.5 }} />
                <View style={[styles.sideInsideEdge, side === 'left' ? { right: 0 } : { left: 0 }]} />
            </View>)}
            {drag?.target ? <View pointerEvents="none" testID="library-horizontal-drop-marker" accessible={false}
                style={[styles.dropMarker, { left: drag.target.x - offsets.current[drag.target.row], top: drag.target.y,
                    width: drag.target.width, height: drag.target.height }]} /> : null}
            {draggedBook && drag ? <View pointerEvents="none" testID="library-horizontal-drag-overlay" accessible={false}
                accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                style={{ position: 'absolute', zIndex: 30, elevation: 12, left: drag.left, top: drag.top }}>
                <HorizontalBookVolume item={draggedBook} width={drag.width} height={drag.height} onPress={() => {}} decorative />
            </View> : null}
            {books.length === 0 ? <View style={styles.empty} pointerEvents="none">
                <Text style={{ color: '#f3e5cd', fontFamily: fonts.heading, fontSize: 24 }}>No books on this shelf</Text>
                <Text style={{ color: '#f3e5cd', fontFamily: fonts.body, fontSize: 13 }}>Try another filter or add a book.</Text>
            </View> : null}
        </View>
        {arranging ? <LibraryArrangeSelection title={selectedBook?.book.title}
            canEarlier={selectedIndex > 0} canLater={selectedIndex >= 0 && selectedIndex < books.length - 1}
            disabled={!!arrangement?.saving || !!drag}
            onEarlier={() => { if (selectedId && selectedIndex > 0) arrangement?.move(selectedId, books[selectedIndex - 1].id); }}
            onLater={() => { if (selectedId && selectedIndex >= 0) arrangement?.move(selectedId, books[selectedIndex + 2]?.id ?? null); }} /> : null}
        <Text style={[styles.caption, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {layout.tiers.some((tier) => tier.contentWidth > width) ? 'Scroll each shelf sideways to browse your books.' : 'Your books, stacked on two shelves.'}
        </Text>
        <LibraryBookPicker books={books} onBookPress={arranging ? selectBook : onBookPress}
            activeBook={arranging ? selectedBook : activeBook} selecting={arranging} onQuickLook={arranging ? undefined : openQuickLook} />
        <LibraryBookQuickLook book={books.find((book) => book.id === quickId) ?? null} onClose={() => setQuickId(null)} onDetails={onBookPress} />
    </View>;
}
const styles = StyleSheet.create({
    cabinet: { borderRadius: 9, overflow: 'hidden', backgroundColor: '#896341',
        marginBottom: 8,
        shadowColor: '#20160e', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14,
        shadowRadius: 14, elevation: 5 },
    topCap: { position: 'absolute', left: 12, right: 12, top: 0, height: 10, zIndex: 12,
        borderTopWidth: 1, borderTopColor: 'rgba(255,226,176,0.32)', borderBottomWidth: 1, borderBottomColor: 'rgba(24,14,7,0.54)' },
    cabinetSide: { position: 'absolute', top: 0, bottom: 0, width: 12, zIndex: 12, overflow: 'hidden' },
    sideInsideEdge: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(25,15,9,0.30)' },
    tierLabel: { position: 'absolute', left: HORIZONTAL_SHELF_INSET, top: 12, fontSize: 13, lineHeight: 18, color: '#f3e5cd' },
    interiorRailLeft: { position: 'absolute', left: 12, top: 0, bottom: HORIZONTAL_PLANK_HEIGHT, width: 16 },
    interiorRailRight: { position: 'absolute', right: 12, top: 0, bottom: HORIZONTAL_PLANK_HEIGHT, width: 16 },
    floorContactShade: { position: 'absolute', left: 0, right: 0, bottom: HORIZONTAL_PLANK_HEIGHT, height: 14 },
    overflowControls: { position: 'absolute', right: 8, top: 0, flexDirection: 'row', gap: 4 },
    overflowButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: '#f5eee2' },
    dropMarker: { position: 'absolute', borderWidth: 2, borderColor: '#c5a059', borderStyle: 'dashed', borderRadius: 4, backgroundColor: 'rgba(197,160,89,0.12)', zIndex: 20 },
    plank: { height: HORIZONTAL_PLANK_HEIGHT },
    plankTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
    plankHighlight: { position: 'absolute', top: 5, left: 0, right: 0, height: 1, backgroundColor: 'rgba(248,219,175,0.44)' },
    plankJointLeft: { position: 'absolute', top: 7, bottom: 4, left: 12, width: 2,
        borderLeftWidth: 1, borderLeftColor: 'rgba(230,196,151,0.25)', backgroundColor: 'rgba(40,25,15,0.22)' },
    plankJointRight: { position: 'absolute', top: 7, bottom: 4, right: 12, width: 2,
        borderLeftWidth: 1, borderLeftColor: 'rgba(230,196,151,0.25)', backgroundColor: 'rgba(40,25,15,0.22)' },
    plankUnderside: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: '#3f2819' },
    caption: { fontSize: 12, lineHeight: 18, marginBottom: LIBRARY_SPACING.medium },
    empty: { position: 'absolute', top: 64, left: 16, right: 16, gap: 8, alignItems: 'center' },
});
