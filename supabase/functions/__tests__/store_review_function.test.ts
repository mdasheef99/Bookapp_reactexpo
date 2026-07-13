import fs from 'fs';
import path from 'path';

const functionPath = path.join(process.cwd(), 'supabase', 'functions', 'store-review', 'index.ts');
const authHelperPath = path.join(process.cwd(), 'supabase', 'functions', '_shared', 'marketplaceAuth.ts');

describe('store-review Edge Function security contract', () => {
    it('does not trust actor user id from request body', () => {
        const source = fs.readFileSync(functionPath, 'utf8');
        const authSource = fs.readFileSync(authHelperPath, 'utf8');

        expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY');
        expect(source).toContain('requireAuthenticatedUser');
        expect(source).toContain('requirePlatformRole');
        expect(source).toContain("['platform_admin', 'store_reviewer']");
        expect(source).toContain("type StoreReviewDecision = 'approve' | 'reject' | 'request_more_info' | 'suspend' | 'restrict'");
        expect(source).toContain('StoreReviewActionInput');
        expect(source).toContain('platform_admin_actions');
        expect(source).toContain('marketplace_events');
        expect(source).toContain('marketplace_audit_logs');
        expect(source).toContain('store_status_history');
        expect(authSource).toContain('platform_user_roles');
        expect(authSource).toContain("eq('user_id', userId)");
        expect(authSource).toContain("eq('status', 'active')");
        expect(authSource).toContain('Forbidden: platform role required');

        expect(source).not.toContain('body.actor');
        expect(source).not.toContain('actorUserId');
        expect(source).not.toContain('actor_user_id: action');
        expect(source).not.toContain('user_profiles');
    });

    it('denies review when caller has no platform role', () => {
        const source = fs.readFileSync(functionPath, 'utf8');
        const authSource = fs.readFileSync(authHelperPath, 'utf8');

        expect(source).toContain('requirePlatformRole(serviceClient, actor.id, REVIEW_ROLES)');
        expect(authSource).toContain('platform_user_roles');
        expect(authSource).toContain("in('role', roles)");
        expect(authSource).toContain('Forbidden: platform role required');
    });

    it('denies Store A owner reviewing Store B', () => {
        const source = fs.readFileSync(functionPath, 'utf8');

        expect(source).toContain('requirePlatformRole');
        expect(source).not.toContain('requireStoreAdmin');
        expect(source).not.toContain('store_administrators');
    });

    it('approval keeps selling_status not_allowed until setup is complete', () => {
        const source = fs.readFileSync(functionPath, 'utf8');

        expect(source).toContain("status: 'approved_pending_setup'");
        expect(source).toContain("verification_status: 'approved'");
        expect(source).toContain("setup_status: 'incomplete'");
        expect(source).toContain("selling_status: 'not_allowed'");
        expect(source).toContain('createFoundingTrialEntitlements');
    });

    it('requires reason for rejection and suspension', () => {
        const source = fs.readFileSync(functionPath, 'utf8');

        expect(source).toContain("requireReason(action, ['reject', 'suspend', 'restrict'])");
        expect(source).toContain("decision === 'reject'");
        expect(source).toContain("decision === 'suspend'");
        expect(source).toContain("decision === 'restrict'");
    });
});
