import { LibraryBookEntry } from './libraryShelf';
import { getHorizontalShelfLayout, HORIZONTAL_PILE_GAP, HORIZONTAL_SHELF_INSET } from './horizontalShelfLayout';
import { ShelfRow } from './shelfLayout';
import { initialShelfTierIds, moveShelfBookToTier, ShelfTierIds } from './shelfOrder';

export type HorizontalShelfDrop = { beforeId: string | null; row: ShelfRow; x: number; y: number; width: number; height: number };

/** Resolve a position within an independently ordered destination tier. */
export function resolveHorizontalShelfDrop({ pointerX, localY, draggedId, books, viewportWidth, fontScale = 1, offsets, tierIds }: {
    pointerX: number; localY: number; draggedId: string; books: LibraryBookEntry[]; viewportWidth: number;
    fontScale?: number; offsets: Record<ShelfRow, number>; tierIds?: ShelfTierIds;
}): HorizontalShelfDrop | null {
    if (!Number.isFinite(pointerX) || !Number.isFinite(localY) || !Number.isFinite(viewportWidth)
        || viewportWidth < 0 || pointerX < 0 || pointerX > viewportWidth) return null;
    const dragged = books.find((book) => book.id === draggedId);
    if (!dragged) return null;
    const ids = books.map((book) => book.id);
    const membership = tierIds ?? initialShelfTierIds(ids);
    const layout = getHorizontalShelfLayout(books, viewportWidth, fontScale, membership);
    const tier = layout.tiers.find((entry) => localY >= entry.y && localY < entry.y + entry.trackHeight);
    if (!tier) return null;

    const contentX = pointerX + offsets[tier.row];
    const pileIndex = Math.max(0, Math.min(tier.piles.length - 1,
        Math.floor((contentX - HORIZONTAL_SHELF_INSET + HORIZONTAL_PILE_GAP / 2) / (layout.pileWidth + HORIZONTAL_PILE_GAP))));
    const pile = tier.piles[pileIndex];
    const y = localY - tier.y;
    const lastPile = tier.piles[tier.piles.length - 1];
    const pastEnd = !lastPile || contentX > lastPile.x + lastPile.width + HORIZONTAL_PILE_GAP / 2;
    const target = !pastEnd ? pile?.volumes.find((volume) => volume.item.id !== draggedId && y < volume.y + volume.height / 2) : undefined;
    const afterPile = tier.piles.slice(pileIndex + 1).flatMap((entry) => entry.volumes)
        .find((volume) => volume.item.id !== draggedId)?.item.id;
    const beforeId = target?.item.id ?? (!pastEnd ? afterPile : undefined) ?? null;

    const projected = moveShelfBookToTier({ order: ids, tierIds: membership }, draggedId, tier.row, beforeId);
    const byId = new Map(books.map((book) => [book.id, book]));
    const projectedBooks = projected.order.flatMap((id) => {
        const book = byId.get(id);
        return book ? [book] : [];
    });
    const finalTier = getHorizontalShelfLayout(projectedBooks, viewportWidth, fontScale, projected.tierIds)
        .tiers.find((entry) => entry.row === tier.row)!;
    const finalVolume = finalTier.piles.flatMap((entry) => entry.volumes).find((volume) => volume.item.id === draggedId);
    if (!finalVolume) return null;
    return { beforeId, row: tier.row, x: finalVolume.x, y: finalTier.y + finalVolume.y,
        width: finalVolume.width, height: finalVolume.height };
}
