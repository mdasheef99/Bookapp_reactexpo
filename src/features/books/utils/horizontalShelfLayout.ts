import { LibraryBookEntry } from './libraryShelf';
import { ShelfRow, splitShelfRows } from './shelfLayout';
import type { ShelfTierIds } from './shelfOrder';

export const HORIZONTAL_PILE_GAP = 24;
export const HORIZONTAL_SHELF_INSET = 16;
export const HORIZONTAL_PLANK_HEIGHT = 20;
export type HorizontalVolumeLayout = {
    item: LibraryBookEntry; row: ShelfRow; pileIndex: number;
    x: number; y: number; width: number; height: number;
};
export type HorizontalPileLayout = { x: number; width: number; volumes: HorizontalVolumeLayout[] };
export type HorizontalTierLayout = {
    row: ShelfRow; y: number; trackHeight: number; contentWidth: number; piles: HorizontalPileLayout[];
};

/** A bounded visual page estimate, not a measurement of a physical edition. */
export function horizontalVolumeHeight(pageCount?: number | null): number {
    return typeof pageCount === 'number' && Number.isFinite(pageCount) && pageCount > 0
        ? Math.round(Math.min(52, Math.max(44, 42 + pageCount * 0.015))) : 46;
}

/** Canonical sequence: upper tier, then lower; each pile reads top to bottom. */
export function getHorizontalShelfLayout(books: LibraryBookEntry[], viewportWidth: number, fontScale = 1, tierIds?: ShelfTierIds) {
    const viewport = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
    const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
    const trackHeight = Math.ceil(4 * 52 * scale + 36 * scale);
    const tierHeight = trackHeight + HORIZONTAL_PLANK_HEIGHT;
    const pileWidth = Math.min(256, Math.max(44, viewport - HORIZONTAL_SHELF_INSET * 2));
    let split = splitShelfRows(books);
    if (tierIds) {
        const top = new Set(tierIds.top);
        const bottom = new Set(tierIds.bottom);
        const missing = books.filter((item) => !top.has(item.id) && !bottom.has(item.id));
        for (const item of missing) (top.size <= bottom.size ? top : bottom).add(item.id);
        split = {
            top: books.filter((item) => top.has(item.id)),
            bottom: books.filter((item) => bottom.has(item.id)),
        };
    }
    const tiers = (['top', 'bottom'] as const).map((row, tierIndex): HorizontalTierLayout => {
        const entries = split[row];
        const piles: HorizontalPileLayout[] = [];
        for (let start = 0; start < entries.length; start += 4) {
            const pileIndex = piles.length;
            const items = entries.slice(start, start + 4);
            const heights = items.map((item) => Math.ceil(horizontalVolumeHeight(item.book.page_count) * scale));
            const x = HORIZONTAL_SHELF_INSET + pileIndex * (pileWidth + HORIZONTAL_PILE_GAP);
            let y = trackHeight - heights.reduce((sum, height) => sum + height, 0);
            const volumes = items.map((item, index): HorizontalVolumeLayout => {
                const width = pileWidth - (items.length - index - 1) * Math.min(8, pileWidth * 0.03);
                // A shared spine edge keeps every title on one rail; subtle
                // variation at the free edge retains the feel of real editions.
                const volume = { item, row, pileIndex, x,
                    y, width, height: heights[index] };
                y += heights[index];
                return volume;
            });
            piles.push({ x, width: pileWidth, volumes });
        }
        const occupied = piles.length ? HORIZONTAL_SHELF_INSET * 2 + piles.length * pileWidth
            + (piles.length - 1) * HORIZONTAL_PILE_GAP : 0;
        return { row, y: tierIndex * tierHeight, trackHeight, contentWidth: Math.max(viewport, occupied), piles };
    });
    return { height: tierHeight * 2, pileWidth, tiers };
}
