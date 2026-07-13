import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260713000001_marketplace_phase3_public_listing_policy_split.sql',
);

describe('marketplace Phase 3 public listing policy split', () => {
    const readSql = () => fs.readFileSync(migrationPath, 'utf8');

    it('gives anon a public-only policy without private authorization helpers', () => {
        const sql = readSql();
        const anonPolicy = sql.slice(
            sql.indexOf('CREATE POLICY "marketplace listings anonymous public select"'),
            sql.indexOf('CREATE POLICY "marketplace listings authenticated select"'),
        );

        expect(anonPolicy).toContain('FOR SELECT TO anon');
        expect(anonPolicy).toContain("status = 'active'");
        expect(anonPolicy).toContain("s.verification_status = 'approved'");
        expect(anonPolicy).not.toContain('marketplace_sec.');
    });

    it('preserves authenticated public, owner, and operator access', () => {
        const sql = readSql();
        const authenticatedPolicy = sql.slice(
            sql.indexOf('CREATE POLICY "marketplace listings authenticated select"'),
        );

        expect(authenticatedPolicy).toContain('FOR SELECT TO authenticated');
        expect(authenticatedPolicy).toContain("status = 'active'");
        expect(authenticatedPolicy).toContain('marketplace_sec.is_store_admin(store_id)');
        expect(authenticatedPolicy).toContain('marketplace_sec.is_platform_operator()');
    });

    it('does not grant anon access to the private helper schema or functions', () => {
        const sql = readSql();

        expect(sql).not.toMatch(/GRANT\s+USAGE\s+ON\s+SCHEMA\s+marketplace_sec\s+TO\s+anon/i);
        expect(sql).not.toMatch(/GRANT\s+EXECUTE[\s\S]*?TO\s+anon/i);
    });
});
