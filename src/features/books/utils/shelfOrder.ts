import { ShelfRow, splitShelfRows } from './shelfLayout';

// IDs are user_books IDs, never titles or pixels. `order` remains the shared
// List/Vertical sequence; tierIds gives Horizontal stable tier membership.
export type ShelfTierIds = { top: string[]; bottom: string[] };
export type ShelfArrangement = { order: string[]; tierIds: ShelfTierIds };
export type ParsedShelfArrangement = { order: string[]; tierIds: ShelfTierIds | null };
export type ShelfDraft = ShelfArrangement & { previous: ShelfArrangement | null };

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

export function initialShelfTierIds(order: string[]): ShelfTierIds {
    const split = splitShelfRows(order);
    return { top: split.top, bottom: split.bottom };
}

export function reconcileShelfArrangement(saved: ParsedShelfArrangement | null, available: string[]): ShelfArrangement {
    const order = reconcileShelfOrder(saved?.order ?? null, available);
    if (!saved?.tierIds) return { order, tierIds: initialShelfTierIds(order) };

    const availableIds = new Set(order);
    const top = new Set(saved.tierIds.top.filter((id) => availableIds.has(id)));
    const bottom = new Set(saved.tierIds.bottom.filter((id) => availableIds.has(id) && !top.has(id)));

    // New books keep the previous append-to-order behavior and join the
    // currently shorter tier. Ties consistently go to the upper tier.
    for (const id of order) {
        if (top.has(id) || bottom.has(id)) continue;
        (top.size <= bottom.size ? top : bottom).add(id);
    }

    return { order, tierIds: {
        top: order.filter((id) => top.has(id)),
        bottom: order.filter((id) => bottom.has(id)),
    } };
}

export function moveShelfBook(order: string[], id: string, beforeId: string | null): string[] {
    if (!order.includes(id) || id === beforeId || (beforeId !== null && !order.includes(beforeId))) return order;
    const next = order.filter((entry) => entry !== id);
    next.splice(beforeId === null ? next.length : next.indexOf(beforeId), 0, id);
    return next.every((entry, index) => entry === order[index]) ? order : next;
}

function sameArrangement(left: ShelfArrangement, right: ShelfArrangement): boolean {
    return left.order.length === right.order.length
        && left.order.every((id, index) => id === right.order[index])
        && left.tierIds.top.length === right.tierIds.top.length
        && left.tierIds.top.every((id, index) => id === right.tierIds.top[index])
        && left.tierIds.bottom.length === right.tierIds.bottom.length
        && left.tierIds.bottom.every((id, index) => id === right.tierIds.bottom[index]);
}

function orderTierMembership(order: string[], tierIds: ShelfTierIds): ShelfTierIds {
    const top = new Set(tierIds.top);
    return { top: order.filter((id) => top.has(id)), bottom: order.filter((id) => !top.has(id)) };
}

export function moveShelfBookToTier(arrangement: ShelfArrangement, id: string, row: ShelfRow, beforeId: string | null): ShelfArrangement {
    if (!arrangement.order.includes(id)) return arrangement;
    const top = new Set(arrangement.tierIds.top);
    const bottom = new Set(arrangement.tierIds.bottom);
    const source = top.has(id) ? 'top' : bottom.has(id) ? 'bottom' : null;
    if (!source || (beforeId !== null && beforeId !== id && !(row === 'top' ? top : bottom).has(beforeId))) return arrangement;
    if (beforeId === id) return arrangement;

    const orderWithoutDragged = arrangement.order.filter((entry) => entry !== id);
    const destinationInOrder = orderWithoutDragged.filter((entry) => (row === 'top' ? top : bottom).has(entry));
    let insertionIndex: number;
    if (beforeId !== null) {
        insertionIndex = orderWithoutDragged.indexOf(beforeId);
        if (insertionIndex < 0) return arrangement;
    } else {
        const lastDestinationId = destinationInOrder[destinationInOrder.length - 1];
        insertionIndex = lastDestinationId === undefined
            ? orderWithoutDragged.length
            : orderWithoutDragged.indexOf(lastDestinationId) + 1;
    }

    const order = [...orderWithoutDragged];
    order.splice(insertionIndex, 0, id);
    if (row === 'top') { top.add(id); bottom.delete(id); }
    else { bottom.add(id); top.delete(id); }
    const next: ShelfArrangement = { order, tierIds: {
        top: order.filter((entry) => top.has(entry)),
        bottom: order.filter((entry) => bottom.has(entry)),
    } };
    return sameArrangement(arrangement, next) ? arrangement : next;
}

export const createShelfDraft = (arrangement: ShelfArrangement): ShelfDraft => ({
    order: [...arrangement.order],
    tierIds: { top: [...arrangement.tierIds.top], bottom: [...arrangement.tierIds.bottom] },
    previous: null,
});

function withPrevious(draft: ShelfDraft, next: ShelfArrangement): ShelfDraft {
    if (sameArrangement({ order: draft.order, tierIds: draft.tierIds }, next)) return draft;
    return { ...next, previous: {
        order: [...draft.order],
        tierIds: { top: [...draft.tierIds.top], bottom: [...draft.tierIds.bottom] },
    } };
}

export function moveShelfDraft(draft: ShelfDraft, id: string, beforeId: string | null): ShelfDraft {
    const order = moveShelfBook(draft.order, id, beforeId);
    return order === draft.order ? draft : withPrevious(draft, { order, tierIds: orderTierMembership(order, draft.tierIds) });
}

export function moveHorizontalShelfDraft(draft: ShelfDraft, id: string, row: ShelfRow, beforeId: string | null): ShelfDraft {
    const current = { order: draft.order, tierIds: draft.tierIds };
    const next = moveShelfBookToTier(current, id, row, beforeId);
    return next === current ? draft : withPrevious(draft, next);
}

export function undoShelfDraft(draft: ShelfDraft): ShelfDraft {
    return draft.previous ? { ...draft.previous, previous: null } : draft;
}

function readUniqueIds(value: unknown): string[] | null {
    if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !id)
        || new Set(value).size !== value.length) return null;
    return value as string[];
}

export function parseShelfOrder(raw: string | null): ParsedShelfArrangement | null {
    if (raw === null) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !('version' in data) || !('ids' in data)) {
        throw new Error('Invalid shelf arrangement');
    }
    const order = readUniqueIds(data.ids);
    if (!order) throw new Error('Invalid shelf arrangement');
    if (data.version === 1) return { order, tierIds: null };
    if (data.version !== 2 || !('tiers' in data) || !data.tiers || typeof data.tiers !== 'object'
        || !('top' in data.tiers) || !('bottom' in data.tiers)) {
        throw new Error('Invalid shelf arrangement');
    }
    const top = readUniqueIds(data.tiers.top);
    const bottom = readUniqueIds(data.tiers.bottom);
    if (!top || !bottom) throw new Error('Invalid shelf arrangement');
    const membership = [...top, ...bottom];
    const membershipSet = new Set(membership);
    if (membershipSet.size !== membership.length || membership.length !== order.length
        || order.some((id) => !membershipSet.has(id))) {
        throw new Error('Invalid shelf arrangement');
    }
    return { order, tierIds: { top, bottom } };
}
