import fs from 'fs';
import path from 'path';

const migrationNames = [
    '20260716000009_marketplace_phase6_submission_helpers.sql',
    '20260716000010_marketplace_phase6_submit_order_request.sql',
];
const readSql = () => migrationNames.map((name) => fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', name), 'utf8',
)).join('\n');

describe('Phase 6 atomic order-request submission', () => {
    it('exposes one authenticated transactional submit command with idempotent replay', () => {
        const sql = readSql();
        expect(sql).toContain('public.submit_order_request');
        expect(sql).toContain("marketplace_sec.claim_phase6_command");
        expect(sql).toContain("marketplace_sec.complete_phase6_command");
        expect(sql).toContain('FROM PUBLIC, anon');
        expect(sql).toContain('TO authenticated, service_role');
    });

    it('locks cart, listing, and inventory deterministically before effects', () => {
        const sql = readSql();
        expect(sql).toContain('ORDER BY c.id FOR UPDATE');
        expect(sql).toContain('ORDER BY ci.listing_id FOR UPDATE');
        expect(sql).toContain('ORDER BY i.id FOR UPDATE');
        expect(sql).toContain("RAISE EXCEPTION 'STALE_VERSION'");
        expect(sql).toContain('v_valid_item_count<>v_cart_item_count');
    });

    it('checks eligibility and entitled Owner before inserting any commerce effect', () => {
        const sql = readSql();
        const eligibility = sql.indexOf('evaluate_phase6_eligibility');
        const owner = sql.indexOf('SELECT count(DISTINCT sa.user_id) INTO v_owner_count');
        const requestInsert = sql.indexOf('INSERT INTO public.store_order_requests');
        expect(eligibility).toBeGreaterThan(0);
        expect(owner).toBeGreaterThan(eligibility);
        expect(requestInsert).toBeGreaterThan(owner);
        expect(sql).toContain("RAISE EXCEPTION 'ENTITLED_OWNER_UNAVAILABLE'");
    });

    it('uses the lower immutable price bound and deterministic tariff', () => {
        const sql = readSql();
        expect(sql).toContain('LEAST(l.selling_price_minor,ci.price_snapshot_minor)');
        expect(sql).toContain('commerce.price_drift_tolerance_minor');
        expect(sql).toContain('deliveryTariffMinor');
        expect(sql).toContain("ci.price_snapshot_minor),'INR'");
    });

    it('creates request, item and immutable private/seller/policy snapshots directly submitted', () => {
        const sql = readSql();
        expect(sql).toContain("v_cart.id,'submitted',p_fulfillment_method");
        expect(sql).toContain('INSERT INTO public.store_order_request_items');
        expect(sql).toContain('INSERT INTO public.store_order_request_private_snapshots');
        expect(sql).toContain('INSERT INTO public.store_order_request_seller_snapshots');
        expect(sql).toContain('INSERT INTO public.store_order_request_policy_snapshots');
    });

    it('records separate request creation and cart transition evidence/events', () => {
        const sql = readSql();
        expect(sql).toContain("'order_request.submitted'");
        expect(sql).toContain("'marketplace_cart.submitted'");
        expect(sql).toContain('marketplace_sec.derived_command_uuid');
        expect(sql).toContain('INSERT INTO public.commerce_entity_creation_log');
        expect(sql).toContain('INSERT INTO public.commerce_transition_log');
        expect(sql).toContain("SET status='submitted'");
    });

    it('fans out canonical notifications/tasks and creates no holds or Phase 7 objects', () => {
        const sql = readSql();
        expect(sql).toContain('INSERT INTO public.marketplace_notifications');
        expect(sql).toContain('commerce.order_request.submitted.customer');
        expect(sql).toContain('commerce.order_request.submitted.store');
        expect(sql).toContain("'confirmation_reminder'");
        expect(sql).toContain("'confirmation_expiry'");
        expect(sql).not.toMatch(/INSERT INTO public\.inventory_holds/);
        expect(sql).not.toContain('payment_pending');
    });
});
