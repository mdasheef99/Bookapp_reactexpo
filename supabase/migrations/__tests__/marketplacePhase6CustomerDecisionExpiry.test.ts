import fs from 'fs';
import path from 'path';

const names = [
    '20260716000011_marketplace_phase6_hold_helpers.sql',
    '20260716000017_marketplace_phase6_payment_ready_helpers.sql',
    '20260716000018_marketplace_phase6_customer_decision_commands.sql',
    '20260716000019_marketplace_phase6_terminal_expiry_commands.sql',
];
const readSql = () => names.map((name) => fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', name), 'utf8',
)).join('\n');

describe('Phase 6 customer decision, cancellation, and hold expiry', () => {
    it('adds explicit proposal acceptance and payment-ready timestamps', () => {
        const sql = readSql();
        expect(sql).toContain('ADD COLUMN accepted_proposal_version INTEGER');
        expect(sql).toContain('ADD COLUMN payment_ready_at TIMESTAMPTZ');
    });

    it('implements only the named customer and system commands', () => {
        const sql = readSql();
        ['accept_confirmed_changes', 'cancel_order_request', 'cancel_for_rollout_shutdown',
            'expire_customer_decision', 'expire_payment_ready']
            .forEach((name) => expect(sql).toContain(`public.${name}`));
        expect(sql).not.toContain('public.set_status');
        expect(sql).not.toContain('public.override_request');
        expect(sql).not.toContain('public.expire_request');
    });

    it('derives customer ownership and rejects stale or wrong-state proposals', () => {
        const sql = readSql();
        expect(sql).toContain('v_request.user_id<>v_actor');
        expect(sql).toContain("v_request.status<>'awaiting_customer_decision'");
        expect(sql).toContain("RAISE EXCEPTION 'STALE_VERSION'");
        expect(sql).toContain('accepted_proposal_version=v_request.version');
    });

    it('accepts no caller price, subtotal, tariff, store, customer, or hold quantity', () => {
        const sql = readSql();
        const section = sql.split('CREATE FUNCTION public.accept_confirmed_changes')[1]
            .split('CREATE FUNCTION')[0];
        expect(section).not.toMatch(/p_(price|subtotal|tariff|total|store_id|customer_id|hold_quantity)/);
        expect(sql).toContain('confirmed_quantity*confirmed_unit_price_minor');
    });

    it('locks request, items, inventory, holds, and tasks deterministically', () => {
        const sql = readSql();
        expect(sql).toContain('ORDER BY r.id FOR UPDATE');
        expect(sql).toContain('ORDER BY ri.inventory_id FOR UPDATE');
        expect(sql).toContain('ORDER BY i.id FOR UPDATE OF i');
        expect(sql).toContain('ORDER BY h.id FOR UPDATE');
        expect(sql).toContain('ORDER BY t.id FOR UPDATE');
    });

    it('promotes every active unexpired soft hold to firm', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.promote_request_soft_holds');
        expect(sql).toContain("h.hold_type='soft'");
        expect(sql).toContain("SET hold_type='firm'");
        expect(sql).toContain('h.expires_at>transaction_timestamp()');
    });

    it('does not move inventory buckets during soft-to-firm promotion', () => {
        const sql = readSql();
        const section = sql.split('CREATE FUNCTION marketplace_sec.promote_request_soft_holds')[1]
            .split('CREATE FUNCTION')[0];
        expect(section).not.toContain('UPDATE public.store_inventory');
        expect(section).not.toContain('quantity_available');
        expect(section).not.toContain('quantity_reserved');
    });

    it('requires firm holds for every payable item and forbids active soft holds', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.assert_payment_ready_holds');
        expect(sql).toContain("hold_type<>'firm'");
        expect(sql).toContain('h.quantity<>ri.confirmed_quantity');
    });

    it('rejects acceptance with unresolved clarification', () => {
        const sql = readSql();
        expect(sql).toContain('public.order_request_clarifications');
        expect(sql).toContain("c.status='open'");
    });

    it('requires pickup when the accepted delivery subtotal is below minimum', () => {
        const sql = readSql();
        expect(sql).toContain("p_fulfillment_selection<>'pickup'");
        expect(sql).toContain("RAISE EXCEPTION 'INVALID_FULFILMENT'");
        expect(sql).toContain("v_final_method:='pickup'");
    });

    it('calculates final subtotal and immutable snapshot tariff server-side', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.phase6_snapshot_tariff');
        expect(sql).toContain("'commerce.delivery_minimum_subtotal_minor'");
        expect(sql).toContain("'commerce.delivery_fixed_tariff_minor'");
        expect(sql).toContain("'commerce.delivery_free_threshold_minor'");
        expect(sql).toContain('final_total_minor=v_subtotal+v_tariff');
    });

    it('revalidates store, listing, fulfillment, and active-hold eligibility', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.assert_payment_ready_eligibility');
        expect(sql).toContain("l.status IN('active','paused')");
        expect(sql).toContain("l.moderation_status='approved'");
        expect(sql).toContain('commerce_order_requests_enabled');
    });

    it('transitions acceptance to provider-independent payment_ready with expiry task', () => {
        const sql = readSql();
        expect(sql).toContain("'payment_ready'");
        expect(sql).toContain('payment_ready_at=transaction_timestamp()');
        expect(sql).toContain("'payment_ready_expiry'");
        expect(sql).toContain("'order_request.changes_accepted'");
    });

    it('allows customer cancellation only from the explicit nonterminal states', () => {
        const sql = readSql();
        ['submitted', 'store_reviewing', 'awaiting_clarification',
            'awaiting_customer_decision', 'paused_for_emergency_closure', 'payment_ready']
            .forEach((state) => expect(sql).toContain(`'${state}'`));
        expect(sql).toContain("p_reason NOT IN('customer_requested','other')");
    });

    it('releases active soft or firm holds through the exactly-once bucket helper', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.release_request_holds');
        expect(sql).toContain('quantity_reserved=quantity_reserved-v_hold.quantity');
        expect(sql).toContain('quantity_available=quantity_available+v_hold.quantity');
        expect(sql).toContain("WHERE h.order_request_id=p_request_id AND h.status='active'");
    });

    it('makes duplicate customer cancellation an idempotent replay', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.claim_phase6_command');
        expect(sql).toContain('marketplace_sec.complete_phase6_command');
        expect(sql).toContain("'cancel_order_request'");
    });

    it('implements the named rollout cancellation with platform-admin authority only', () => {
        const sql = readSql();
        expect(sql).toContain('public.cancel_for_rollout_shutdown');
        expect(sql).toContain("marketplace_sec.has_platform_role(ARRAY['platform_admin'])");
        expect(sql).toContain("p_reason<>'feature_disabled'");
        expect(sql).not.toContain('marketplace_sec.is_store_admin');
    });

    it('keeps expiry commands service-only with server-time and version guards', () => {
        const sql = readSql();
        expect(sql).toContain("auth.role() IS DISTINCT FROM 'service_role'");
        expect(sql).toContain('transaction_timestamp()<v_request.acceptance_expires_at');
        expect(sql).toContain('transaction_timestamp()<v_request.payment_expires_at');
        expect(sql).toContain('TO service_role');
    });

    it('expires decisions and payment-ready into their exact terminal states', () => {
        const sql = readSql();
        expect(sql).toContain("v_next:='expired'");
        expect(sql).toContain("v_next:='payment_ready_expired'");
        expect(sql).toContain("'customer_decision_window_elapsed'");
        expect(sql).toContain("'payment_ready_window_elapsed'");
    });

    it('uses separate system idempotency for safe expiry replay', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.claim_phase6_system_command');
        expect(sql).toContain('marketplace_sec.complete_phase6_system_command');
        expect(sql).toContain('pg_advisory_xact_lock');
    });

    it('writes one canonical transition/event and closes related tasks atomically', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.record_phase6_request_transition');
        expect(sql).toContain('public.commerce_transition_log');
        expect(sql).toContain('public.marketplace_events');
        expect(sql).toContain("status='cancelled'");
        expect(sql).toContain("status='resolved'");
    });

    it('uses opaque links and excludes private snapshots and clarification text', () => {
        const sql = readSql();
        expect(sql).toContain("'/marketplace/requests/'||p_request.id");
        expect(sql).toContain("'/owner/requests/'||p_request.id");
        expect(sql).not.toContain('delivery_address_snapshot');
        expect(sql).not.toContain('contact_snapshot');
        expect(sql).not.toContain('customer_response');
        expect(sql).not.toContain('customer_prompt');
    });

    it('prevents terminal requests from retaining active holds', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.assert_no_active_request_holds');
        expect(sql).toContain("h.status='active'");
        expect(sql).toContain("RAISE EXCEPTION 'COMMERCE_COMMAND_FAILED'");
    });

    it('contains no Phase 7 provider, payment-attempt, order, or ledger writes', () => {
        const sql = readSql();
        expect(sql).not.toContain('payment_pending');
        expect(sql).not.toContain('provider_payment');
        expect(sql).not.toContain('payment_attempt');
        expect(sql).not.toContain('INSERT INTO public.store_orders');
        expect(sql).not.toContain('finance_ledger_entries');
    });

    it('ships disposable PostgreSQL integration and multi-session race gates', () => {
        const integration = fs.readFileSync(path.join(process.cwd(), 'supabase', 'tests',
            'phase6_unit9_integration.sql'), 'utf8');
        const race = fs.readFileSync(path.join(process.cwd(), 'supabase', 'tests',
            'phase6_unit9_concurrency.ps1'), 'utf8');
        expect(integration).toContain('ROLLBACK;');
        expect(integration).toContain('promotion moved buckets');
        expect(race).toContain("Assert-One-Winner 'cancel-vs-accept'");
        expect(race).toContain("Assert-One-Winner 'accept-vs-decision-expiry'");
        expect(race).toContain("'future-claim-lock'");
        expect(race).toContain('phase6_unit9_cleanup.sql');
    });
});
