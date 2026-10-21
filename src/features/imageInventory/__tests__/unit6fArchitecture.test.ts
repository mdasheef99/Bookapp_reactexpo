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

    // Post-scan SDD-1 §6 (4a), AC4-1: test sources name the old paths deliberately.
    it.each([
        '/candidate/', 'inventory/reviews', 'inventoryRoutes.candidate', 'inventoryRoutes.reviews',
        'VariantDecisionSheet', 'CandidateReviewScreens', 'CandidateCorrectionActions',
        'CandidateReviewEditionSheet', 'onEditIdentity', 'onEditManually',
    ])(
        'no source references removed routes or names: %s', (reference) => {
            const matches = ['src', 'app'].flatMap((directory) => {
                const directoryRoot = path.join(process.cwd(), directory);
                return fs.readdirSync(directoryRoot, { recursive: true })
                    .map(String)
                    .filter((name) => /\.[cm]?[jt]sx?$/u.test(name) && !/[\\/]__tests__[\\/]/u.test(name))
                    .filter((name) => fs.readFileSync(path.join(directoryRoot, name), 'utf8').includes(reference))
                    .map((name) => `${directory}/${name.replaceAll('\\', '/')}`);
            });
            expect(matches).toEqual([]);
        },
    );
    const authorizedUnit6gDCommitSurfaces = new Set([
        'commit/inventoryCommitCoordinator.ts',
        'commit/inventoryCommitBatchExecution.ts',
        'commit/inventoryCommitPolicy.ts',
        'commit/inventoryCommitTypes.ts',
        'commit/useInventoryCommitCoordinator.ts',
        'components/AddCandidateToInventoryAction.tsx',
        'components/BatchInventoryCommitControls.tsx',
        'components/BatchReviewCard.tsx',
        // Unit 6G SDD sections 8/12/14: status and controlled Add/cache surfaces.
        'components/batchReviewStatus.ts',
        // Unit 6G §§8/11–14: extracted Add composition and the shared Remove slot.
        'components/PostScanInventoryActions.tsx',
        'review/scanCandidateRemoval.ts',
        'queries/ownerInventoryCommitQueries.ts',
        'queries/ownerUxReviewQueries.ts',
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
        expect(service).toContain("from './ownerUxTransport'");
        const transport = fs.readFileSync(path.join(root, 'api/ownerUxTransport.ts'), 'utf8');
        expect(transport).toContain("supabase.functions.invoke('phase9-owner-ingestion'");
    });
});
