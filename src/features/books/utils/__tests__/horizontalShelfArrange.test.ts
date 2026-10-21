import { getHorizontalShelfLayout } from '../horizontalShelfLayout';
import { resolveHorizontalShelfDrop } from '../horizontalShelfArrange';
import { createShelfDraft, initialShelfTierIds, moveHorizontalShelfDraft, reconcileShelfArrangement } from '../shelfOrder';

const entries = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `b${i}`, reading_status: 'reading', ownership: 'owned', book: { title: 'Same title', page_count: i % 2 ? 300 : null } }));
describe('horizontal destination and projected marker', () => {
    it.each([1, 2, 3, 4, 5, 8, 9, 17, 902])('lands in the requested final tier and matches its actual rectangle for %i books', (count) => {
        const books = entries(count), width = 300;
        const arrangement = reconcileShelfArrangement(null, books.map((book) => book.id));
        const layout = getHorizontalShelfLayout(books, width, 1, arrangement.tierIds);
        for (const draggedId of [books[0].id, books[count - 1].id]) {
            for (const tier of layout.tiers.filter((t) => t.piles.length)) {
                for (const end of [false, true]) {
                    const offsets = { top: end ? layout.tiers[0].contentWidth - width : 0, bottom: end ? layout.tiers[1].contentWidth - width : 0 };
                    const drop = resolveHorizontalShelfDrop({ pointerX: end ? width - 5 : 25, localY: tier.y + (end ? tier.trackHeight - 1 : 35),
                        draggedId, books, viewportWidth: width, offsets, tierIds: arrangement.tierIds })!;
                    const draft = moveHorizontalShelfDraft(createShelfDraft(arrangement), draggedId, tier.row, drop.beforeId);
                    const reordered = draft.order.map((id) => books.find((b) => b.id === id)!);
                    const finalLayout = getHorizontalShelfLayout(reordered, width, 1, draft.tierIds);
                    const finalTier = finalLayout.tiers.find((t) => t.row === tier.row)!;
                    const volume = finalTier.piles.flatMap((p) => p.volumes).find((v) => v.item.id === draggedId)!;
                    expect(volume).toBeDefined();
                    expect(drop).toMatchObject({ row: tier.row, x: volume.x, y: finalTier.y + volume.y, width: volume.width, height: volume.height });
                    expect(new Set(draft.order).size).toBe(count);
                    for (const id of arrangement.order.filter((entry) => entry !== draggedId)) {
                        const priorRow = arrangement.tierIds.top.includes(id) ? 'top' : 'bottom';
                        const nextRow = draft.tierIds.top.includes(id) ? 'top' : 'bottom';
                        expect(nextRow).toBe(priorRow);
                    }
                }
            }
        }
    });
    it('uses only the destination track offset to choose a pile', () => {
        const books = entries(17), arrangement = reconcileShelfArrangement(null, entries(17).map((book) => book.id));
        const layout = getHorizontalShelfLayout(books, 300, 1, arrangement.tierIds);
        const common = { pointerX: 25, localY: layout.tiers[1].y + 35, draggedId: 'b0', books, viewportWidth: 300 };
        const first = resolveHorizontalShelfDrop({ ...common, tierIds: arrangement.tierIds, offsets: { top: 500, bottom: 0 } });
        const second = resolveHorizontalShelfDrop({ ...common, tierIds: arrangement.tierIds, offsets: { top: 0, bottom: 280 } });
        expect(first?.beforeId).toBe('b9');
        expect(second?.beforeId).toBe('b13');
    });
    it('accepts a move into an empty tier and rejects outside, plank and missing-book drops', () => {
        const books = entries(1), tierIds = initialShelfTierIds(['b0']), layout = getHorizontalShelfLayout(books, 300, 1, tierIds);
        const args = { pointerX: 40, localY: 100, draggedId: 'b0', books, viewportWidth: 300, offsets: { top: 0, bottom: 0 }, tierIds };
        const emptyTierDrop = resolveHorizontalShelfDrop({ ...args, localY: layout.tiers[1].y + 30 });
        expect(emptyTierDrop).toMatchObject({ row: 'bottom', beforeId: null });
        const moved = moveHorizontalShelfDraft(createShelfDraft({ order: ['b0'], tierIds }), 'b0', 'bottom', emptyTierDrop!.beforeId);
        expect(moved.tierIds).toEqual({ top: [], bottom: ['b0'] });
        const invalid = [{ pointerX: -1 }, { pointerX: 301 }, { localY: -1 }, { localY: layout.tiers[0].trackHeight + 1 },
            { localY: 600 }, { draggedId: 'missing' }, { pointerX: NaN }];
        for (const patch of invalid) {
            expect(resolveHorizontalShelfDrop({ ...args, ...patch })).toBeNull();
        }
    });
});
