import fs from 'node:fs';
import path from 'node:path';

const productionFiles = [
    'api/ownerCorrectionService.ts',
    'components/CandidateCorrectionActions.tsx',
    'components/VariantDecisionSheet.tsx',
    'contracts/ownerCorrectionSchemas.ts',
    'queries/ownerCorrectionQueries.ts',
    'review/missedBookForm.ts',
    'review/ownerCorrectionWorkflow.ts',
    'screens/MissedBookScreen.tsx',
].map((relative) => path.join(__dirname, '..', relative));

describe('Phase 9 Unit 6E privacy and architecture boundary', () => {
    const sources = productionFiles.map((file) => fs.readFileSync(file, 'utf8'));
    const combined = sources.join('\n');

    it('uses only the five authorized named RPCs and no direct table access', () => {
        const service = sources[0];
        for (const rpc of [
            'phase9_add_manual_candidate',
            'phase9_skip_candidate',
            'phase9_owner_search_variant_review',
            'phase9_owner_decide_search_variant',
            'phase9_owner_replace_search_variant',
        ]) expect(service).toContain(rpc);
        expect(combined).not.toContain('supabase.from(');
        expect(combined).not.toContain('.from(');
    });

    it('contains no persistence, publication, commerce, provider-call, or Unit 6F/7 operation', () => {
        for (const forbidden of [
            'AsyncStorage', 'MMKV', 'phase9_commit_candidate', 'store_inventory',
            'marketplace_book_listings', 'publishCandidate', 'commerceService',
            'phase9_close_session', 'service_role',
        ]) expect(combined).not.toContain(forbidden);
    });

    it('does not render or log provider/model provenance or raw transport failures', () => {
        const presentation = [sources[1], sources[2], sources[7]].join('\n');
        for (const forbidden of [
            'providerKey', 'modelKey', 'modelVersion', 'promptVersion',
            'console.log', 'console.error', 'signedUrl', 'capability', 'confidence', 'geometry', 'cost',
        ]) expect(presentation).not.toContain(forbidden);
    });
});
