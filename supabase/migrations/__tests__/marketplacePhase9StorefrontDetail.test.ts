import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260820000050_marketplace_phase9_storefront_detail.sql',
);

describe('Phase 9 Unit 8C storefront and detail migration', () => {
    it('defines forward Q09 and Q10 allowlisted customer functions', () => {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        expect(sql).toContain('public.phase9_storefront_catalogue_v1');
        expect(sql).toContain('public.phase9_public_listing_detail_v3');
        expect(sql).toContain('marketplace_sec.phase9_q09_issue_match_context');
        expect(sql).toContain('marketplace_sec.phase9_q10_public_gallery');
        expect(sql).toContain("SET search_path=''");
    });

    it('keeps internal helpers denied and grants only the named public DTOs', () => {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        expect(sql).toMatch(/REVOKE ALL ON FUNCTION[\s\S]+phase9_q09_issue_match_context\(uuid,text\)[\s\S]+FROM PUBLIC,anon,authenticated,service_role/);
        expect(sql).toMatch(
            /GRANT EXECUTE ON FUNCTION public\.phase9_storefront_catalogue_v1[\s\S]+TO anon,authenticated,service_role/,
        );
        expect(sql).toMatch(
            /GRANT EXECUTE ON FUNCTION public\.phase9_public_listing_detail_v3[\s\S]+TO anon,authenticated,service_role/,
        );
        expect(sql).toContain(
            'REVOKE ALL ON public.store_inventory,public.marketplace_book_listings FROM anon,authenticated',
        );
    });

    it('uses encrypted context/cursors and positive DTO field construction', () => {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        expect(sql).toContain("'{matchedBook,matchContext}'");
        expect(sql).toContain("'highlightedTitleGroup'");
        expect(sql).toContain("'titleCount'");
        expect(sql).toContain("'gallery'");
        expect(sql).toContain('marketplace_sec.phase9_q08_cursor_encrypt');
        expect(sql).toContain('marketplace_sec.phase9_q08_cursor_decrypt');
        expect(sql).toContain("'contextVersion','q09-match-v2'");
        expect(sql).toContain("'issuingContractVersion','phase9-q08-v1'");
        expect(sql).not.toContain("'inventoryId'");
        expect(sql).not.toContain("'inventory_id'");
    });

    it('bounds Q10 to approved public media in deterministic public order', () => {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        expect(sql).toMatch(
            /phase9_public_media_eligible\(l,a\)[\s\S]+ORDER BY l\.public_order,l\.id[\s\S]+LIMIT 3/,
        );
        expect(sql).not.toContain('coalesce(l.public_order,3)');
    });
});
