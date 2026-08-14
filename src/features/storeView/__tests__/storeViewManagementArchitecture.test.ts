import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const entry = path.join(projectRoot, 'app', '(store-owner)', 'store-view', '[inventoryId].tsx');
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

function resolve(candidate: string): string | null {
    return [candidate, ...extensions.map((extension) => `${candidate}${extension}`)]
        .find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) ?? null;
}

function graph(): Map<string, string> {
    const result = new Map<string, string>();
    const pending = [entry];
    const imports = /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/gu;
    while (pending.length) {
        const file = pending.pop() as string;
        if (result.has(file)) continue;
        const source = fs.readFileSync(file, 'utf8');
        result.set(file, source);
        for (const match of source.matchAll(imports)) {
            const candidate = match[1].startsWith('@/')
                ? path.join(projectRoot, 'src', match[1].slice(2))
                : match[1].startsWith('.') ? path.resolve(path.dirname(file), match[1]) : null;
            const dependency = candidate ? resolve(candidate) : null;
            if (dependency) pending.push(dependency);
        }
    }
    return result;
}

describe('Unit 7C WU3 Store View management architecture', () => {
    it('reuses Unit 7B publication and controlled WU3 Edge services without direct table/listing management', () => {
        const sources = graph();
        const files = [...sources.keys()].map((file) => path.relative(projectRoot, file).replace(/\\/gu, '/'));
        expect(files).toContain('src/features/storeView/api/storeViewManagementService.ts');
        expect(files).toContain('src/features/imageInventory/queries/publicationQueries.ts');
        expect(files).toContain('src/features/imageInventory/api/publicationService.ts');
        expect(files).not.toContain('src/features/stores/services/storeInventoryService.ts');
        for (const source of sources.values()) {
            expect(source).not.toMatch(/\.from\(\s*['"](?:store_inventory|marketplace_book_listings)['"]\s*\)/u);
            expect(source).not.toContain('Publish Changes');
            expect(source).not.toContain('Updating live listing');
        }
    });
});
