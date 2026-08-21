import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260821000051_marketplace_phase9_public_media_order_invariant.sql',
);

describe('Phase 9 final public media order invariant migration', () => {
    it('fails closed on existing null, out-of-range, duplicate, or over-cardinality public media', () => {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        expect(sql).toContain('M51_PUBLIC_MEDIA_ORDER_INVARIANT_EXISTING_ROWS');
        expect(sql).toContain('M51_PUBLIC_MEDIA_ORDER_DUPLICATE');
        expect(sql).toContain('M51_PUBLIC_MEDIA_CARDINALITY_EXCEEDED');
        expect(sql).toContain('marketplace_sec.phase9_public_media_eligible(l,a)');
    });

    it('guards both link changes and asset lifecycle eligibility transitions', () => {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        expect(sql).toContain('marketplace_sec.validate_inventory_media_link()');
        expect(sql).toContain('P9_PUBLIC_MEDIA_ORDER_REQUIRED');
        expect(sql).toContain('phase9_guard_media_asset_public_orders');
        expect(sql).toContain('BEFORE UPDATE OF');
    });
});
