import fs from 'fs';
import path from 'path';

const functionPath = path.join(process.cwd(), 'supabase', 'functions', 'store-profile', 'index.ts');

describe('store-profile Edge Function security contract', () => {
    it('uses authenticated ownership checks, allowlisted fields, and audit records', () => {
        const source = fs.readFileSync(functionPath, 'utf8');

        expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY');
        expect(source).toContain('requireAuthenticatedUser');
        expect(source).toContain('requireStoreAdmin');
        expect(source).toContain('PROFILE_FIELDS');
        expect(source).toContain("type: 'update_profile'");
        expect(source).toContain("type: 'complete_setup'");
        expect(source).toContain("status: 'active'");
        expect(source).toContain("setup_status: 'complete'");
        expect(source).toContain("selling_status: 'allowed'");
        expect(source).toContain('store_status_history');
        expect(source).toContain('marketplace_events');
        expect(source).toContain('marketplace_audit_logs');
        expect(source).toContain(".in('status', ['approved_pending_setup', 'active'])");
        expect(source).toContain(".eq('status', 'approved_pending_setup').select('id').maybeSingle()");
        expect(source).toContain('Store profile state changed; refresh and retry');
        expect(source).toContain('Store setup state changed; refresh and retry');
        expect(source).not.toContain('body.user_id');
        expect(source).not.toContain('payload.status');
        expect(source).not.toContain('payload.selling_status');
    });
});
