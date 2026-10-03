// Layout-independent arrangement. IDs are user_books IDs, never titles or pixels.
export type ShelfDraft = { order: string[]; previous: string[] | null };

export function reconcileShelfOrder(saved: string[] | null, available: string[]): string[] {
    const availableIds = [...new Set(available)];
    if (saved === null) return availableIds;
    const remaining = new Set(availableIds);
    const result: string[] = [];
    for (const id of saved) {
        if (remaining.delete(id)) result.push(id);
    }
    return [...result, ...availableIds.filter((id) => remaining.has(id))];
}

export function moveShelfBook(order: string[], id: string, beforeId: string | null): string[] {
    if (!order.includes(id) || id === beforeId || (beforeId !== null && !order.includes(beforeId))) return order;
    const next = order.filter((entry) => entry !== id);
    next.splice(beforeId === null ? next.length : next.indexOf(beforeId), 0, id);
    return next.every((entry, index) => entry === order[index]) ? order : next;
}

export const createShelfDraft = (order: string[]): ShelfDraft => ({ order: [...order], previous: null });
export function moveShelfDraft(draft: ShelfDraft, id: string, beforeId: string | null): ShelfDraft {
    const next = moveShelfBook(draft.order, id, beforeId);
    return next === draft.order ? draft : { order: next, previous: draft.order };
}
export function undoShelfDraft(draft: ShelfDraft): ShelfDraft {
    return draft.previous ? { order: draft.previous, previous: null } : draft;
}

export function parseShelfOrder(raw: string | null): string[] | null {
    if (raw === null) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('ids' in data)
        || !Array.isArray(data.ids) || data.ids.some((id: unknown) => typeof id !== 'string' || !id)
        || new Set(data.ids).size !== data.ids.length) {
        throw new Error('Invalid shelf order');
    }
    return data.ids as string[];
}
