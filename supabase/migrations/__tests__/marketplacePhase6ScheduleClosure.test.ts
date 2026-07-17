import fs from 'fs';
import path from 'path';

const names = [
    '20260716000003_marketplace_phase6_infrastructure_extensions.sql',
    '20260716000011_marketplace_phase6_hold_helpers.sql',
    '20260716000017_marketplace_phase6_payment_ready_helpers.sql',
    '20260716000019_marketplace_phase6_terminal_expiry_commands.sql',
    '20260716000020_marketplace_phase6_schedule_engine.sql',
    '20260716000021_marketplace_phase6_deadline_integration.sql',
    '20260716000022_marketplace_phase6_clarification_timeout.sql',
    '20260716000023_marketplace_phase6_closure_commands.sql',
    '20260716000038_marketplace_phase6_emergency_pause_remainder_fix.sql',
    '20260716000039_marketplace_phase6_emergency_resume_zero_fix.sql',
];
const readSql = () => names.map((name) => fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', name), 'utf8',
)).join('\n');

describe('Phase 6 SLA, schedule, closure, and pause contracts', () => {
    it('freezes a zero reminder remainder instead of null after the reminder is due', () => {
        const sql = readSql();
        expect(sql).toContain('ensure_phase6_emergency_pause_remainder');
        expect(sql).toContain('NEW.confirmation_open_seconds_remaining:=0');
    });

    it('resumes a zero reminder remainder at the next opening boundary', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.next_store_open_interval');
        expect(sql).toContain('COALESCE(OLD.confirmation_open_seconds_remaining,0)=0');
        expect(sql).toContain('NEW.confirmation_due_at:=v_interval.closes_at_utc');
    });

    it('ships executable rollback and multi-session PostgreSQL gates', () => {
        const integration = fs.readFileSync(path.join(process.cwd(), 'supabase', 'tests',
            'phase6_unit10_integration.sql'), 'utf8');
        const race = fs.readFileSync(path.join(process.cwd(), 'supabase', 'tests',
            'phase6_unit10_concurrency.ps1'), 'utf8');
        expect(integration).toContain('ROLLBACK;');
        expect(integration).toContain('store_open_seconds_between');
        expect(integration).toContain('pause_for_emergency_closure');
        expect(integration).toContain('resume_after_emergency_closure');
        expect(integration).toContain('has_function_privilege');
        expect(race).toContain("Assert-One-Winner 'pause-vs-accept'");
        expect(race).toContain("Assert-One-Winner 'pause-vs-expiry'");
        expect(race).toContain('quantity_available+quantity_reserved=quantity_total');
    });

    it('adds normalized recurring schedule and timezone authority with no client writes', () => {
        const sql = readSql();
        expect(sql).toContain('CREATE TABLE public.store_schedule_profiles');
        expect(sql).toContain('CREATE TABLE public.store_recurring_open_intervals');
        expect(sql).toContain('iana_timezone TEXT NOT NULL');
        expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
        expect(sql).toContain('FROM PUBLIC,anon,authenticated');
    });

    it('validates IANA zones, interval shape, and weekly overlap fail-closed', () => {
        const sql = readSql();
        expect(sql).toContain('pg_catalog.pg_timezone_names');
        expect(sql).toContain('marketplace_sec.validate_store_open_schedule');
        expect(sql).toContain("RAISE EXCEPTION 'STORE_SCHEDULE_INVALID'");
        expect(sql).toContain('int4range');
        expect(sql).toContain('&&');
    });

    it('supports closed weekdays, multiple intervals, and overnight intervals', () => {
        const sql = readSql();
        expect(sql).toContain('weekday SMALLINT');
        expect(sql).toContain('opens_at TIME NOT NULL');
        expect(sql).toContain('closes_at TIME NOT NULL');
        expect(sql).toMatch(/closes_at\s*<=\s*(?:i\.)?opens_at/);
    });

    it('converts local intervals through IANA timezone rules into UTC timestamptz', () => {
        const sql = readSql();
        expect(sql).toContain('AT TIME ZONE v_timezone');
        expect(sql).toContain('TIMESTAMPTZ');
        expect(sql).toContain('transaction_timestamp()');
    });

    it('gives full closure and special hours precedence over recurring hours', () => {
        const sql = readSql();
        expect(sql).toContain("exception_type IN('holiday','planned_closure','emergency_closure')");
        expect(sql).toContain("exception_type='special_hours'");
        expect(sql).toContain('special_hours');
        expect(sql).toContain('jsonb_to_recordset');
    });

    it('uses an interval-jump bounded-horizon engine rather than minute iteration', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.next_store_open_interval');
        expect(sql).toContain('marketplace_sec.add_store_open_seconds');
        expect(sql).toContain('marketplace_sec.store_closing_boundary_after');
        expect(sql).toContain('p_horizon_days');
        expect(sql).toContain("RAISE EXCEPTION 'STORE_SCHEDULE_UNAVAILABLE'");
        expect(sql).not.toContain("interval '1 minute'");
    });

    it('calculates exact calendar-aware open seconds between arbitrary timestamps', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.store_open_seconds_between');
        expect(sql).toContain('extract(epoch FROM');
        expect(sql).toContain('LEAST(');
        expect(sql).toContain('GREATEST(');
    });

    it('replaces the interim submission window with snapshotted open-time calculation', () => {
        const sql = readSql();
        expect(sql).toContain('CREATE OR REPLACE FUNCTION marketplace_sec.submission_confirmation_window');
        expect(sql).toContain("'commerce.confirmation_reminder_open_seconds'");
        expect(sql).toContain("'commerce.confirmation_expiry_business_days'");
        expect(sql).toContain('marketplace_sec.add_store_open_seconds');
        expect(sql).toContain('NEW.confirmation_reminder_at');
        expect(sql).not.toContain('p_at+make_interval(days=>v_days)');
        expect(sql).toContain('store_timezone_snapshot');
        expect(sql).toContain('store_schedule_version_snapshot');
        expect(sql).toContain('store_schedule_snapshot');
        expect(sql).toContain('marketplace_sec.snapshot_submission_schedule');
        expect(sql).toContain("exception_type='planned_closure'");
    });

    it('stores task request-version and policy-snapshot provenance', () => {
        const sql = readSql();
        expect(sql).toContain('ADD COLUMN source_request_version INTEGER');
        expect(sql).toContain('ADD COLUMN policy_snapshot_id UUID');
        expect(sql).toContain('marketplace_sec.schedule_phase6_deadline_task');
    });

    it('deduplicates tasks by request, version, and canonical category', () => {
        const sql = readSql();
        expect(sql).toContain("p_request_id||':'||p_request_version||':'||p_task_type");
        expect(sql).toContain('event_action_tasks_dedupe_unique');
        expect(sql).toContain("status='cancelled'");
    });

    it('overrides Unit 8 pause/resume with exact remaining open seconds', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.apply_clarification_calendar_timing');
        expect(sql).toContain('marketplace_sec.store_open_seconds_between');
        expect(sql).toContain('confirmation_open_seconds_remaining');
        expect(sql).toContain('marketplace_sec.add_store_open_seconds');
    });

    it('keeps clarification content private while timing triggers use only request state', () => {
        const sql = readSql();
        expect(sql).not.toContain('customer_prompt');
        expect(sql).not.toContain('customer_response');
        expect(sql).not.toContain('private_description');
    });

    it('implements typed clarification timeout with version, time, release, and evidence', () => {
        const sql = readSql();
        expect(sql).toContain('public.expire_clarification');
        expect(sql).toContain("status<>'awaiting_clarification'");
        expect(sql).toContain('transaction_timestamp()<v_request.clarification_expires_at');
        expect(sql).toContain("'clarification_window_elapsed'");
        expect(sql).toContain('marketplace_sec.release_request_holds');
    });

    it('snapshots exact customer-decision and payment-ready calendar windows', () => {
        const sql = readSql();
        expect(sql).toContain("'commerce.acceptance_window_seconds'");
        expect(sql).toContain("'commerce.payment_ready_window_seconds'");
        expect(sql).toContain('acceptance_expires_at');
        expect(sql).toContain('payment_expires_at');
    });

    it('does not let planned closure release unexpired payment-ready holds', () => {
        const sql = readSql();
        const schedule = sql.split('CREATE FUNCTION marketplace_sec.effective_store_open_intervals')[1]
            .split('CREATE FUNCTION')[0];
        expect(schedule).toContain("'planned_closure'");
        expect(schedule).not.toContain('release_request_holds');
        expect(schedule).not.toContain('inventory_holds');
    });

    it('pauses only canonical non-payment states for an active emergency exception', () => {
        const sql = readSql();
        expect(sql).toContain('public.pause_for_emergency_closure');
        ['submitted', 'store_reviewing', 'awaiting_clarification', 'awaiting_customer_decision']
            .forEach((state) => expect(sql).toContain(`'${state}'`));
        expect(sql).toContain("exception_type='emergency_closure'");
        expect(sql).toContain("status='paused_for_emergency_closure'");
    });

    it('preserves open/calendar remainder and active soft holds without bucket movement', () => {
        const sql = readSql();
        expect(sql).toContain('clarification_seconds_remaining');
        expect(sql).toContain('decision_seconds_remaining');
        const pause = sql.split('CREATE FUNCTION public.pause_for_emergency_closure')[1]
            .split('CREATE FUNCTION')[0];
        expect(pause).not.toContain('release_request_holds');
        expect(pause).not.toContain('UPDATE public.store_inventory');
    });

    it('resumes through exact replacement deadlines and no repeated side effects', () => {
        const sql = readSql();
        expect(sql).toContain('public.resume_after_emergency_closure');
        expect(sql).toContain("status<>'paused_for_emergency_closure'");
        expect(sql).toContain('paused_from_status');
        expect(sql).toContain('marketplace_sec.add_store_open_seconds');
        expect(sql).toContain('marketplace_sec.claim_phase6_system_command');
    });

    it('enforces maximum emergency duration and pause count from snapshotted policy', () => {
        const sql = readSql();
        expect(sql).toContain("'commerce.emergency_closure_pause_seconds'");
        expect(sql).toContain("'commerce.max_emergency_closure_pauses'");
        expect(sql).toContain('emergency_pause_count');
        expect(sql).toContain('closure_pause_expires_at');
        expect(sql).toContain('LEAST(v_max_count,v_live_max_count)');
    });

    it('expires an overlong pause through the named terminal command', () => {
        const sql = readSql();
        expect(sql).toContain('public.expire_emergency_closure_pause');
        expect(sql).toContain("'emergency_closure_cap_elapsed'");
        expect(sql).toContain("'platform_cancelled'");
        expect(sql).toContain('marketplace_sec.assert_no_active_request_holds');
    });

    it('keeps compliance suspension distinct through named ineligibility cancellation', () => {
        const sql = readSql();
        expect(sql).toContain('public.cancel_for_store_ineligibility');
        expect(sql).toContain("'store_ineligible'");
        expect(sql).toContain("'order_request.store_ineligible'");
        expect(sql).toContain("s.status='suspended'");
        expect(sql).toContain("s.selling_status<>'allowed'");
    });

    it('does not silently cancel merely because a feature is disabled', () => {
        const sql = readSql();
        expect(sql).toContain('cancel_for_rollout_shutdown');
        expect(sql).not.toContain('AFTER UPDATE OF is_active');
        expect(sql).not.toContain('AFTER UPDATE OF is_enabled');
    });

    it('requires service/system authority, expected versions, idempotency and deterministic locks', () => {
        const sql = readSql();
        expect(sql).toContain("auth.role() IS DISTINCT FROM 'service_role'");
        expect(sql).toContain("RAISE EXCEPTION 'STALE_VERSION'");
        expect(sql).toContain('ORDER BY r.id FOR UPDATE');
        expect(sql).toContain('ORDER BY h.id FOR UPDATE');
        expect(sql).toContain('TO service_role');
    });

    it('uses canonical safe events/notifications and opaque deep links', () => {
        const sql = readSql();
        expect(sql).toContain("'order_request.emergency_closure_paused'");
        expect(sql).toContain("'order_request.emergency_closure_resumed'");
        expect(sql).toMatch(/'\/marketplace\/requests\/'\|\|[pv]_request\.id/);
        expect(sql).not.toContain("'note',p_private_note");
    });

    it('contains no provider, payment_pending, generic deadline editor, or cron enablement', () => {
        const sql = readSql();
        expect(sql).not.toContain('payment_pending');
        expect(sql).not.toContain('provider_payment');
        expect(sql).not.toContain('public.set_deadline');
        expect(sql).not.toContain('cron.schedule');
    });
});
