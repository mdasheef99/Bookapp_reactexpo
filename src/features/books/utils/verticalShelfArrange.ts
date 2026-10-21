import { ShelfRow, SweptSpineBookLayout, SweptSpineRowGeometry } from './shelfLayout';

export type VerticalShelfDrop = { beforeId: string | null; row: ShelfRow; x: number };

export function resolveVerticalShelfDrop({ contentX, localY, draggedId, order, layouts, rows }: {
    contentX: number; localY: number; draggedId: string; order: string[];
    layouts: SweptSpineBookLayout[]; rows: SweptSpineRowGeometry;
}): VerticalShelfDrop | null {
    if (localY < rows.top.y || localY > rows.bottom.y + rows.bottom.height) return null;
    const row: ShelfRow = localY < (rows.top.y + rows.top.height + rows.bottom.y) / 2 ? 'top' : 'bottom';
    const cut = Math.ceil(order.length / 2);
    if (!order.includes(draggedId) || (row === 'bottom' && cut === order.length)) return null;
    const rowBooks = layouts.filter((book) => book.row === row && book.id !== draggedId);
    const target = rowBooks.find((book) => contentX < book.offsetLeft + book.width / 2);
    const last = rowBooks[rowBooks.length - 1];
    const rowEndIndex = row === 'top' ? cut : order.length;
    const nextId = order.slice(rowEndIndex).find((id) => id !== draggedId) ?? null;
    const remaining = order.filter((id) => id !== draggedId);
    const anchor = target?.id ?? nextId;
    const gapIndex = anchor === null ? remaining.length : remaining.indexOf(anchor);
    // Removal shifts the contiguous split. At its boundary, the visible gap's
    // anchor can otherwise leave the dragged book in the opposite tier.
    const firstSlot = row === 'top' ? 0 : cut;
    const lastSlot = row === 'top' ? cut - 1 : order.length - 1;
    const insertionIndex = Math.max(firstSlot, Math.min(lastSlot, gapIndex));
    return { beforeId: remaining[insertionIndex] ?? null, row,
        x: target ? target.offsetLeft : last ? last.offsetLeft + last.width + (last.gapAfter ?? 0) : 12 };
}

// Pixels per frame, bounded by actual overflow. Both vertical rows use one track.
export function shelfEdgeScrollStep(pointerX: number, viewport: number, scrollX: number, content: number, elapsedMs: number): number {
    const edge = Math.min(48, viewport / 4);
    if (edge <= 0) return 0;
    const velocity = pointerX < edge ? -Math.min(1, (edge - pointerX) / edge)
        : pointerX > viewport - edge ? Math.min(1, (pointerX - viewport + edge) / edge) : 0;
    return Math.max(0, Math.min(Math.max(0, content - viewport), scrollX + velocity * 360 * Math.min(32, elapsedMs) / 1000));
}
