import fs from 'fs';
import path from 'path';

const routeRoot = path.join(process.cwd(), 'app', '(store-owner)', 'inventory');

describe('Phase 9 Unit 6B nested inventory route registration', () => {
    it('preserves /inventory as the tab root and registers every approved shell', () => {
        const expected = [
            '_layout.tsx',
            'index.tsx',
            path.join('scan', '_layout.tsx'),
            path.join('scan', 'index.tsx'),
            path.join('scan', 'preview.tsx'),
            path.join('scan', '[sessionId]', 'index.tsx'),
            path.join('scan', '[sessionId]', 'missed.tsx'),
            path.join('scan', '[sessionId]', 'summary.tsx'),
        ];
        for (const file of expected) {
            expect(fs.existsSync(path.join(routeRoot, file))).toBe(true);
        }
        expect(fs.existsSync(path.join(process.cwd(), 'app', '(store-owner)', 'inventory.tsx')))
            .toBe(false);
    });

    // Post-scan SDD-1 §6 (4a), AC4-1; D2-5 removes routes and registrations together.
    it.each(['reviews.tsx', 'scan/[sessionId]/candidate/[candidateId].tsx'])(
        'registers no candidate or reviews route: %s is absent', (file) => {
            expect(fs.existsSync(path.join(routeRoot, file))).toBe(false);
        },
    );
    it.each([
        ['_layout.tsx', 'reviews'],
        ['scan/[sessionId]/_layout.tsx', 'candidate/[candidateId]'],
    ])('registers no candidate or reviews route in %s', (layout, name) => {
        const source = fs.readFileSync(path.join(routeRoot, layout), 'utf8');
        const registeredNames = [...source.matchAll(/<Stack\.Screen\s+name=["']([^"']+)["']/gu)]
            .map((match) => match[1]);
        expect(registeredNames).not.toContain(name);
    });

    it('titles the missed-book route Add a book', () => {
        const layout = fs.readFileSync(path.join(routeRoot, 'scan/[sessionId]/_layout.tsx'), 'utf8');
        expect(layout).toMatch(/name="missed"\s+options=\{\{\s*title:\s*'Add a book'/u);
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
