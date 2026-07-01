import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260701000001_marketplace_phase5_consumer_discovery_schema.sql',
);

describe('marketplace Phase 5 consumer discovery schema migration', () => {
    const readSql = () => fs.readFileSync(migrationPath, 'utf8');

    it('adds indexed author search text to the public listing projection', () => {
        const sql = readSql();

        expect(sql).toContain('CREATE OR REPLACE FUNCTION public.marketplace_authors_text');
        expect(sql).toContain('IMMUTABLE');
        expect(sql).toContain('ALTER TABLE public.marketplace_book_listings');
        expect(sql).toContain('authors_text TEXT GENERATED ALWAYS AS');
        expect(sql).toContain('CREATE INDEX idx_marketplace_listings_authors_text_trgm');
        expect(sql).toContain('USING gin (authors_text gin_trgm_ops)');
    });

    it('adds return policy to the public store profile projection and sync trigger', () => {
        const sql = readSql();

        expect(sql).toContain('ALTER TABLE public.public_store_profiles');
        expect(sql).toContain('return_policy_type TEXT NOT NULL DEFAULT');
        expect(sql).toContain('marketplace_sec.sync_public_store_profile');
        expect(sql).toContain('NEW.return_policy_type');
        expect(sql).toContain('return_policy_type = EXCLUDED.return_policy_type');
    });

    it('creates private demand capture tables and an RPC for unavailable searches', () => {
        const sql = readSql();

        expect(sql).toContain('CREATE TABLE public.marketplace_search_events');
        expect(sql).toContain('CREATE TABLE public.book_demand_signals');
        expect(sql).toContain('ALTER TABLE public.marketplace_search_events ENABLE ROW LEVEL SECURITY');
        expect(sql).toContain('ALTER TABLE public.book_demand_signals ENABLE ROW LEVEL SECURITY');
        expect(sql).toContain('CREATE OR REPLACE FUNCTION public.record_marketplace_unavailable_search');
        expect(sql).toContain('SECURITY DEFINER');
        expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.record_marketplace_unavailable_search(TEXT, INTEGER, JSONB, TEXT) TO anon, authenticated');
    });

    it('keeps passive demand private from clients and stores', () => {
        const sql = readSql();

        expect(sql).toContain('REVOKE ALL ON public.marketplace_search_events FROM anon, authenticated');
        expect(sql).toContain('REVOKE ALL ON public.book_demand_signals FROM anon, authenticated');
        expect(sql).not.toContain('CREATE POLICY "book demand select');
        expect(sql).not.toContain('CREATE POLICY "marketplace search events select');
    });
});
