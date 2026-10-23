import fs from 'node:fs';
import path from 'node:path';

// Post-scan SDD-1 §§2/6 (4a/4b), D2-5.
const productionFiles = [
    'api/ownerCorrectionService.ts', 'contracts/ownerCorrectionSchemas.ts',
    'identity/ownerRequestFence.ts', 'queries/ownerCorrectionQueries.ts',
    'review/missedBookForm.ts', 'screens/MissedBookScreen.tsx',
    'review/compactReviewDraft.ts', 'components/BatchReviewCard.tsx',
    'queries/ownerMissedBookIsbnFlow.ts',
];
const sources = Object.fromEntries(productionFiles.map(relative => [relative,
    fs.readFileSync(path.join(__dirname, '..', relative), 'utf8'),
]));
const combined = Object.values(sources).join('\n');
describe('Phase 9 correction privacy and architecture boundary', () => {
    it('keeps only the manual Add correction RPC', () => {
        const service = sources['api/ownerCorrectionService.ts'];
        for (const rpc of ['phase9_add_manual_candidate']) {
            expect(service).toContain(rpc);
        }
        expect(combined).not.toContain('.from(');
    });
    it.each(['phase9_skip_candidate', 'phase9_owner_replace_search_variant'])(
        'has no removed correction client RPC: %s', rpc => {
            expect(sources['api/ownerCorrectionService.ts']).not.toContain(rpc);
        },
    );
    it('keeps only the manual Add mutation without an offline queue', () => {
        expect(sources['queries/ownerCorrectionQueries.ts'].match(/networkMode: 'always'/gu)).toHaveLength(1);
        expect(sources['api/ownerCorrectionService.ts']).toContain('captureOwnerRequest(identity)');
        expect(sources['api/ownerCorrectionService.ts']).toContain('.abortSignal(fence.signal)');
        expect(sources['identity/ownerRequestFence.ts']).toContain('controller.abort()');
    });
    it('contains no persistence, publication, commerce or provider operation', () => {
        for (const forbidden of ['Alert.alert', 'AsyncStorage', 'MMKV', 'phase9_commit_candidate', 'store_inventory',
            'marketplace_book_listings', 'publishCandidate', 'commerceService', 'phase9_close_session', 'service_role']) {
            expect(combined).not.toContain(forbidden);
        }
    });
    it('does not render or log provider/model provenance or raw transport failures', () => {
        const presentation = sources['screens/MissedBookScreen.tsx'];
        for (const forbidden of ['providerKey', 'modelKey', 'modelVersion', 'promptVersion',
            'console.log', 'console.error', 'signedUrl', 'capability', 'confidence', 'geometry', 'cost']) {
            expect(presentation).not.toContain(forbidden);
        }
    });
});

// AC4-11 scans all non-test src files, including code outside this feature.
it('no variant decision client remains', () => {
    const src = path.resolve(__dirname, '../../..');
    const forbidden = /\b(?:resolveExpectedVariants|decideVariant|decideVariantRequestSchema|decideVariantResponseSchema|variantReviewRowSchema|OwnerVariantReview|toOwnerVariantReview|ExpectedVariant|DecideVariantRequest|MAX_VARIANT_PAGES|VARIANT_PAGE_SIZE|variantErrorCodeSchema|VariantErrorCode|VariantOperation|phase9_owner_search_variant_review|phase9_owner_decide_search_variant)\b/u;
    const violations: string[] = [];
    function scan(directory: string) {
        for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, item.name);
            if (item.isDirectory()) {
                if (!['__tests__', '__mocks__'].includes(item.name)) scan(file);
            } else if (!/\.(test|spec)\./u.test(item.name) && forbidden.test(fs.readFileSync(file, 'utf8'))) violations.push(path.relative(src, file));
        }
    }
    scan(src);
    expect(violations).toEqual([]);
    const migrations = path.resolve(src, '../supabase/migrations');
    const sql = fs.readdirSync(migrations).filter(name => name.endsWith('.sql'))
        .map(name => fs.readFileSync(path.join(migrations, name), 'utf8')).join('\n');
    expect(sql).toMatch(/CREATE (?:OR REPLACE )?FUNCTION public\.phase9_owner_search_variant_review\(/u);
    expect(sql).toMatch(/CREATE (?:OR REPLACE )?FUNCTION public\.phase9_owner_decide_search_variant\(/u);
});

// SDD-1 §6 (4a), AC4-1: the kept shared picker has no full-review-only callbacks.
it.each([
    ['components/CandidateEditionPicker.tsx', 'onEditIdentity'],
    ['components/CandidateMetadataSheet.tsx', 'onEditManually'],
])('removes the full-review-only prop from %s', (file, prop) => {
    expect(fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).not.toContain(prop);
});
