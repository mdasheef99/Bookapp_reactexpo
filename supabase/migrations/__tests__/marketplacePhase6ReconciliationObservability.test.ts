import fs from 'fs';
import path from 'path';

const migrationNames = [
    '20260716000031_marketplace_phase6_reconciliation_foundation.sql',
    '20260716000032_marketplace_phase6_reconciliation_scans.sql',
    '20260716000033_marketplace_phase6_observability.sql',
];
const readSql = () => migrationNames.map((name) => fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', name), 'utf8',
)).join('\n');

describe('Phase 6 Unit 15 reconciliation and observability contracts', () => {
    it('ships executable rollback-only PostgreSQL coverage', () => {
        const integration = fs.readFileSync(path.join(process.cwd(), 'supabase', 'tests',
            'phase6_unit15_integration.sql'), 'utf8');
        expect(integration).toContain('ROLLBACK;');
        expect(integration).toContain('run_phase6_reconciliation');
        expect(integration).toContain('reserved_greater_than_active_holds');
        expect(integration).toContain('ordinary client can run reconciliation');
    });

    it.each([
        'reserved_greater_than_active_holds',
        'active_holds_greater_than_reserved',
        'terminal_request_active_hold',
        'payment_ready_missing_firm_hold',
        'decision_state_missing_soft_hold',
    ])('detects inventory/request invariant %s', (category) => {
        expect(readSql()).toContain(`'${category}'`);
    });

    it('detects transition evidence gaps and inconsistent duplicates', () => {
        const sql = readSql();
        expect(sql).toContain("'transition_missing_event'");
        expect(sql).toContain("'event_missing_transition'");
        expect(sql).toContain("'inconsistent_transition_event'");
        expect(sql).toContain('r.is_transition=true');
        expect(sql).toContain("r.is_transition=false");
        expect(sql).toContain('COALESCE(r.store_id,c.store_id)');
        expect(sql).not.toContain('t.entity_id,t.store_id');
    });

    it('detects expired leases and performs only deterministic lease recovery', () => {
        const sql = readSql();
        expect(sql).toContain("'expired_task_lease'");
        expect(sql).toContain("status='retry_scheduled'");
        expect(sql).toContain('lease_owner=NULL');
        expect(sql).toContain('lease_expires_at=NULL');
        expect(sql).not.toContain('lease_expires_at=NULL,locked_at=NULL');
    });

    it('supersedes stale-version tasks without executing commerce commands', () => {
        const sql = readSql();
        expect(sql).toContain("'superseded_task'");
        expect(sql).toContain("status='resolved_noop'");
        expect(sql).not.toContain('UPDATE public.store_order_requests SET status');
    });

    it('alerts on task and notification dead letters while preserving inbox rows', () => {
        const sql = readSql();
        expect(sql).toContain("'task_dead_letter'");
        expect(sql).toContain("'notification_dead_letter'");
        expect(sql).not.toContain('DELETE FROM public.marketplace_notifications');
    });

    it('detects unclaimed due tasks, excess attempts, and duplicate active tasks', () => {
        const sql = readSql();
        expect(sql).toContain("'due_task_never_claimed'");
        expect(sql).toContain("'task_attempts_exceeded'");
        expect(sql).toContain("'duplicate_active_task'");
    });

    it('detects missing delivery work and duplicated canonical notifications', () => {
        const sql = readSql();
        expect(sql).toContain("'notification_delivery_missing'");
        expect(sql).toContain("'duplicate_canonical_notification'");
    });

    it('detects missing entitled Owners and invalid notification recipients', () => {
        const sql = readSql();
        expect(sql).toContain("'store_missing_entitled_owner'");
        expect(sql).toContain("'notification_no_valid_recipient'");
        expect(sql).toContain('phase6_notification_owner_recipients');
    });

    it('detects missing, malformed, and overlapping policy configuration', () => {
        const sql = readSql();
        expect(sql).toContain("'required_policy_missing'");
        expect(sql).toContain("'invalid_policy_value'");
        expect(sql).toContain("'overlapping_policy_range'");
    });

    it('detects invalid timezone and schedule configuration', () => {
        const sql = readSql();
        expect(sql).toContain("'invalid_store_timezone'");
        expect(sql).toContain("'invalid_opening_schedule'");
        expect(sql).toContain('pg_timezone_names');
    });

    it('keeps reconciliation service-only with fixed search paths', () => {
        const sql = readSql();
        expect(sql).toContain("auth.role() IS DISTINCT FROM 'service_role'");
        expect(sql).toContain("SECURITY DEFINER SET search_path=''");
        expect(sql).toContain('REVOKE ALL ON FUNCTION public.run_phase6_reconciliation');
        expect(sql).toContain('TO service_role');
        expect(sql).not.toContain('TO authenticated,service_role');
    });

    it('deduplicates operational cases across repeated runs', () => {
        const sql = readSql();
        expect(sql).toContain('finding_key TEXT NOT NULL UNIQUE');
        expect(sql).toContain('ON CONFLICT(finding_key) DO UPDATE');
        expect(sql).toContain('occurrence_count=');
    });

    it('rejects PII from cases and structured observations', () => {
        const sql = readSql();
        expect(sql).toContain('assert_phase6_safe_payload(p_safe_payload)');
        expect(sql).toContain('assert_phase6_safe_payload(NEW.safe_payload)');
        expect(sql).not.toContain('customer_note');
        expect(sql).not.toContain('contact_snapshot');
        expect(sql).not.toContain('delivery_address_snapshot');
    });

    it('does not silently repair ambiguous inventory', () => {
        const sql = readSql();
        expect(sql).not.toContain('UPDATE public.store_inventory SET quantity_reserved');
        expect(sql).not.toContain('UPDATE public.store_inventory SET quantity_available');
    });

    it('detects stale deadlines and orphaned private/request records', () => {
        const sql = readSql();
        expect(sql).toContain("'request_past_state_deadline'");
        expect(sql).toContain("'request_item_state_mismatch'");
        expect(sql).toContain("'task_entity_incompatible'");
        expect(sql).toContain("'orphaned_private_snapshot'");
        expect(sql).toContain("'orphaned_request_item'");
    });

    it('detects prohibited PII keys in commerce payloads', () => {
        const sql = readSql();
        expect(sql).toContain("'prohibited_pii_payload'");
        expect(sql).toContain("ARRAY['phone','address','email','contact'");
    });

    it('records non-PII observations for required operational outcomes', () => {
        const sql = readSql();
        ['command_outcome', 'idempotency_replay', 'stale_version', 'hold_change',
            'request_transition', 'task_claim', 'retry', 'dead_letter',
            'notification_transport', 'reconciliation_finding', 'manual_replay',
            'policy_misconfiguration'].forEach((event) => expect(sql).toContain(`'${event}'`));
        ['observe_phase6_transition', 'observe_phase6_hold', 'observe_phase6_task',
            'observe_phase6_delivery', 'observe_phase6_idempotency', 'observe_phase6_manual_replay']
            .forEach((trigger) => expect(sql).toContain(`CREATE TRIGGER ${trigger}`));
    });

    it('exposes service-only aggregate operational metrics', () => {
        const sql = readSql();
        expect(sql).toContain('public.get_phase6_operational_metrics');
        ['oldestDueTaskAgeSeconds', 'deadLetterTotal', 'activeDiscrepancyTotal',
            'requestsByStatus', 'holdMismatchCount', 'taskRetryCount',
            'notificationFailureCount'].forEach((metric) => expect(sql).toContain(metric));
    });

    it('keeps Phase 5 public discovery and Phase 7 boundaries untouched', () => {
        const sql = readSql();
        expect(sql).not.toContain('marketplace_public_search');
        expect(sql).not.toContain('payment_pending');
        expect(sql).not.toContain('provider_payment');
        expect(sql).not.toContain('finance_ledger_entries');
    });
});
