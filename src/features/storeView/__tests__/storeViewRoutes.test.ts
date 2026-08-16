import fs from 'fs';
import path from 'path';

describe('Unit 7C WU5 Store View route registration', () => {
    it('registers Store View as the primary rich-management tab', () => {
        const root = path.join(process.cwd(), 'app', '(store-owner)', 'store-view');
        expect(fs.existsSync(path.join(root, '_layout.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(root, 'index.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(root, '[inventoryId].tsx'))).toBe(true);
        const tabs = fs.readFileSync(path.join(process.cwd(), 'app', '(store-owner)', '_layout.tsx'), 'utf8');
        const screenBlock = (name: string) => tabs.split('<Tabs.Screen')
            .find((block) => block.includes(`name="${name}"`)) ?? '';
        expect(screenBlock('store-view')).toContain("title: 'Store View'");
        expect(screenBlock('store-view')).not.toContain('href: null');
        expect(screenBlock('storefront')).toContain('href: null');
        expect(screenBlock('store-profile')).toContain('href: null');
    });
});
