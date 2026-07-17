import fs from 'fs';
import path from 'path';

const migrations = [
    '20260716000026_marketplace_phase6_task_claim_retry.sql',
    '20260716000027_marketplace_phase6_task_commands.sql',
    '20260716000028_marketplace_phase6_scheduler_contract.sql',
];
const readSql = () => migrations.map((name) => fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', name), 'utf8',
)).join('\n');
const readFunction = (name: string) => fs.readFileSync(path.join(
    process.cwd(), 'supabase', 'functions', name, 'index.ts',
), 'utf8');

describe('Phase 6 Unit 12 scheduler, claims, retries, and dead-letter contracts', () => {
    it('ships executable integration and multi-session claim gates', () => {
        const integration = fs.readFileSync(path.join(process.cwd(), 'supabase', 'tests',
            'phase6_unit12_integration.sql'), 'utf8');
        const race = fs.readFileSync(path.join(process.cwd(), 'supabase', 'tests',
            'phase6_unit12_concurrency.ps1'), 'utf8');
        expect(integration).toContain('ROLLBACK;');
        expect(integration).toContain('claim_phase6_tasks');
        expect(integration).toContain('replay_phase6_dead_letter');
        expect(race).toContain("Assert-NoOverlap 'concurrent-claims'");
        expect(race).toContain("Assert-OneRecovery 'expired-lease'");
    });

    it('claims bounded due batches with SKIP LOCKED and database leases', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.claim_phase6_tasks');
        expect(sql).toContain('FOR UPDATE SKIP LOCKED');
        expect(sql).toContain('p_batch_size INTEGER DEFAULT 50');
        expect(sql).toContain('p_batch_size>100');
        expect(sql).toContain("status='in_progress'");
        expect(sql).toContain("lease_expires_at=transaction_timestamp()+interval '5 minutes'");
        expect(sql).toContain('attempt_count=attempt_count+1');
    });

    it('prevents live-lease theft and recovers expired leases', () => {
        const sql = readSql();
        expect(sql).toContain('lease_expires_at<=transaction_timestamp()');
        expect(sql).toContain('lease_expires_at>transaction_timestamp()');
        expect(sql).toContain('commerce_scheduler_leases');
        expect(sql).toContain('marketplace_sec.acquire_phase6_scheduler_lease');
    });

    it('keeps claim and completion RPCs private and service-only', () => {
        const sql = readSql();
        expect(sql).toContain("auth.role() IS DISTINCT FROM 'service_role'");
        expect(sql).toContain('REVOKE ALL ON FUNCTION marketplace_sec.claim_phase6_tasks');
        expect(sql).toContain('TO service_role');
        expect(sql).not.toContain('TO authenticated,service_role');
    });

    it('implements canonical retry, resolved-noop, and dead-letter outcomes', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.complete_phase6_task');
        ['30 seconds', '2 minutes', '10 minutes', '30 minutes', '2 hours']
            .forEach((delay) => expect(sql).toContain(`interval '${delay}'`));
        expect(sql).toContain("status='resolved_noop'");
        expect(sql).toContain("status='retry_scheduled'");
        expect(sql).toContain("status='dead_letter'");
        expect(sql).toContain('commerce_task_dead_letters');
        expect(sql).toContain('safe_error_category');
    });

    it('authorizes, bounds, audits, and counts manual replay', () => {
        const sql = readSql();
        expect(sql).toContain('public.replay_phase6_dead_letter');
        expect(sql).toContain("ARRAY['platform_admin','support_agent']");
        expect(sql).toContain('char_length(p_reason) BETWEEN 10 AND 500');
        expect(sql).toContain('replay_count=replay_count+1');
        expect(sql).toContain("'manual_replay'");
        expect(sql).toContain('marketplace_audit_logs');
    });

    it('provides named idempotent reminder and confirmation-expiry commands', () => {
        const sql = readSql();
        expect(sql).toContain('public.send_confirmation_reminder');
        expect(sql).toContain('public.expire_confirmation');
        expect(sql).toContain("'order_request.confirmation_due_soon'");
        expect(sql).toContain("'order_request.expired'");
        expect(sql).toContain('source_request_version');
        expect(sql).toContain('transaction_timestamp()<v_request.confirmation_due_at');
    });

    it('never schedules one task per abandoned cart', () => {
        const sql = readSql();
        expect(sql).not.toContain("task_type='cart_abandonment'");
        expect(sql).not.toContain("'cart_abandonment',");
    });

    it('defines scheduler cadence without enabling remote cron', () => {
        const sql = readSql();
        expect(sql).toContain("scheduler_cadence TEXT NOT NULL DEFAULT '1 minute'");
        expect(sql).toContain('maximum_worker_concurrency INTEGER NOT NULL DEFAULT 10');
        expect(sql).toContain('maximum_scheduler_fanout INTEGER NOT NULL DEFAULT 4');
        expect(sql).not.toContain('cron.schedule');
        expect(sql).not.toContain('net.http_post');
    });

    it('uses service-only scheduler authentication and bounded dispatch', () => {
        const scheduler = readFunction('commerce-scheduler');
        expect(scheduler).toContain('COMMERCE_SCHEDULER_SECRET');
        expect(scheduler).toContain("authorization !== `Bearer ${schedulerSecret}`");
        expect(scheduler).toContain("rpc('acquire_phase6_scheduler_lease'");
        expect(scheduler).toContain("rpc('claim_phase6_tasks'");
        expect(scheduler).toContain('MAXIMUM_FANOUT = 4');
        expect(scheduler).toContain('DEFAULT_BATCH_SIZE = 50');
        expect(scheduler).not.toContain('taskIds');
    });

    it('dispatches only named commands and never writes commerce state directly', () => {
        const worker = readFunction('commerce-task-worker');
        ['send_confirmation_reminder', 'expire_confirmation', 'expire_clarification',
            'expire_customer_decision', 'expire_payment_ready',
            'expire_emergency_closure_pause', 'cancel_for_store_ineligibility']
            .forEach((command) => expect(worker).toContain(command));
        expect(worker).toContain("rpc('complete_phase6_task'");
        expect(worker).toContain('source_request_version');
        expect(worker).toContain('idempotencyKey: `phase6-task:${task.id}`');
        expect(worker).not.toContain(".from('store_order_requests').update");
        expect(worker).not.toContain(".from('inventory_holds').update");
    });

    it('keeps notification delivery linked to its canonical inbox row', () => {
        const sql = readSql();
        const worker = readFunction('commerce-task-worker');
        const legacyWorker = readFunction('send-notification');
        expect(sql).toContain('marketplace_notification_id');
        expect(worker).toContain('notification_delivery');
        expect(worker).toContain('record_phase6_delivery_result');
        expect(worker).not.toContain(".from('marketplace_notifications').delete");
        expect(legacyWorker).toContain(".is('marketplace_notification_id', null)");
    });

    it('records structured non-PII operational observations', () => {
        const sql = readSql();
        const scheduler = readFunction('commerce-scheduler');
        expect(sql).toContain('commerce_scheduler_runs');
        expect(sql).toContain('tasks_claimed');
        expect(scheduler).toContain('schedulerRunId');
        expect(scheduler).not.toContain('phone');
        expect(scheduler).not.toContain('address');
        expect(scheduler).not.toContain('private_description');
    });

    it('contains no Phase 7 provider/payment/ledger behavior or remote enablement', () => {
        const all = `${readSql()}\n${readFunction('commerce-scheduler')}\n${readFunction('commerce-task-worker')}`;
        expect(all).not.toContain('payment_pending');
        expect(all).not.toContain('provider_payment');
        expect(all).not.toContain('INSERT INTO public.store_orders');
        expect(all).not.toContain('finance_ledger_entries');
        expect(all).not.toContain('supabase functions deploy');
    });
});
