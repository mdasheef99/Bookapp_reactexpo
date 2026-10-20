import { createShelfDraft, initialShelfTierIds, moveHorizontalShelfDraft, moveShelfBook, moveShelfDraft, parseShelfOrder, reconcileShelfArrangement, reconcileShelfOrder, undoShelfDraft } from '../shelfOrder';
import { resolveVerticalShelfDrop, shelfEdgeScrollStep } from '../verticalShelfArrange';
import { splitShelfRows, SweptSpineBookLayout } from '../shelfLayout';

describe('shared Shelf arrangement identity and draft', () => {
    it('uses source order before the first save and removes duplicate IDs', () => {
        expect(reconcileShelfOrder(null, ['b', 'a', 'b'])).toEqual(['b', 'a']);
    });
    it('keeps saved relative order, removes missing books and appends additions', () => {
        expect(reconcileShelfOrder(['c', 'gone', 'a', 'c'], ['new', 'a', 'b', 'c'])).toEqual(['c', 'a', 'new', 'b']);
    });
    it('moves by Library ID, including before the first book and to the end', () => {
        expect(moveShelfBook(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
        expect(moveShelfBook(['a', 'b', 'c'], 'a', null)).toEqual(['b', 'c', 'a']);
    });
    it('rejects unknown IDs and preserves identity for no-op moves', () => {
        const order = ['a', 'b', 'c'];
        for (const [id, before] of [['missing', 'a'], ['a', 'missing'], ['b', 'b'], ['a', 'b']] as const) {
            expect(moveShelfBook(order, id, before)).toBe(order);
        }
    });
    it('migrates legacy order to balanced tier membership and assigns additions to the shorter tier', () => {
        const migrated = reconcileShelfArrangement({ order: ['a', 'b', 'c', 'd'], tierIds: null }, ['a', 'b', 'c', 'd']);
        expect(migrated.tierIds).toEqual({ top: ['a', 'b'], bottom: ['c', 'd'] });
        const extended = reconcileShelfArrangement({ order: migrated.order, tierIds: migrated.tierIds }, ['a', 'b', 'c', 'd', 'new']);
        expect(extended.tierIds).toEqual({ top: ['a', 'b', 'new'], bottom: ['c', 'd'] });
    });
    it('moves one book between Horizontal tiers without changing neighboring membership', () => {
        const start = { order: ['a', 'b', 'c', 'd', 'e', 'f'], tierIds: initialShelfTierIds(['a', 'b', 'c', 'd', 'e', 'f']) };
        const draft = createShelfDraft(start);
        const moved = moveHorizontalShelfDraft(draft, 'b', 'bottom', 'e');
        expect(moved.order).toEqual(['a', 'c', 'd', 'b', 'e', 'f']);
        expect(moved.tierIds).toEqual({ top: ['a', 'c'], bottom: ['d', 'b', 'e', 'f'] });
        expect(moved.previous).toEqual(start);
        expect(moved.tierIds.top).toContain('c');
        expect(moved.tierIds.bottom).toContain('d');
    });
    it('Undo restores both order and tier membership, while Vertical moves preserve membership', () => {
        const start = { order: ['a', 'b', 'c', 'd', 'e', 'f'], tierIds: initialShelfTierIds(['a', 'b', 'c', 'd', 'e', 'f']) };
        const first = moveHorizontalShelfDraft(createShelfDraft(start), 'b', 'bottom', 'e');
        const undone = undoShelfDraft(first);
        expect(undone.order).toEqual(start.order);
        expect(undone.tierIds).toEqual(start.tierIds);
        expect(undone.previous).toBeNull();
        const vertical = moveShelfDraft(createShelfDraft(start), 'd', 'a');
        expect(vertical.order).toEqual(['d', 'a', 'b', 'c', 'e', 'f']);
        expect(vertical.tierIds).toEqual(start.tierIds);
    });
    it('undoes exactly one completed shared move and ignores no-op drops', () => {
        const start = { order: ['a', 'b', 'c'], tierIds: initialShelfTierIds(['a', 'b', 'c']) };
        const first = moveShelfDraft(createShelfDraft(start), 'c', 'a');
        const second = moveShelfDraft(first, 'a', null);
        const noop = moveShelfDraft(second, 'c', 'b');
        expect(noop).toBe(second);
        const undone = undoShelfDraft(noop);
        expect(undone.order).toEqual(first.order);
        expect(undone.previous).toBeNull();
        expect(undoShelfDraft(undone)).toBe(undone);
    });
    it('reads the v1 order and validates v2 tier membership', () => {
        expect(parseShelfOrder(null)).toBeNull();
        expect(parseShelfOrder('{"version":1,"ids":["a","b"]}')).toEqual({ order: ['a', 'b'], tierIds: null });
        expect(parseShelfOrder('{"version":2,"ids":["a","b"],"tiers":{"top":["a"],"bottom":["b"]}}'))
            .toEqual({ order: ['a', 'b'], tierIds: { top: ['a'], bottom: ['b'] } });
        for (const raw of ['bad json', '{"version":3,"ids":[]}', '{"version":1,"ids":["a","a"]}',
            '{"version":1,"ids":[4]}', '{"version":2,"ids":["a","b"],"tiers":{"top":["a"],"bottom":[]}}',
            '{"version":2,"ids":["a","b"],"tiers":{"top":["a","b"],"bottom":["b"]}}']) {
            expect(() => parseShelfOrder(raw)).toThrow();
        }
    });
});

describe('vertical-only drop and edge-scroll geometry', () => {
    const rows = { top: { y: 28, height: 192 }, bottom: { y: 238, height: 192 } };
    const layouts = [
        { id: 'a', row: 'top' as const, offsetLeft: 12, width: 24, height: 150 },
        { id: 'b', row: 'top' as const, offsetLeft: 38, width: 44, height: 150 },
        { id: 'c', row: 'bottom' as const, offsetLeft: 12, width: 32, height: 150 },
        { id: 'd', row: 'bottom' as const, offsetLeft: 46, width: 32, height: 150 },
    ];
    const drop = (x: number, y: number) => resolveVerticalShelfDrop({ contentX: x, localY: y, draggedId: 'a', order: ['a', 'b', 'c', 'd'], layouts, rows });
    it('maps insertion in another row and its final position to canonical IDs', () => {
        expect(drop(13, 350)).toMatchObject({ beforeId: 'd', row: 'bottom', x: 12 });
        expect(drop(200, 350)).toMatchObject({ beforeId: null, row: 'bottom', x: 78 });
    });
    it('maps the upper-row end before the lower-row first entry', () => {
        expect(drop(200, 180)).toMatchObject({ beforeId: 'c', row: 'top', x: 82 });
    });
    it.each([2, 5, 6])('keeps every drop in its indicated tier after projecting %i books', (count) => {
        const order = Array.from({ length: count }, (_, index) => String(index));
        const split = splitShelfRows(order);
        const projectedLayouts: SweptSpineBookLayout[] = (['top', 'bottom'] as const).flatMap((row) =>
            split[row].map((id, index) => ({ id, row, offsetLeft: 12 + index * 34, width: 32, height: 150 })));
        for (const draggedId of order) {
            for (const row of ['top', 'bottom'] as const) {
                for (const contentX of [0, 45, 79, 200]) {
                    const target = resolveVerticalShelfDrop({ contentX, localY: row === 'top' ? 180 : 350,
                        draggedId, order, layouts: projectedLayouts, rows });
                    expect(target).not.toBeNull();
                    const moved = moveShelfBook(order, draggedId, target!.beforeId);
                    expect(splitShelfRows(moved)[row]).toContain(draggedId);
                    expect([...moved].sort()).toEqual(order);
                }
            }
        }
    });
    it('moves boundary books to the opposite tier rather than reporting a no-op', () => {
        const order = ['a', 'b', 'c', 'd'];
        const lowerStart = resolveVerticalShelfDrop({ contentX: 0, localY: 350, draggedId: 'b', order, layouts, rows })!;
        expect(moveShelfBook(order, 'b', lowerStart.beforeId)).toEqual(['a', 'c', 'b', 'd']);
        const upperEnd = resolveVerticalShelfDrop({ contentX: 200, localY: 180, draggedId: 'c', order, layouts, rows })!;
        expect(moveShelfBook(order, 'c', upperEnd.beforeId)).toEqual(['a', 'c', 'b', 'd']);
    });
    it('refuses a drop outside the two usable tier bands', () => {
        expect(drop(12, -20)).toBeNull();
        expect(drop(12, 460)).toBeNull();
    });
    it('scrolls progressively near edges and stops at the actual content boundary', () => {
        expect(shelfEdgeScrollStep(150, 300, 40, 600, 16)).toBe(40);
        expect(shelfEdgeScrollStep(290, 300, 40, 600, 16)).toBeGreaterThan(40);
        expect(shelfEdgeScrollStep(299, 300, 299, 600, 100)).toBe(300);
        expect(shelfEdgeScrollStep(1, 300, 0, 600, 16)).toBe(0);
        expect(shelfEdgeScrollStep(299, 300, 0, 300, 16)).toBe(0);
    });
});
