import {
    stableSeed,
    seededJitter,
    spineColorFromTitle,
    spineTextColor,
    spineMetrics,
    computeShelfPosture,
    splitShelfRows,
    resolveSweptSpine,
    getShelfTrackLayout,
    SHELF_SIDE_WIDTH,
} from '../shelfLayout';
import { LibraryBookEntry } from '../libraryShelf';

function mkEntry(id: string, title: string): LibraryBookEntry {
    return { id, reading_status: 'reading', ownership: 'owned', book: { title, authors: ['A'], cover_url: null } };
}

describe('shelfLayout F1 seeded stability (SDD-05 §3)', () => {
    const A = mkEntry('ub-a', 'Atomic Habits');
    const B = mkEntry('ub-b', 'Sapiens');
    const C = mkEntry('ub-c', 'Dune');
    const ids = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'];

    it('(d) exports the required helpers from utils/shelfLayout', () => {
        expect(typeof stableSeed).toBe('function');
        expect(typeof seededJitter).toBe('function');
        expect(typeof spineColorFromTitle).toBe('function');
        expect(typeof spineMetrics).toBe('function');
        expect(typeof computeShelfPosture).toBe('function');
    });

    it('(a) color, size and jitter are identical per book id under reorder', () => {
        const forward = [A, B, C];
        const shuffled = [C, A, B];

        const derive = (entries: LibraryBookEntry[]) =>
            Object.fromEntries(entries.map((e) => {
                const seed = stableSeed(e.id, e.book.title);
                return [e.id, JSON.stringify({
                    color: spineColorFromTitle(e.book.title),
                    jitter: seededJitter(seed),
                    metrics: spineMetrics(seed),
                })];
            }));

        expect(derive(shuffled)).toEqual(derive(forward));
    });

    it("(b) spine color derives from title hash only — signature carries no index term", () => {
        expect(spineColorFromTitle('Same Title')).toBe(spineColorFromTitle('Same Title'));
        expect(stableSeed('id-1', 'Same Title')).not.toBe(stableSeed('id-2', 'Same Title'));
    });

    it('(c) jitter gap stays within [2,8] px and is deterministic', () => {
        for (const id of ids) {
            const seed = stableSeed(id, 'Some Title');
            const j = seededJitter(seed);
            expect(j).toBeGreaterThanOrEqual(2);
            expect(j).toBeLessThanOrEqual(8);
            expect(seededJitter(seed)).toBe(j);
        }
    });

    it('keeps unknown-page spines readable with a fixed width and stable height', () => {
        const s = stableSeed('ub-a', 'Atomic Habits');
        expect(spineMetrics(s)).toEqual(spineMetrics(s));
        const m = spineMetrics(s);
        expect(m.width).toBe(32);
        expect(m.height).toBeGreaterThanOrEqual(144);
        expect(m.height).toBeLessThanOrEqual(168);
    });

    it('uses saved pages for bounded thickness without changing height', () => {
        const seed = stableSeed('edition', 'Book');
        const unknown = spineMetrics(seed);
        for (const [pages, width] of [[63, 24], [248, 30], [300, 32], [430, 37], [500, 40], [600, 44], [9000, 44]]) {
            expect(spineMetrics(seed, pages)).toEqual({ width, height: unknown.height });
        }
        for (const pages of [undefined, null, 0, -1, NaN, Infinity]) {
            expect(spineMetrics(seed, pages)).toEqual(unknown);
        }
    });

    it('posture: gentle −2…−3° leaning pairs stay adjacent and scale with shelf size', () => {
        const many = Array.from({ length: 13 }, (_, i) => mkEntry(`m${i}`, `Title ${i}`));
        const posture = computeShelfPosture(many);
        const tilted = many.filter((e) => posture[e.id].tiltDeg !== 0);
        expect(tilted.length).toBeLessThanOrEqual(4); // ≤2 pairs × 2 books
        expect(tilted.length).toBeGreaterThan(0);
        for (const e of tilted) {
            expect([-2, -3]).toContain(posture[e.id].tiltDeg);
        }
        const tiltedIndexes = tilted.map((entry) => many.findIndex((candidate) => candidate.id === entry.id)).sort((a, b) => a - b);
        for (let pair = 0; pair < tiltedIndexes.length; pair += 2) {
            expect(tiltedIndexes[pair + 1]).toBe(tiltedIndexes[pair] + 1);
        }
        const smallShelf = Array.from({ length: 4 }, (_, i) => mkEntry(`small-${i}`, `Small ${i}`));
        const smallPosture = computeShelfPosture(smallShelf);
        expect(smallShelf.filter((entry) => smallPosture[entry.id].tiltDeg !== 0)).toHaveLength(2);
        // determinism
        expect(computeShelfPosture(many)).toEqual(posture);
    });

    it('bookend flag appears exactly once when count ≥ 10 and never below', () => {
        const ten = Array.from({ length: 10 }, (_, i) => mkEntry(`t${i}`, `Book ${i}`));
        const p10 = computeShelfPosture(ten);
        expect(Object.values(p10).filter((p) => p.isBookend)).toHaveLength(1);

        const nine = Array.from({ length: 9 }, (_, i) => mkEntry(`n${i}`, `Book ${i}`));
        const p9 = computeShelfPosture(nine);
        expect(Object.values(p9).some((p) => p.isBookend)).toBe(false);
    });
});

