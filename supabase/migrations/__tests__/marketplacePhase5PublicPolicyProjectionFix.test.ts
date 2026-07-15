import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260715000003_marketplace_phase5_public_policy_projection_fix.sql',
);

describe('marketplace Phase 5 public policy projection fix', () => {
    const readSql = () => fs.readFileSync(migrationPath, 'utf8');

    it('evaluates public profile eligibility without reading the private stores table', () => {
        const sql = readSql();
        const profilePolicy = sql.slice(
            sql.indexOf('CREATE POLICY "public profiles readable"'),
            sql.indexOf('CREATE POLICY "marketplace listings anonymous public select"'),
        );

        expect(profilePolicy).toContain('FOR SELECT TO anon, authenticated');
        expect(profilePolicy).toContain('public.marketplace_localities');
        expect(profilePolicy).toContain('is_pilot_enabled = true');
        expect(profilePolicy).not.toContain('public.stores');
    });

    it('uses the public store projection for anonymous listing eligibility', () => {
        const sql = readSql();
        const anonPolicy = sql.slice(
            sql.indexOf('CREATE POLICY "marketplace listings anonymous public select"'),
            sql.indexOf('CREATE POLICY "marketplace listings authenticated select"'),
        );

        expect(anonPolicy).toContain('FOR SELECT TO anon');
        expect(anonPolicy).toContain('public.public_store_profiles');
        expect(anonPolicy).not.toContain('public.stores');
        expect(anonPolicy).not.toContain('marketplace_sec.');
    });

    it('preserves authenticated owner and platform access outside the public branch', () => {
        const sql = readSql();
        const authenticatedPolicy = sql.slice(
            sql.indexOf('CREATE POLICY "marketplace listings authenticated select"'),
            sql.indexOf('COMMIT;'),
        );

        expect(authenticatedPolicy).toContain('marketplace_sec.is_store_admin(store_id)');
        expect(authenticatedPolicy).toContain('marketplace_sec.is_platform_operator()');
    });
});
