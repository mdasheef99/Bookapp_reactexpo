import fs from 'node:fs';
import path from 'node:path';

describe('Phase 9 Unit 6F privacy, media-purpose, and Unit 7 boundary', () => {
    const root = path.join(__dirname, '..');
    const productionSources = fs.readdirSync(root, { recursive: true })
        .filter((name) => /\.(ts|tsx)$/u.test(String(name)) && !String(name).includes('__tests__'))
        .map((name) => ({
            name: String(name).replaceAll('\\', '/'),
            source: fs.readFileSync(path.join(root, String(name)), 'utf8'),
        }));
    const production = productionSources.map(({ source }) => source).join('\n');
    const authorizedUnit6gDCommitSurfaces = new Set([
        'commit/inventoryCommitCoordinator.ts',
        'commit/inventoryCommitTypes.ts',
        'commit/useInventoryCommitCoordinator.ts',
        'components/AddCandidateToInventoryAction.tsx',
        'components/BatchInventoryCommitControls.tsx',
        'components/BatchReviewCard.tsx',
        'screens/CaptureProgressScreens.tsx',
    ]);
    const productionOutsideUnit6gDCommit = productionSources
        .filter(({ name }) => !authorizedUnit6gDCommitSurfaces.has(name))
        .map(({ source }) => source)
        .join('\n');

    it('has no direct table, Unit 7 adapter, inventory/publication, or commerce mutation', () => {
        expect(production).not.toMatch(/supabase\s*\.\s*from\s*\(/u);
        expect(productionOutsideUnit6gDCommit).not.toMatch(
            /(?:commit|publish)(?:Candidate|Inventory)|inventoryCommit|commerceMutation/u,
        );
        expect(production).not.toMatch(/from\s+['"][^'"]*(?:unit7|commitAdapter|publicationAdapter)/iu);
    });

    it('does not persist private drafts or repurpose scan media', () => {
        expect(production).not.toMatch(/AsyncStorage|MMKV|persistQueryClient|mutationQueue/u);
        expect(production).not.toMatch(/scanMedia(?:As|To)(?:Cover|Public|Duplicate|Customer)/u);
        expect(production).not.toMatch(/console\.(?:log|warn|error)\s*\(/u);
    });

    it('routes Close only through the existing Owner Edge action', () => {
        const service = fs.readFileSync(path.join(root, 'api/ownerUxService.ts'), 'utf8');
        expect(service).toContain("invoke('close_scan_session', request, signal)");
        expect(service).toContain("supabase.functions.invoke('phase9-owner-ingestion'");
    });
});
