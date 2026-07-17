import fs from 'fs';
import path from 'path';

const names = [
    '20260716000003_marketplace_phase6_infrastructure_extensions.sql',
    '20260716000011_marketplace_phase6_hold_helpers.sql',
    '20260716000013_marketplace_phase6_clarification_support_schema.sql',
    '20260716000014_marketplace_phase6_clarification_commands.sql',
    '20260716000015_marketplace_phase6_owner_support_request.sql',
    '20260716000016_marketplace_phase6_support_interventions.sql',
    '20260716000034_marketplace_phase6_support_task_provenance_fix.sql',
    '20260716000035_marketplace_phase6_support_event_source_fix.sql',
    '20260716000036_marketplace_phase6_support_deadline_task_fix.sql',
];
const readSql = () => names.map((name) => fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', name), 'utf8',
)).join('\n');

describe('Phase 6 clarification and platform support', () => {
    it('forward-fixes support tasks with request provenance required by Unit 12', () => {
        const sql = readSql();
        expect(sql).toContain('source_request_version=v_request.version');
        expect(sql).toContain('support_version,source_request_version');
    });

    it('uses the canonical platform_ops source for support-console events', () => {
        const correction = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations',
            '20260716000035_marketplace_phase6_support_event_source_fix.sql'), 'utf8');
        expect(correction).toContain("'platform_ops'");
        expect(correction).not.toContain("'support_console'");
    });

    it('never reopens superseded deadline-task history during support extensions', () => {
        const correction = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations',
            '20260716000036_marketplace_phase6_support_deadline_task_fix.sql'), 'utf8');
        expect(correction.match(/task_type='confirmation_expiry'[\s\S]{0,80}status IN\('open','in_progress'\)/g))
            .toHaveLength(1);
        expect(correction.match(/task_type='customer_decision_expiry'[\s\S]{0,80}status IN\('open','in_progress'\)/g))
            .toHaveLength(1);
    });

    it('creates private clarification/support storage with no client grants', () => {
        const sql = readSql();
        expect(sql).toContain('CREATE TABLE public.order_request_clarifications');
        expect(sql).toContain('CREATE TABLE public.order_request_support_notes');
        expect(sql).toContain('ALTER TABLE public.order_request_clarifications ENABLE ROW LEVEL SECURITY');
        expect(sql).toContain('FROM PUBLIC, anon, authenticated');
    });

    it('implements Owner request and customer response with exact states and versions', () => {
        const sql = readSql();
        expect(sql).toContain('public.request_clarification');
        expect(sql).toContain('public.provide_clarification');
        expect(sql).toContain("v_request.status<>'store_reviewing'");
        expect(sql).toContain("v_request.status<>'awaiting_clarification'");
        expect(sql).toContain("RAISE EXCEPTION 'STALE_VERSION'");
        expect(sql).toContain("'awaiting_clarification'");
        expect(sql).toContain("'store_reviewing'");
    });

    it('enforces Owner capability and customer ownership without caller store authority', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.has_phase6_owner_capability');
        expect(sql).toContain("'phase6_order_commands'");
        expect(sql).toContain('v_request.user_id<>v_actor');
        expect(sql).not.toMatch(/p_store_id\s+UUID/);
        expect(sql).not.toMatch(/p_customer_id\s+UUID/);
    });

    it('bounds/sanitizes clarification content and keeps raw text out of generic payloads', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.sanitize_private_text');
        expect(sql).toContain('char_length(p_customer_response)>2000');
        expect(sql).toContain('char_length(p_customer_prompt)>1000');
        expect(sql).toMatch(/jsonb_build_object\([^)]*'reasonCode',p_reason/s);
        expect(sql).not.toContain("jsonb_build_object('prompt',p_customer_prompt)");
        expect(sql).not.toContain("jsonb_build_object('response',p_customer_response)");
    });

    it('exposes clarification text only through customer-own and owner-capability safe reads', () => {
        const sql = readSql();
        expect(sql).toContain('public.marketplace_get_owner_order_request_clarification');
        expect(sql).toContain('public.marketplace_get_customer_order_request_clarification');
        expect(sql).toContain("'customerPrompt',c.customer_prompt");
        expect(sql).toContain("'customerResponse',c.customer_response");
        expect(sql).toContain('r.user_id=v_actor');
        expect(sql).toContain("'phase6_order_commands'");
    });

    it('pauses/restores confirmation timing and replaces clarification expiry tasks', () => {
        const sql = readSql();
        expect(sql).toContain('confirmation_open_seconds_remaining');
        expect(sql).toContain('clarification_expires_at');
        expect(sql).toContain("'clarification_expiry'");
        expect(sql).toContain("status='cancelled'");
    });

    it('keeps Owner support strictly non-transitioning and independently versioned', () => {
        const sql = readSql();
        const section = sql.split('CREATE FUNCTION public.request_platform_support')[1]
            .split('CREATE FUNCTION')[0];
        expect(section).toContain('support_version');
        expect(section).toContain("'platform_support_request'");
        expect(section).toContain("'order_request.support_requested'");
        expect(section).not.toContain('commerce_transition_log');
        expect(section).not.toMatch(/UPDATE public\.store_order_requests/);
        expect(section).not.toContain('inventory_holds');
    });

    it('deduplicates support task/event/audit/acknowledgement through command idempotency', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.claim_phase6_command');
        expect(sql).toContain('marketplace_sec.complete_phase6_command');
        expect(sql).toContain("'support:'||v_request.id");
        expect(sql).toContain('event_action_tasks_dedupe_unique');
    });

    it('uses the complete bounded canonical support category vocabulary', () => {
        const sql = readSql();
        [
            'inventory_exception', 'price_correction_review', 'customer_contact_issue',
            'fulfilment_exception', 'closure_exception', 'policy_exception',
            'technical_error', 'suspected_abuse', 'other',
        ].forEach((category) => expect(sql).toContain(`'${category}'`));
    });

    it('implements only the four authorized narrow support interventions', () => {
        const sql = readSql();
        [
            'support_cancel_request', 'support_extend_confirmation_deadline',
            'support_extend_customer_decision_deadline', 'support_resume_emergency_pause',
        ].forEach((name) => expect(sql).toContain(`public.${name}`));
        expect(sql).not.toContain('public.set_request_status');
        expect(sql).not.toContain('public.override_request');
        expect(sql).not.toContain('public.change_price');
        expect(sql).not.toContain('public.change_quantity');
    });

    it('requires explicit platform roles and assigned support case where specified', () => {
        const sql = readSql();
        expect(sql).toContain("marketplace_sec.has_platform_role(ARRAY['platform_admin'])");
        expect(sql).toContain("marketplace_sec.has_platform_role(ARRAY['platform_admin','support_agent'])");
        expect(sql).toContain('marketplace_sec.has_assigned_support_case');
        expect(sql).not.toContain('marketplace_sec.is_store_admin');
    });

    it('applies exact cancellation, deadline, soft-hold, and pause effects', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.release_request_holds');
        expect(sql).toContain("'platform_cancelled'");
        expect(sql).toContain('confirmation_due_at=confirmation_due_at+');
        expect(sql).toContain("h.hold_type='soft'");
        expect(sql).toContain('decision_seconds_remaining');
        expect(sql).toContain('paused_from_status');
    });

    it('records one event/evidence for real transitions and none for same-state extensions', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.record_support_transition');
        expect(sql).toContain('marketplace_sec.record_support_same_state_event');
        const sameState = sql.split('CREATE FUNCTION marketplace_sec.record_support_same_state_event')[1]
            .split('CREATE FUNCTION')[0];
        expect(sameState).not.toContain('commerce_transition_log');
    });

    it('uses opaque deep links and excludes private notes from events/notifications', () => {
        const sql = readSql();
        expect(sql).toMatch(/'\/marketplace\/requests\/'\|\|(v|p)_request\.id/);
        expect(sql).toMatch(/'\/owner\/requests\/'\|\|(v|p)_request\.id/);
        expect(sql).not.toContain("'note',p_private_note");
        expect(sql).not.toContain("'description',p_description");
    });

    it('keeps all RPCs authenticated and Phase 7 structures absent', () => {
        const sql = readSql();
        expect(sql).toContain('FROM PUBLIC, anon');
        expect(sql).toContain('TO authenticated,service_role');
        expect(sql).not.toContain('payment_pending');
        expect(sql).not.toContain('provider_payment');
    });
});
