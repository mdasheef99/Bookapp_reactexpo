import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const routeEntry = path.join(projectRoot, 'app', '(store-owner)', 'inventory', 'index.tsx');
const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx'];

function resolveSourceFile(candidate: string): string | null {
    const candidates = [
        candidate,
        ...sourceExtensions.map((extension) => `${candidate}${extension}`),
        ...sourceExtensions.map((extension) => path.join(candidate, `index${extension}`)),
    ];
    return candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) ?? null;
}

function resolveImport(fromFile: string, specifier: string): string | null {
    if (specifier.startsWith('@/')) {
        return resolveSourceFile(path.join(projectRoot, 'src', specifier.slice(2)));
    }
    if (specifier.startsWith('.')) {
        return resolveSourceFile(path.resolve(path.dirname(fromFile), specifier));
    }
    return null;
}

function collectRouteGraph(entry: string): Map<string, string> {
    const graph = new Map<string, string>();
    const pending = [entry];
    const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/gu;

    while (pending.length > 0) {
        const file = pending.pop() as string;
        if (graph.has(file)) continue;
        const source = fs.readFileSync(file, 'utf8');
        graph.set(file, source);
        for (const match of source.matchAll(importPattern)) {
            const dependency = resolveImport(file, match[1]);
            if (dependency && !graph.has(dependency)) pending.push(dependency);
        }
    }
    return graph;
}

describe('/inventory read-only architecture boundary', () => {
    it('reaches the WU1 RPC service but no direct store_inventory table or legacy write orchestration', () => {
        const graph = collectRouteGraph(routeEntry);
        const files = [...graph.keys()].map((file) => path.relative(projectRoot, file).replace(/\\/gu, '/'));

        expect(files).toContain('src/features/imageInventory/api/ownerInventoryReadService.ts');
        expect(files).toContain('src/features/imageInventory/queries/ownerInventoryReadQueries.ts');
        expect(files).not.toContain('src/features/stores/services/storeInventoryService.ts');
        expect(files).not.toContain('src/features/stores/hooks/useStoreInventory.ts');

        for (const [file, source] of graph) {
            expect({ file, source }).not.toEqual(expect.objectContaining({
                source: expect.stringMatching(/\.from\(\s*['"]store_inventory['"]\s*\)/u),
            }));
            expect({ file, source }).not.toEqual(expect.objectContaining({
                source: expect.stringMatching(/storeInventoryService|useStoreInventory/u),
            }));
        }
    });
});
