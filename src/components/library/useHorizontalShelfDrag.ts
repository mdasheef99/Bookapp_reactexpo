import React from 'react';
import { ScrollView, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { LibraryBookEntry } from '@/features/books/utils/libraryShelf';
import { getHorizontalShelfLayout } from '@/features/books/utils/horizontalShelfLayout';
import { HorizontalShelfDrop, resolveHorizontalShelfDrop } from '@/features/books/utils/horizontalShelfArrange';
import { shelfEdgeScrollStep } from '@/features/books/utils/verticalShelfArrange';
import type { ShelfTierIds } from '@/features/books/utils/shelfOrder';
import { ShelfRow } from '@/features/books/utils/shelfLayout';

type Drag = { id: string; originX: number; originY: number; pointerX: number; pointerY: number;
    grabX: number; grabY: number; left: number; top: number; width: number; height: number; target: HorizontalShelfDrop | null };

export function useHorizontalShelfDrag({ enabled, selectedId, books, viewportWidth, fontScale, frameRef,
    scrollRefs, offsets, tierIds, onMove, onDraggingChange, onOffsetChange }: {
    enabled: boolean; selectedId: string | null; books: LibraryBookEntry[]; viewportWidth: number; fontScale: number;
    frameRef: React.RefObject<View | null>; scrollRefs: Record<ShelfRow, React.RefObject<ScrollView | null>>;
    offsets: React.MutableRefObject<Record<ShelfRow, number>>; tierIds?: ShelfTierIds;
    onMove: (id: string, row: ShelfRow, before: string | null) => void;
    onDraggingChange?: (active: boolean) => void; onOffsetChange: () => void;
}) {
    const [drag, setDrag] = React.useState<Drag | null>(null);
    const currentDrag = React.useRef<Drag | null>(null);
    const version = React.useRef(0);
    const active = React.useRef(false);
    const config = React.useRef({ enabled, books, viewportWidth, fontScale, scrollRefs, offsets, tierIds, onMove, onOffsetChange });
    config.current = { enabled, books, viewportWidth, fontScale, scrollRefs, offsets, tierIds, onMove, onOffsetChange };
    const clear = React.useCallback(() => { active.current = false; ++version.current; currentDrag.current = null; setDrag(null); }, []);
    const membership = JSON.stringify(books.map((book) => book.id).sort());
    React.useEffect(() => { clear(); }, [enabled, membership, viewportWidth, fontScale, clear]);
    React.useEffect(() => {
        onDraggingChange?.(!!drag);
        return () => onDraggingChange?.(false);
    }, [!!drag, onDraggingChange]);
    React.useEffect(() => () => { active.current = false; ++version.current; currentDrag.current = null; }, []);

    const update = React.useCallback((absoluteX: number, absoluteY: number) => {
        const current = currentDrag.current;
        if (!current) return;
        const c = config.current;
        const x = absoluteX - current.originX, y = absoluteY - current.originY;
        const target = resolveHorizontalShelfDrop({ pointerX: x, localY: y, draggedId: current.id,
            books: c.books, viewportWidth: c.viewportWidth, fontScale: c.fontScale, offsets: c.offsets.current, tierIds: c.tierIds });
        const next = { ...current, pointerX: x, pointerY: y, left: x - current.grabX, top: y - current.grabY, target };
        currentDrag.current = next; setDrag(next);
    }, [offsets]);

    React.useEffect(() => {
        if (!drag?.id) return;
        let frame: number, previous: number | null = null;
        const step = (time: number) => {
            const current = currentDrag.current;
            if (!current) return;
            const c = config.current, row = current.target?.row;
            if (row) {
                const tier = getHorizontalShelfLayout(c.books, c.viewportWidth, c.fontScale, c.tierIds).tiers.find((entry) => entry.row === row)!;
                const next = shelfEdgeScrollStep(current.pointerX, c.viewportWidth, offsets.current[row], tier.contentWidth,
                    previous === null ? 16 : time - previous);
                if (next !== offsets.current[row]) {
                    offsets.current[row] = next;
                    c.scrollRefs[row].current?.scrollTo({ x: next, animated: false });
                    c.onOffsetChange();
                    update(current.originX + current.pointerX, current.originY + current.pointerY);
                }
            }
            previous = time; frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, [drag?.id, offsets, update]);

    const gesture = React.useMemo(() => Gesture.Pan().enabled(enabled && !!selectedId).minDistance(5).maxPointers(1).runOnJS(true)
        .onStart((event) => {
            if (!selectedId || !config.current.enabled) return;
            const snapshot = ++version.current;
            active.current = true;
            const absoluteX = event.absoluteX, absoluteY = event.absoluteY;
            frameRef.current?.measureInWindow((originX, originY) => {
                if (!active.current || snapshot !== version.current || !config.current.enabled) return;
                const c = config.current;
                const layout = getHorizontalShelfLayout(c.books, c.viewportWidth, c.fontScale, c.tierIds);
                const volume = layout.tiers.flatMap((tier) => tier.piles.flatMap((pile) => pile.volumes))
                    .find((entry) => entry.item.id === selectedId);
                if (!volume) return;
                const tier = layout.tiers.find((entry) => entry.row === volume.row)!;
                const left = volume.x - offsets.current[volume.row], top = tier.y + volume.y;
                const next: Drag = { id: selectedId, originX, originY, pointerX: absoluteX - originX, pointerY: absoluteY - originY,
                    grabX: absoluteX - originX - left, grabY: absoluteY - originY - top, left, top,
                    width: volume.width, height: volume.height, target: null };
                currentDrag.current = next; setDrag(next); update(absoluteX, absoluteY);
            });
        })
        .onUpdate((event) => update(event.absoluteX, event.absoluteY))
        .onEnd((event, success) => {
            update(event.absoluteX, event.absoluteY);
            const current = currentDrag.current;
            if (success && current?.target && config.current.enabled) config.current.onMove(current.id, current.target.row, current.target.beforeId);
            clear();
        }).onFinalize(clear), [enabled, selectedId, frameRef, offsets, update, clear]);
    return { drag, gesture, clear };
}
