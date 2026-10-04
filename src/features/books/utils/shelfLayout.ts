import { LibraryBookEntry } from './libraryShelf';
// Muted cloth palette from the confirmed vertical Stitch screen (SDD-05 §11).
const SPINE_COLORS = ['#445a70', '#853939', '#d6d0c4', '#627a4d', '#23354a', '#b8622c', '#454d52', '#363a40', '#c99a38', '#ded6cc', '#727a80', '#8a9164', '#bd7a42', '#2e3438'];
const REFERENCE_COLORS: Record<string, string> = {
    'the alchemist': '#445a70', sapiens: '#853939', 'atomic habits': '#d6d0c4',
    'the power of now': '#627a4d', 'deep work': '#23354a', 'the 5 am club': '#b8622c',
    'thinking, fast and slow': '#454d52', 'the midnight library': '#363a40',
    'rich dad poor dad': '#c99a38', 'the psychology of money': '#ded6cc',
    'zero to one': '#727a80', 'make time': '#8a9164', ikigai: '#bd7a42', 'the daily stoic': '#2e3438',
};

// SDD-05 §5: pure layout helpers — all randomness derives from id+title seeds, never array index.
export function stableSeed(id: string, title: string): number {
    const key = `${id}::${title}`;
    return key.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
}

export function seededJitter(seed: number): number {
    return 2 + (Math.abs(seed) % 7);
}

// SDD-05 §12: page count estimates thickness; seeded height adds a natural size mix without
// claiming physical dimensions the catalogue does not provide.
export function spineMetrics(seed: number, pageCount?: number | null): { width: number; height: number } {
    const width = typeof pageCount === 'number' && Number.isFinite(pageCount) && pageCount > 0
        ? Math.round(Math.min(44, Math.max(24, 20 + 0.04 * pageCount))) : 32;
    return { width, height: 144 + (Math.abs(seed) % 13) * 2 };
}

// SDD-05 §3: title hash only — no index term (stable across filter/reorder)
export function spineColorFromTitle(title: string): string {
    const reference = REFERENCE_COLORS[title.trim().toLowerCase()];
    if (reference) return reference;
    const h = title.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return SPINE_COLORS[h % SPINE_COLORS.length];
}

