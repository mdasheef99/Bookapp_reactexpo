import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260715000002_marketplace_phase5_discovery_hardening.sql',
);

describe('marketplace Phase 5 discovery hardening migration', () => {
    const readSql = () => fs.readFileSync(migrationPath, 'utf8');

    it('keeps anonymous listing reads free of private authorization helpers', () => {
        const sql = readSql();
        const anonPolicy = sql.slice(
            sql.indexOf('CREATE POLICY "marketplace listings anonymous public select"'),
            sql.indexOf('CREATE POLICY "marketplace listings authenticated select"'),
        );

        expect(anonPolicy).toContain('FOR SELECT TO anon');
        expect(anonPolicy).toContain('is_pilot_enabled = true');
        expect(anonPolicy).not.toContain('marketplace_sec.');
    });

    it('gates public store profiles and listings to enabled pilot localities', () => {
        const sql = readSql();

        expect(sql).toContain('CREATE POLICY "public profiles readable"');
        expect(sql.match(/is_pilot_enabled = true/g)?.length).toBeGreaterThanOrEqual(3);
    });

    it('replaces caller-controlled demand fields with a bounded unavailable-query RPC', () => {
        const sql = readSql();

        expect(sql).toContain('DROP FUNCTION IF EXISTS public.record_marketplace_unavailable_search(TEXT, INTEGER, JSONB, TEXT)');
        expect(sql).toContain('record_marketplace_unavailable_search(p_query TEXT)');
        expect(sql).toContain('RETURNS BOOLEAN');
        expect(sql).toContain('char_length(v_query) > 200');
        expect(sql).toContain("'consumer_marketplace'");
        expect(sql).not.toContain('p_location_context');
        expect(sql).not.toContain('p_source');
        expect(sql).not.toContain('p_result_count');
    });

    it('rate-limits repeated anonymous demand writes', () => {
        const sql = readSql();

        expect(sql).toContain('marketplace_demand_rate_limits');
        expect(sql).toContain('date_trunc');
        expect(sql).toContain('RAISE EXCEPTION');
    });

    it('bounds raw search and demand retention without client table grants', () => {
        const sql = readSql();

        expect(sql).toContain("DEFAULT (now() + INTERVAL '90 days')");
        expect(sql).toContain('DELETE FROM public.marketplace_search_events WHERE expires_at <= now()');
        expect(sql).toContain('DELETE FROM public.book_demand_signals WHERE expires_at <= now()');
        expect(sql).toContain('REVOKE ALL ON public.marketplace_demand_rate_limits FROM PUBLIC, anon, authenticated');
    });
});