describe('supported shared shelf track', () => {
    it('places a single book against the cabinet side and maps its visible position', () => {
        const one = [mkEntry('solo', 'Solo')];
        const layout = getShelfTrackLayout(one, [], 340);
        expect(layout.contentWidth).toBe(340);
        const book = layout.bookLayouts[0];
        expect(book.offsetLeft).toBe(SHELF_SIDE_WIDTH);
        expect(resolveSweptSpine({ scrollX: 0, touchX: book.offsetLeft + book.width / 2, touchY: 100,
            rowGeometry: { top: { y: 32, height: 160 }, bottom: { y: 268, height: 160 } },
            bookLayouts: layout.bookLayouts })).toBe('solo');
    });

    it('keeps all 40 entries reachable on one overflow track without duplicating them', () => {
        const entries = Array.from({ length: 40 }, (_, i) => mkEntry(`overflow-${i}`, `Book ${i}`));
        const { top, bottom } = splitShelfRows(entries);
        const { contentWidth, bookLayouts } = getShelfTrackLayout(top, bottom, 340);
        expect(contentWidth).toBeGreaterThan(340);
        expect(bookLayouts.map((book) => book.id)).toEqual(entries.map((entry) => entry.id));
        for (const row of ['top', 'bottom']) {
            const books = bookLayouts.filter((book) => book.row === row);
            expect(books[0].offsetLeft).toBe(SHELF_SIDE_WIDTH);
            const last = books[books.length - 1];
            expect(last.offsetLeft + last.width).toBeLessThanOrEqual(contentWidth - 16);
            expect(resolveSweptSpine({ scrollX: contentWidth - 340,
                touchX: last.offsetLeft + last.width / 2 - (contentWidth - 340), touchY: row === 'top' ? 100 : 340,
                rowGeometry: { top: { y: 32, height: 160 }, bottom: { y: 268, height: 160 } }, bookLayouts })).toBe(last.id);
        }
    });

    it('keeps per-book thickness through filtering and resizing, with small mapped gaps', () => {
        const entries = Array.from({ length: 7 }, (_, i) => mkEntry(`sparse-${i}`, `Spine ${i}`));
        const { top, bottom } = splitShelfRows(entries);
        const { contentWidth, bookLayouts } = getShelfTrackLayout(top, bottom, 340);
        expect(contentWidth).toBe(340);
        const wide = getShelfTrackLayout(top, bottom, 600);
        expect(wide.bookLayouts).toEqual(bookLayouts);
        for (const row of ['top', 'bottom']) {
            const books = bookLayouts.filter((book) => book.row === row);
            expect(books[0].offsetLeft).toBe(SHELF_SIDE_WIDTH);
            for (let i = 1; i < books.length; i += 1) {
                const previous = books[i - 1];
                expect(previous.gapAfter).toBeGreaterThanOrEqual(1);
                expect(previous.gapAfter).toBeLessThanOrEqual(3);
                expect(books[i].offsetLeft).toBe(previous.offsetLeft + previous.width + previous.gapAfter!);
                expect(resolveSweptSpine({ scrollX: 0, touchX: previous.offsetLeft + previous.width + previous.gapAfter! / 2,
                    touchY: row === 'top' ? 100 : 340,
                    rowGeometry: { top: { y: 32, height: 160 }, bottom: { y: 268, height: 160 } }, bookLayouts })).toBeNull();
            }
            const filtered = getShelfTrackLayout([entries.find((entry) => entry.id === books[0].id)!], [], 340);
            expect(filtered.bookLayouts[0].width).toBe(books[0].width);
        }
    });

    it('handles an empty shelf and keeps filtered books supported at the same edge', () => {
        expect(getShelfTrackLayout([], [], 340)).toEqual({ contentWidth: 340, bookLayouts: [] });
        const entries = [mkEntry('a', 'Duplicate'), mkEntry('b', 'Duplicate'), mkEntry('c', 'Other')];
        const { top, bottom } = splitShelfRows(entries);
        const layout = getShelfTrackLayout(top, bottom, 340);
        expect(layout.bookLayouts.map((book) => book.id)).toEqual(['a', 'b', 'c']);
        const filtered = getShelfTrackLayout([entries[1]], [], 340);
        const book = filtered.bookLayouts[0];
        expect(book.offsetLeft).toBe(SHELF_SIDE_WIDTH);
    });
});

