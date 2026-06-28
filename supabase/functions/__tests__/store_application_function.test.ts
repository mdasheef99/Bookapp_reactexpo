import fs from 'fs';
import path from 'path';

const functionPath = path.join(process.cwd(), 'supabase', 'functions', 'store-application', 'index.ts');
const authHelperPath = path.join(process.cwd(), 'supabase', 'functions', '_shared', 'marketplaceAuth.ts');

describe('store-application Edge Function security contract', () => {
    it('uses service-role writes behind authenticated user and store-admin checks', () => {
        const source = fs.readFileSync(functionPath, 'utf8');
        const authSource = fs.readFileSync(authHelperPath, 'utf8');

        expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY');
        expect(source).toContain('requireAuthenticatedUser');
        expect(source).toContain('requireStoreAdmin');
        expect(source).toContain("eq('user_id', actorId)");
        expect(source).toContain("type: 'start_or_resume'");
        expect(source).toContain("type: 'save_draft'");
        expect(source).toContain("type: 'submit'");
        expect(source).toContain("type: 'record_document'");
        expect(source).toContain('PRIVILEGED_STORE_FIELDS');
        expect(source).toContain('storagePath.startsWith(`${storeId}/`)');
        expect(source).toContain('marketplace_audit_logs');
        expect(source).toContain('marketplace_events');
        expect(source).toContain('application_metadata');
        expect(source).toContain('validateLocality');
        expect(source).toContain("eq('is_pilot_enabled', true)");
        expect(source).toContain('sanitizeSupabaseError');
        expect(source).not.toContain('throw new Response(error.message');
        expect(source).not.toContain('throw new Response(storeError.message');
        expect(source).not.toContain('throw new Response(requestError.message');
        expect(source).not.toContain('body.user_id');
        expect(source).not.toContain('action.user_id');
        expect(source).not.toContain('payload.user_id');

        expect(authSource).toContain('Authorization');
        expect(authSource).toContain('auth.getUser()');
        expect(authSource).toContain('store_administrators');
        expect(authSource).toContain("eq('user_id', userId)");
        expect(authSource).toContain("eq('store_id', storeId)");
        expect(authSource).toContain('Forbidden: store admin access required');
        expect(authSource).toContain('sanitizeSupabaseError');
        expect(authSource).not.toContain('throw new Response(error.message');
    });
});
