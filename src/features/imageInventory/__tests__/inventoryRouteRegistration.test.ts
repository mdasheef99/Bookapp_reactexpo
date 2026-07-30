import fs from 'fs';
import path from 'path';

const routeRoot = path.join(process.cwd(), 'app', '(store-owner)', 'inventory');

describe('Phase 9 Unit 6B nested inventory route registration', () => {
    it('preserves /inventory as the tab root and registers every approved shell', () => {
        const expected = [
            '_layout.tsx',
            'index.tsx',
            'reviews.tsx',
            path.join('scan', '_layout.tsx'),
            path.join('scan', 'index.tsx'),
            path.join('scan', 'preview.tsx'),
            path.join('scan', '[sessionId]', 'index.tsx'),
            path.join('scan', '[sessionId]', 'candidate', '[candidateId].tsx'),
            path.join('scan', '[sessionId]', 'missed.tsx'),
            path.join('scan', '[sessionId]', 'summary.tsx'),
        ];
        for (const file of expected) {
            expect(fs.existsSync(path.join(routeRoot, file))).toBe(true);
        }
        expect(fs.existsSync(path.join(process.cwd(), 'app', '(store-owner)', 'inventory.tsx')))
            .toBe(false);
    });

    it('keeps nested inventory screens out of the Store Owner tab bar', () => {
        const tabs = fs.readFileSync(
            path.join(process.cwd(), 'app', '(store-owner)', '_layout.tsx'),
            'utf8',
        );
        expect(tabs).toContain('name="inventory"');
        expect(tabs).not.toMatch(/name="inventory\/scan/u);
        expect(tabs).not.toMatch(/name="inventory\/reviews/u);
    });
});
