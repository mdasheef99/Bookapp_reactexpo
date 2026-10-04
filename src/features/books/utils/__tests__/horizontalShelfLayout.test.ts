import { getHorizontalShelfLayout, horizontalVolumeHeight } from '../horizontalShelfLayout';
import { LibraryBookEntry } from '../libraryShelf';

const entries = (count: number): LibraryBookEntry[] => Array.from({ length: count }, (_, index) => ({
    id: `entry-${index}`, ownership: 'owned', reading_status: 'want_to_read',
    book: { title: 'Same title', page_count: index % 2 ? 800 : null },
}));

describe('horizontal shelf geometry', () => {
    it.each([0, 1, 2, 5, 8, 9, 17, 80])('places %i actual IDs once in contiguous tiers and piles of at most four', (count) => {
        const books = entries(count);
        const layout = getHorizontalShelfLayout(books, 342);
        expect(layout.tiers.flatMap((tier) => tier.piles.flatMap((pile) => pile.volumes.map((volume) => volume.item.id))))
            .toEqual(books.map((book) => book.id));
        expect(layout.tiers[0].piles.flatMap((pile) => pile.volumes)).toHaveLength(Math.ceil(count / 2));
        expect(layout.tiers.every((tier) => tier.piles.every((pile) => pile.volumes.length <= 4))).toBe(true);
    });

    it('rests every full and partial pile on the same plank without overlapping targets', () => {
        const layout = getHorizontalShelfLayout(entries(19), 342);
        for (const tier of layout.tiers) for (const pile of tier.piles) {
            const last = pile.volumes[pile.volumes.length - 1];
            expect(last.y + last.height).toBe(tier.trackHeight);
            pile.volumes.forEach((volume, index) => {
                expect(volume.height).toBeGreaterThanOrEqual(44);
                expect(volume.x).toBeGreaterThanOrEqual(pile.x);
                expect(volume.x + volume.width).toBeLessThanOrEqual(pile.x + pile.width);
                if (index) expect(volume.y).toBe(pile.volumes[index - 1].y + pile.volumes[index - 1].height);
            });
        }
    });

    it('keeps manually assigned tiers independent even when one tier is longer', () => {
        const books = entries(7);
        const layout = getHorizontalShelfLayout(books, 342, 1, { top: ['entry-0', 'entry-2'], bottom: ['entry-1', 'entry-3', 'entry-4', 'entry-5', 'entry-6'] });
        expect(layout.tiers[0].piles.flatMap((pile) => pile.volumes.map((volume) => volume.item.id)))
            .toEqual(['entry-0', 'entry-2']);
        expect(layout.tiers[1].piles.flatMap((pile) => pile.volumes.map((volume) => volume.item.id)))
            .toEqual(['entry-1', 'entry-3', 'entry-4', 'entry-5', 'entry-6']);
        expect(layout.tiers[0].contentWidth).toBeLessThan(layout.tiers[1].contentWidth);
    });

    it.each([null, undefined, 0, -1, NaN, Infinity])('uses a predictable thickness for unknown/invalid pages %s', (pages) => {
        expect(horizontalVolumeHeight(pages)).toBe(46);
    });
    it('bounds known page estimates and expands the cabinet with larger text', () => {
        expect(horizontalVolumeHeight(1)).toBe(44);
        expect(horizontalVolumeHeight(10000)).toBe(52);
        const normal = getHorizontalShelfLayout(entries(8), 342);
        const large = getHorizontalShelfLayout(entries(8), 342, 2);
        expect(large.height).toBeGreaterThan(normal.height);
        expect(large.tiers[0].piles[0].volumes.every((book) => book.height >= 88)).toBe(true);
    });
    it('creates overflow only from actual piles, caps widths on narrow screens and keeps independent content widths', () => {
        const sparse = getHorizontalShelfLayout(entries(2), 272);
        expect(sparse.tiers.every((tier) => tier.contentWidth === 272)).toBe(true);
        const many = getHorizontalShelfLayout(entries(17), 272);
        expect(many.tiers[0].contentWidth).toBeGreaterThan(many.tiers[1].contentWidth);
        expect(many.tiers[0].piles.every((pile) => pile.width <= 240)).toBe(true);
        expect(getHorizontalShelfLayout([], 0).height).toBeGreaterThan(0);
    });
});
