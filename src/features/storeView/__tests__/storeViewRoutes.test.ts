import fs from 'fs';
import path from 'path';

describe('Unit 7C WU2 Store View route registration', () => {
    it('registers list/detail routes without adding a sixth primary tab', () => {
        const root = path.join(process.cwd(), 'app', '(store-owner)', 'store-view');
        expect(fs.existsSync(path.join(root, '_layout.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(root, 'index.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(root, '[inventoryId].tsx'))).toBe(true);
        const tabs = fs.readFileSync(path.join(process.cwd(), 'app', '(store-owner)', '_layout.tsx'), 'utf8');
        expect(tabs).toMatch(/name="store-view"[\s\S]*href:\s*null/u);
        expect(tabs).toContain('name="storefront"');
    });
});