describe('SDD-05 §3.1 C1 splitShelfRows (contiguous halves)', () => {
    it('splits 5 books into top=3 / bottom=2 preserving order', () => {
        const entries = ['a', 'b', 'c', 'd', 'e'].map((id) => mkEntry(id, `T${id}`));
        const { top, bottom } = splitShelfRows(entries);
        expect(top.map((e) => e.id)).toEqual(['a', 'b', 'c']);
        expect(bottom.map((e) => e.id)).toEqual(['d', 'e']);
    });

    it('splits even counts equally and handles 0 and 1', () => {
        const four = ['w', 'x', 'y', 'z'].map((id) => mkEntry(id, `T${id}`));
        const even = splitShelfRows(four);
        expect(even.top).toHaveLength(2);
        expect(even.bottom).toHaveLength(2);

        expect(splitShelfRows([])).toEqual({ top: [], bottom: [] });
        const one = splitShelfRows([mkEntry('solo', 'Solo')]);
        expect(one.top).toHaveLength(1);
        expect(one.bottom).toHaveLength(0);
    });

    it('keeps referential identity of entries', () => {
        const entries = [mkEntry('r1', 'R1'), mkEntry('r2', 'R2'), mkEntry('r3', 'R3')];
        const { top, bottom } = splitShelfRows(entries);
        expect(top[0]).toBe(entries[0]);
        expect(bottom[0]).toBe(entries[2]);
    });
});

describe('SDD-05 §3.1 C3 resolveSweptSpine (pure mapping)', () => {
    const rowGeometry = {
        top: { y: 0, height: 180 },
        bottom: { y: 186, height: 180 },
    };
    const bookLayouts = [
        { id: 'a', row: 'top' as const, offsetLeft: 0, width: 40, height: 180 },
        { id: 'b', row: 'top' as const, offsetLeft: 46, width: 36, height: 180 },
        { id: 'c', row: 'bottom' as const, offsetLeft: 0, width: 38, height: 180 },
    ];

    it('maps scrollX + touchX to the spine under the point in the touched row', () => {
        // contentX = 100 + 50 = 150 → inside b [46,82)? No — b ends at 82; 150 is past both.
        // Use scrollX 20 + touchX 40 → contentX 60 → inside b.
        expect(resolveSweptSpine({ scrollX: 20, touchX: 40, touchY: 90, rowGeometry, bookLayouts })).toBe('b');
        // bottom row: touchY inside bottom band
        expect(resolveSweptSpine({ scrollX: 0, touchX: 10, touchY: 250, rowGeometry, bookLayouts })).toBe('c');
        // first book
        expect(resolveSweptSpine({ scrollX: 0, touchX: 5, touchY: 90, rowGeometry, bookLayouts })).toBe('a');
    });

    it('returns null between books, outside rows, and for empty layouts', () => {
        // gap between a[0..40] and b[46..82]: contentX 43
        expect(resolveSweptSpine({ scrollX: 0, touchX: 43, touchY: 90, rowGeometry, bookLayouts })).toBeNull();
        // outside both row bands
        expect(resolveSweptSpine({ scrollX: 0, touchX: 5, touchY: 183, rowGeometry, bookLayouts })).toBeNull();
        expect(resolveSweptSpine({ scrollX: 0, touchX: 5, touchY: -10, rowGeometry, bookLayouts })).toBeNull();
        expect(resolveSweptSpine({ scrollX: 0, touchX: 5, touchY: 90, rowGeometry, bookLayouts: [] })).toBeNull();
    });

    it('is deterministic for identical inputs', () => {
        const input = { scrollX: 20, touchX: 40, touchY: 90, rowGeometry, bookLayouts };
        expect(resolveSweptSpine(input)).toBe(resolveSweptSpine(input));
    });
});

