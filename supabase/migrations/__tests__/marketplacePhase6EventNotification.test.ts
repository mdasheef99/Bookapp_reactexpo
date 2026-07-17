import fs from 'fs';
import path from 'path';

const migrationNames = [
    '20260716000024_marketplace_phase6_event_notification_contract.sql',
    '20260716000025_marketplace_phase6_notification_transport.sql',
];

const readSql = () => migrationNames.map((name) => fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', name), 'utf8',
)).join('\n');

describe('Phase 6 Unit 11 events, audit, notifications, and realtime contracts', () => {
    it('ships an executable rollback-only PostgreSQL integration gate', () => {
        const sql = fs.readFileSync(path.join(
            process.cwd(), 'supabase', 'tests', 'phase6_unit11_integration.sql',
        ), 'utf8');
        expect(sql).toContain('ROLLBACK;');
        expect(sql).toContain('event uniqueness');
        expect(sql).toContain('notification fan-out');
        expect(sql).toContain('persisted RLS');
        expect(sql).toContain('atomic rollback');
        expect(sql).toContain('transport failure');
        expect(sql).toContain('cross-tenant denial');
    });

    it('registers canonical schema-versioned event and notification vocabularies', () => {
        const sql = readSql();
        expect(sql).toContain('CREATE TABLE public.marketplace_event_schema_registry');
        expect(sql).toContain('CREATE TABLE public.marketplace_notification_type_registry');
        expect(sql).toContain('marketplace_sec.validate_phase6_event');
        expect(sql).toContain('marketplace_sec.validate_phase6_notification');
        expect(sql).toContain('schema_version');
        expect(sql).toContain("'order_request.submitted'");
        expect(sql).toContain("'commerce.order_request.submitted.store'");
    });

    it('keeps one event per transition while preserving request/cart submission split', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_events_transition_unique');
        expect(sql).toContain('commerce_entity_creation_log');
        expect(sql).toContain('commerce_transition_log');
        expect(sql).toContain("'marketplace_cart.submitted'");
        expect(sql).toContain("'order_request.submitted'");
        expect(sql).toContain("'order_request.support_requested'");
        expect(sql).toContain("WHEN 'order_request.support_requested' THEN false");
    });

    it('adds structured append-only audit evidence without private text', () => {
        const sql = readSql();
        ['command_name', 'actor_role', 'outcome', 'reason_code', 'version_before',
            'version_after', 'correlation_id', 'privacy_classification']
            .forEach((column) => expect(sql).toContain(column));
        expect(sql).toContain('marketplace_sec.reject_phase6_evidence_mutation');
        expect(sql).not.toContain("details->>'phone'");
        expect(sql).not.toContain("details->>'address'");
        expect(sql).not.toContain('private_description');
    });

    it('makes marketplace_notifications the recipient-owned canonical commerce inbox', () => {
        const sql = readSql();
        expect(sql).toContain('dedupe_key TEXT');
        expect(sql).toContain('marketplace_notifications_commerce_dedupe_unique');
        expect(sql).toContain('marketplace_list_commerce_notifications');
        expect(sql).toContain('marketplace_mark_commerce_notification_read');
        expect(sql).toContain('user_id=auth.uid()');
        expect(sql).toContain('notifications recipient select');
    });

    it('fans out only to distinct active entitled Owners', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.phase6_notification_owner_recipients');
        expect(sql).toContain('SELECT DISTINCT sa.user_id');
        expect(sql).toContain("sa.role='owner'");
        expect(sql).toContain("sa.status='active'");
        expect(sql).toContain("'commerce_order_request_owner_notifications_enabled'");
        expect(sql).not.toContain("sa.role IN('owner','manager','staff')");
    });

    it('treats deliveries as external transport attempts with retry/dead-letter evidence', () => {
        const sql = readSql();
        expect(sql).toContain("channel IN ('push','email')");
        expect(sql).toContain("status IN ('pending','in_progress','sent','failed','dead_letter')");
        expect(sql).toContain('marketplace_sec.enqueue_phase6_notification_delivery');
        expect(sql).toContain('marketplace_sec.record_phase6_delivery_result');
        expect(sql).toContain('dead_lettered_at');
        expect(sql).toContain('last_error_category');
        expect(sql).toContain('ON CONFLICT (marketplace_notification_id,recipient_user_id,channel)');
    });

    it('enforces opaque deep links and rejects PII or authority fields', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.assert_phase6_safe_payload');
        ['phone', 'address', 'clarification', 'support_note', 'command_id',
            'correlation_id', 'causation_id', 'snapshot_id']
            .forEach((field) => expect(sql).toContain(`'${field}'`));
        expect(sql).toContain("deep_link_route IN ('customer_order_request','owner_order_request')");
        expect(sql).toContain("jsonb_build_object('requestId'");
    });

    it('keeps raw events and evidence inaccessible to ordinary clients', () => {
        const sql = readSql();
        expect(sql).toContain('REVOKE ALL ON public.marketplace_events FROM PUBLIC,anon,authenticated');
        expect(sql).toContain('REVOKE ALL ON public.marketplace_audit_logs FROM PUBLIC,anon,authenticated');
        expect(sql).toContain('REVOKE ALL ON public.commerce_transition_log FROM PUBLIC,anon,authenticated');
        expect(sql).toContain('TO authenticated,service_role');
    });

    it('contains no Phase 7 provider, payment, ledger, or paid-order behavior', () => {
        const sql = readSql();
        expect(sql).not.toContain('payment_pending');
        expect(sql).not.toContain('provider_payment');
        expect(sql).not.toContain('INSERT INTO public.store_orders');
        expect(sql).not.toContain('finance_ledger_entries');
    });
});
