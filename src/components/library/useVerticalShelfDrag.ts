import React from 'react';
import { ScrollView, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { LibraryBookEntry } from '@/features/books/utils/libraryShelf';
import { SweptSpineBookLayout, SweptSpineRowGeometry } from '@/features/books/utils/shelfLayout';
import { resolveVerticalShelfDrop, shelfEdgeScrollStep, VerticalShelfDrop } from '@/features/books/utils/verticalShelfArrange';

type Drag = {
    id: string; originX: number; originY: number; pointerX: number; pointerY: number;
    grabX: number; grabY: number; left: number; top: number; target: VerticalShelfDrop | null;
};

// Coordinates/gestures belong only to the vertical presentation, not shared order state.
export function useVerticalShelfDrag({ enabled, selectedId, books, layouts, rows, viewportWidth, contentWidth,
    frameRef, scrollRef, scrollXRef, onMove, onDraggingChange }: {
    enabled: boolean; selectedId: string | null; books: LibraryBookEntry[]; layouts: SweptSpineBookLayout[];
    rows: SweptSpineRowGeometry; viewportWidth: number; contentWidth: number;
    frameRef: React.RefObject<View | null>; scrollRef: React.RefObject<ScrollView | null>;
    scrollXRef: React.MutableRefObject<number>; onMove: (id: string, before: string | null) => void;
    onDraggingChange?: (active: boolean) => void;
}) {
    const [drag, setDrag] = React.useState<Drag | null>(null);
    const dragRef = React.useRef<Drag | null>(null);
    const gestureVersion = React.useRef(0);
    const gestureActive = React.useRef(false);
    const config = React.useRef({ enabled, books, layouts, rows, viewportWidth, contentWidth, onMove });
    config.current = { enabled, books, layouts, rows, viewportWidth, contentWidth, onMove };
    const clear = React.useCallback(() => {
        gestureActive.current = false;
        ++gestureVersion.current;
        dragRef.current = null;
        setDrag(null);
    }, []);

    React.useEffect(() => { if (!enabled) clear(); }, [enabled, clear]);
    React.useEffect(() => {
        onDraggingChange?.(!!drag);
        return () => { onDraggingChange?.(false); };
    }, [!!drag, onDraggingChange]);

    const update = React.useCallback((absoluteX: number, absoluteY: number) => {
        const current = dragRef.current;
        if (!current) return;
        const c = config.current;
        const x = absoluteX - current.originX;
        const y = absoluteY - current.originY;
        const target = x < 0 || x > c.viewportWidth ? null : resolveVerticalShelfDrop({
            contentX: x + scrollXRef.current, localY: y, draggedId: current.id,
            order: c.books.map((book) => book.id), layouts: c.layouts, rows: c.rows,
        });
        const next = { ...current, pointerX: x, pointerY: y, left: x - current.grabX, top: y - current.grabY, target };
        dragRef.current = next;
        setDrag(next);
    }, [scrollXRef]);

    React.useEffect(() => {
        if (!drag?.id) return;
        let previousTime: number | null = null;
        let frame: number;
        const step = (time: number) => {
            const current = dragRef.current;
            if (!current) return;
            const c = config.current;
            const nextX = current.target ? shelfEdgeScrollStep(current.pointerX, c.viewportWidth, scrollXRef.current, c.contentWidth,
                previousTime === null ? 16 : time - previousTime) : scrollXRef.current;
            previousTime = time;
            if (nextX !== scrollXRef.current) {
                scrollXRef.current = nextX;
                scrollRef.current?.scrollTo({ x: nextX, animated: false });
                update(current.pointerX + current.originX, current.pointerY + current.originY);
            }
            frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, [drag?.id, scrollXRef, scrollRef, update]);

    const gesture = React.useMemo(() => Gesture.Pan().enabled(enabled && !!selectedId).minDistance(5).maxPointers(1).runOnJS(true)
        .onStart((event) => {
            if (!selectedId || !config.current.enabled) return;
            const version = ++gestureVersion.current;
            gestureActive.current = true;
            const absoluteX = event.absoluteX;
            const absoluteY = event.absoluteY;
            frameRef.current?.measureInWindow((originX, originY) => {
                if (!gestureActive.current || version !== gestureVersion.current || !config.current.enabled) return;
                const book = config.current.layouts.find((entry) => entry.id === selectedId);
                if (!book) return;
                const left = book.offsetLeft - scrollXRef.current;
                const top = config.current.rows[book.row].y + config.current.rows[book.row].height - book.height;
                const next: Drag = { id: selectedId, originX, originY,
                    pointerX: absoluteX - originX, pointerY: absoluteY - originY,
                    grabX: absoluteX - originX - left, grabY: absoluteY - originY - top,
                    left, top, target: null };
                dragRef.current = next;
                setDrag(next);
                update(absoluteX, absoluteY);
            });
        })
        .onUpdate((event) => update(event.absoluteX, event.absoluteY))
        .onEnd((event, success) => {
            update(event.absoluteX, event.absoluteY);
            const current = dragRef.current;
            if (success && current?.target && config.current.enabled) config.current.onMove(current.id, current.target.beforeId);
            clear();
        })
        .onFinalize(clear), [enabled, selectedId, frameRef, scrollXRef, update, clear]);

    return { drag, gesture, clear };
}
