import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260627000001_marketplace_phase2_onboarding_hardening.sql',
);

describe('marketplace Phase 2 onboarding hardening migration', () => {
    it('removes broad owner updates from privileged onboarding tables', () => {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        expect(sql).toContain('DROP POLICY IF EXISTS "stores update" ON public.stores');
        expect(sql).toContain('DROP POLICY IF EXISTS "verif_req update" ON public.store_verification_requests');
        expect(sql).toContain('DROP POLICY IF EXISTS "verif_doc update" ON public.store_verification_documents');
        expect(sql).toContain('CREATE POLICY "stores platform update" ON public.stores');
        expect(sql).toContain("marketplace_sec.has_platform_role(ARRAY['platform_admin'])");
        expect(sql).toContain('CREATE POLICY "verif_req platform update" ON public.store_verification_requests');
        expect(sql).toContain("marketplace_sec.has_platform_role(ARRAY['platform_admin','store_reviewer'])");
        expect(sql).toContain('CREATE POLICY "verif_doc platform update" ON public.store_verification_documents');
    });
});