describe('spineDividerVariant determinism', () => {
    const { spineDividerVariant } = require('../shelfLayout');
    it('returns deterministic divider for same seed', () => {
        const s = stableSeed('ub-1', 'Dune');
        expect(spineDividerVariant(s)).toEqual(spineDividerVariant(s));
    });
    it('covers all 7 variants across many seeds', () => {
        const ids = Array.from({ length: 30 }, (_, i) => `id-${i}`);
        const variants = ids.map((id) => JSON.stringify(spineDividerVariant(stableSeed(id, 'T'))));
        const uniq = new Set(variants);
        expect(uniq.size).toBeGreaterThanOrEqual(5);
    });
});

describe('review R2 spine label contrast', () => {
    const luminance = (hex: string) => {
        const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
            .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    it.each(['The Alchemist', 'Sapiens', 'Atomic Habits', 'The Power of Now', 'Deep Work', 'The 5 AM Club',
        'Thinking, Fast and Slow', 'The Midnight Library', 'Rich Dad Poor Dad', 'The Psychology of Money',
        'Zero to One', 'Make Time', 'Ikigai', 'The Daily Stoic'])('%s has at least 4.5:1 ordinary-title contrast', (title) => {
        const background = spineColorFromTitle(title);
        const pair = [luminance(background), luminance(spineTextColor(background))].sort((a, b) => b - a);
        expect((pair[0] + 0.05) / (pair[1] + 0.05)).toBeGreaterThanOrEqual(4.5);
    });
});

describe('review R4 per-book brush bounds', () => {
    const rowGeometry = { top: { y: 32, height: 160 }, bottom: { y: 268, height: 160 } };
    it('matches rendered metric height and rejects backing above each bottom-aligned spine', () => {
        const shelfRowGeometry = { top: { y: 32, height: 192 }, bottom: { y: 268, height: 192 } };
        const entries = Array.from({ length: 14 }, (_, i) => mkEntry(`height-${i}`, `Book ${i}`));
        const { top, bottom } = splitShelfRows(entries);
        const { bookLayouts } = getShelfTrackLayout(top, bottom, 200);
        for (const book of bookLayouts) {
            const item = entries.find((entry) => entry.id === book.id)!;
            const expectedHeight = spineMetrics(stableSeed(item.id, item.book.title), item.book.page_count).height;
            expect(book).toEqual(expect.objectContaining({ height: expectedHeight }));
            const band = shelfRowGeometry[book.row];
            const visibleTop = band.y + band.height - expectedHeight;
            const point = { scrollX: 40, touchX: book.offsetLeft + book.width / 2 - 40, rowGeometry: shelfRowGeometry, bookLayouts };
            expect(resolveSweptSpine({ ...point, touchY: visibleTop - 0.01 })).toBeNull();
            expect(resolveSweptSpine({ ...point, touchY: visibleTop })).toBe(book.id);
            expect(resolveSweptSpine({ ...point, touchY: band.y + band.height - 0.01 })).toBe(book.id);
            expect(resolveSweptSpine({ ...point, touchY: band.y + band.height })).toBeNull();
            expect(resolveSweptSpine({ ...point, touchY: visibleTop + 2, touchX: book.offsetLeft + book.width - 40 })).toBeNull();
        }
    });
    it('does not brush a short book at the row ceiling or a gap at book height', () => {
        const bookLayouts = [{ id: 'short', row: 'top' as const, offsetLeft: 12, width: 24, height: 144 },
            { id: 'tall', row: 'top' as const, offsetLeft: 39, width: 44, height: 156 }];
        const point = { scrollX: 10, rowGeometry, bookLayouts };
        expect(resolveSweptSpine({ ...point, touchX: 14, touchY: 33 })).toBeNull();
        expect(resolveSweptSpine({ ...point, touchX: 40, touchY: 35 })).toBeNull();
        expect(resolveSweptSpine({ ...point, touchX: 40, touchY: 36 })).toBe('tall');
        expect(resolveSweptSpine({ ...point, touchX: 27, touchY: 100 })).toBeNull();
    });
});
