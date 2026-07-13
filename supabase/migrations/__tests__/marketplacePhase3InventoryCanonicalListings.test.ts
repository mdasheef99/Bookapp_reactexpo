import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260628000003_marketplace_phase3_inventory_canonical_listings.sql',
);

describe('marketplace Phase 3 inventory canonical listings migration', () => {
    const readSql = () => fs.readFileSync(migrationPath, 'utf8');

    it('creates canonical metadata, private inventory, and public listing projection tables', () => {
        const sql = readSql();

        expect(sql).toContain('CREATE TABLE public.canonical_works');
        expect(sql).toContain('CREATE TABLE public.canonical_editions');
        expect(sql).toContain('CREATE TABLE public.book_metadata_sources');
        expect(sql).toContain('CREATE TABLE public.store_inventory');
        expect(sql).toContain('CREATE TABLE public.marketplace_book_listings');
        expect(sql).toContain('CREATE TABLE public.listing_moderation_flags');
    });

    it('keeps private inventory fields out of the public listing projection', () => {
        const sql = readSql();
        const listingTable = sql.slice(
            sql.indexOf('CREATE TABLE public.marketplace_book_listings'),
            sql.indexOf('CREATE TABLE public.listing_moderation_flags'),
        );

        expect(sql).toContain('acquisition_cost_minor INTEGER');
        expect(sql).toContain('shelf_location TEXT');
        expect(sql).toContain('internal_notes TEXT');
        expect(sql).toContain('metadata_confidence NUMERIC');
        expect(listingTable).not.toContain('acquisition_cost_minor');
        expect(listingTable).not.toContain('shelf_location');
        expect(listingTable).not.toContain('internal_notes');
        expect(listingTable).not.toContain('metadata_confidence');
    });

    it('enforces owner-only inventory access and public listing reads through RLS', () => {
        const sql = readSql();

        expect(sql).toContain('ALTER TABLE public.store_inventory ENABLE ROW LEVEL SECURITY');
        expect(sql).toContain('CREATE POLICY "inventory owner select" ON public.store_inventory');
        expect(sql).toContain('marketplace_sec.is_store_admin(store_id)');
        expect(sql).toContain('CREATE POLICY "marketplace listings public select" ON public.marketplace_book_listings');
        expect(sql).toContain("status = 'active'");
        expect(sql).toContain("moderation_status = 'approved'");
        expect(sql).toContain('EXISTS (');
        expect(sql).toContain('FROM public.stores s');
        expect(sql).toContain('s.id = marketplace_book_listings.store_id');
        expect(sql).toContain("s.status = 'active'");
        expect(sql).toContain("s.selling_status = 'allowed'");
    });

    it('adds duplicate detection indexes for isbn, provider id, and title-author matching', () => {
        const sql = readSql();

        expect(sql).toContain('idx_store_inventory_store_isbn13_condition');
        expect(sql).toContain('idx_metadata_sources_provider_book');
        expect(sql).toContain('idx_canonical_editions_title_authors');
    });

    it('only publishes listings for approved active stores with completed setup and allowed selling', () => {
        const sql = readSql();

        expect(sql).toContain('public.sync_marketplace_listing_from_inventory');
        expect(sql).toContain("s.status = 'active'");
        expect(sql).toContain("s.verification_status = 'approved'");
        expect(sql).toContain("s.setup_status = 'complete'");
        expect(sql).toContain("s.selling_status = 'allowed'");
    });

    it('retracts public listings when inventory or store gates are not publishable', () => {
        const sql = readSql();

        expect(sql).toContain("NEW.visibility_status = 'published'");
        expect(sql).toContain("NEW.listing_quality_status = 'ready'");
        expect(sql).toContain('DELETE FROM public.marketplace_book_listings WHERE inventory_id = NEW.id');
        expect(sql).toContain("moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('approved', 'pending', 'blocked', 'prohibited'))");
    });
});
