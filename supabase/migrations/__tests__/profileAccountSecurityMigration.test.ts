import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260524043322_harden_profile_account_security.sql',
);

describe('profile account security migration', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    it('creates an explicit public profile summary surface', () => {
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.profile_public_summaries');
        expect(sql).toContain('CREATE TRIGGER trigger_sync_profile_public_summary');
        expect(sql).toContain('GRANT SELECT ON TABLE public.profile_public_summaries TO anon, authenticated');
    });

    it('removes public profile-table reads and sensitive client updates', () => {
        expect(sql).toContain('DROP POLICY IF EXISTS "Public profiles are viewable by everyone"');
        expect(sql).toContain('CREATE POLICY "Users can view their own profile"');
        expect(sql).toContain('GRANT UPDATE (display_name, username, avatar_url, city, updated_at)');
        expect(sql).not.toContain('GRANT UPDATE (membership_tier');
    });

    it('moves setup and trust-score maintenance behind RPC/trigger boundaries', () => {
        expect(sql).toContain('CREATE OR REPLACE FUNCTION public.complete_profile_setup');
        expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.update_trust_score() FROM anon');
        expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.sync_profile_public_summary() FROM authenticated');
    });
});