export function spineTextColor(background: string): string {
    const luminance = (hex: string) => {
        const linear = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
            .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const ink = '#080604';
    const paper = '#fffdf8';
    const backgroundLuminance = luminance(background);
    const inkContrast = (backgroundLuminance + 0.05) / (luminance(ink) + 0.05);
    const paperContrast = (luminance(paper) + 0.05) / (backgroundLuminance + 0.05);
    return inkContrast >= paperContrast ? ink : paper;
}

export type ShelfPosture = { tiltDeg: number; isBookend: boolean };

// A small number of adjacent volumes lean together. Posture is positional by nature
// (adjacency), so it changes with shelf order; individual colors and dimensions do not.
export function computeShelfPosture(entries: LibraryBookEntry[]): Record<string, ShelfPosture> {
    const count = entries.length;
    const posture: Record<string, ShelfPosture> = {};
    entries.forEach((e) => { posture[e.id] = { tiltDeg: 0, isBookend: false }; });
    if (count === 0) return posture;

    const maxPairs = count >= 24 ? 4 : count >= 12 ? 2 : count >= 4 ? 1 : 0;
    const occupied = new Set<number>();
    const firstSeed = stableSeed(entries[0].id, entries[0].book.title);
    const firstStart = Math.abs(firstSeed) % (count - 1);
    let pairs = 0;
    for (let offset = 0; offset < count - 1 && pairs < maxPairs; offset++) {
        const index = (firstStart + offset) % (count - 1);
        if (occupied.has(index) || occupied.has(index + 1)) continue;
        const seed = stableSeed(entries[index].id, entries[index].book.title);
        const tiltDeg = -(2 + (Math.abs(seed) % 2));
        posture[entries[index].id].tiltDeg = tiltDeg;
        posture[entries[index + 1].id].tiltDeg = tiltDeg;
        occupied.add(index);
        occupied.add(index + 1);
        pairs += 1;
    }

    if (count >= 10) {
        posture[entries[count - 1].id].isBookend = true;
    }
    return posture;
}

// SDD-05 §3.1 C1: contiguous halves — first ⌈n/2⌉ top row, remainder bottom; order preserved.
export type ShelfRow = 'top' | 'bottom';
export type SplitShelf<T> = { top: T[]; bottom: T[] };

export function splitShelfRows<T>(entries: T[]): SplitShelf<T> {
    const cut = Math.ceil(entries.length / 2);
    return { top: entries.slice(0, cut), bottom: entries.slice(cut) };
}

// SDD-05 §3.1 C3: pure scroll-position → spine mapping for silent brush feedback.
export type SweptSpineRowGeometry = { top: { y: number; height: number }; bottom: { y: number; height: number } };
export type SweptSpineBookLayout = { id: string; row: ShelfRow; offsetLeft: number; width: number; height: number; gapAfter?: number };

export const SHELF_SIDE_WIDTH = 12;
export const SHELF_BOOKEND_WIDTH = 20;
const SHELF_END_PADDING = 16;

const gapAfterBook = (entry: LibraryBookEntry, index: number, count: number) =>
    index < count - 1 ? 1 + (Math.abs(stableSeed(entry.id, entry.book.title)) % 3) : 0;

// Both rows rest against the left cabinet side; rendering and brush use identical geometry.
export function getShelfTrackLayout(top: LibraryBookEntry[], bottom: LibraryBookEntry[], viewportWidth: number) {
    const rowWidth = (entries: LibraryBookEntry[]) => entries.length === 0 ? 0 :
        SHELF_SIDE_WIDTH + SHELF_BOOKEND_WIDTH + SHELF_END_PADDING + entries.reduce((sum, entry, index) =>
            sum + spineMetrics(stableSeed(entry.id, entry.book.title), entry.book.page_count).width
                + gapAfterBook(entry, index, entries.length), 0);
    const contentWidth = Math.max(viewportWidth, rowWidth(top), rowWidth(bottom));
    const place = (entries: LibraryBookEntry[], row: ShelfRow): SweptSpineBookLayout[] => {
        let x = SHELF_SIDE_WIDTH;
        return entries.map((entry, index) => {
            const { width, height } = spineMetrics(stableSeed(entry.id, entry.book.title), entry.book.page_count);
            const gapAfter = gapAfterBook(entry, index, entries.length);
            const layout = { id: entry.id, row, offsetLeft: x, width, height, gapAfter };
            x += width + gapAfter;
            return layout;
        });
    };
    return { contentWidth, bookLayouts: [...place(top, 'top'), ...place(bottom, 'bottom')] };
}
export type SweptSpineInput = {
    scrollX: number;
    touchX: number;
    touchY: number;
    rowGeometry: SweptSpineRowGeometry;
    bookLayouts: SweptSpineBookLayout[];
};

export function resolveSweptSpine({ scrollX, touchX, touchY, rowGeometry, bookLayouts }: SweptSpineInput): string | null {
    const inTop = touchY >= rowGeometry.top.y && touchY < rowGeometry.top.y + rowGeometry.top.height;
    const inBottom = touchY >= rowGeometry.bottom.y && touchY < rowGeometry.bottom.y + rowGeometry.bottom.height;
    if (!inTop && !inBottom) return null;

    const row: ShelfRow = inTop ? 'top' : 'bottom';
    const contentX = scrollX + touchX;
    for (const layout of bookLayouts) {
        if (layout.row !== row) continue;
        const visibleTop = rowGeometry[row].y + rowGeometry[row].height - layout.height;
        if (touchY >= visibleTop && contentX >= layout.offsetLeft && contentX < layout.offsetLeft + layout.width) return layout.id;
    }
    return null;
}

export type SpineDivider = { height: number; width: string; color: string } | null;

export function spineDividerVariant(seed: number): SpineDivider {
    const v = Math.abs(seed) % 7;
    switch (v) {
        case 0:
            return { height: 8, width: '100%', color: 'rgba(0,0,0,0.20)' };
        case 1:
            return { height: 4, width: '100%', color: 'rgba(255,255,255,0.20)' };
        case 2:
            return { height: 12, width: '100%', color: 'rgba(0,0,0,0.10)' };
        case 3:
            return { height: 1, width: '80%', color: 'rgba(255,255,255,0.30)' };
        case 4:
            return { height: 2, width: '60%', color: 'rgba(240,224,209,0.30)' };
        default:
            return null;
    }
}
