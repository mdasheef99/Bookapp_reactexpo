import fs from 'fs';
import path from 'path';

const migrationPaths = [
    '20260716000001_marketplace_phase6_order_request_core.sql',
    '20260716000002_marketplace_phase6_order_request_evidence.sql',
    '20260716000003_marketplace_phase6_infrastructure_extensions.sql',
].map((name) => path.join(process.cwd(), 'supabase', 'migrations', name));

describe('marketplace Phase 6 order-request foundation migration', () => {
    const readSql = () => migrationPaths.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

    it('preserves referenced Phase 5 listing evidence during inventory projection changes', () => {
        const correction = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations',
            '20260716000037_marketplace_phase6_listing_evidence_projection_fix.sql'), 'utf8');
        expect(correction).toContain('FROM public.store_order_request_items');
        expect(correction).toContain("status = CASE WHEN NEW.quantity_available = 0 THEN 'out_of_stock'");
        expect(correction).toContain("availability_status = 'unavailable'");
    });

    it('creates the approved cart, request, snapshot, hold, evidence, and schedule tables', () => {
        const sql = readSql();
        [
            'marketplace_carts',
            'marketplace_cart_items',
            'store_order_requests',
            'store_order_request_items',
            'store_order_request_private_snapshots',
            'store_order_request_private_snapshot_tombstones',
            'store_order_request_seller_snapshots',
            'store_order_request_policy_snapshots',
            'order_request_policy_acceptances',
            'inventory_holds',
            'commerce_entity_creation_log',
            'commerce_transition_log',
            'store_schedule_exceptions',
        ].forEach((table) => expect(sql).toContain(`CREATE TABLE public.${table}`));
    });

    it('enforces one active cart, INR money, strict price bounds, and evidence uniqueness', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_carts_one_active_per_user');
        expect(sql).toContain("WHERE status = 'active'");
        expect(sql).toContain("CHECK (currency_code = 'INR')");
        expect(sql).toContain('confirmed_unit_price_minor <= server_bound_unit_price_minor');
        expect(sql).toContain('UNIQUE (entity_type, entity_id)');
        expect(sql).toContain('UNIQUE (entity_type, entity_id, command_id)');
    });

    it('uses bucket-transfer hold vocabulary and strengthens inventory through follow-up controls', () => {
        const sql = readSql();
        expect(sql).toContain("hold_type IN ('soft', 'firm')");
        expect(sql).toContain("status IN ('active', 'released', 'converted_to_sale')");
        expect(sql).toContain('store_inventory_quantity_balance');
        expect(sql).toContain('quantity_total = quantity_available + quantity_reserved + quantity_sold + quantity_removed');
        expect(sql).toContain('REVOKE UPDATE ON public.store_inventory FROM authenticated');
    });

    it('extends events, canonical notifications, deliveries, tasks, idempotency, and typed policy infrastructure', () => {
        const sql = readSql();
        expect(sql).toContain('ALTER TABLE public.marketplace_events');
        expect(sql).toContain('ALTER TABLE public.marketplace_notifications');
        expect(sql).toContain('marketplace_notification_id');
        expect(sql).toContain('lease_owner');
        expect(sql).toContain('lease_expires_at');
        expect(sql).toContain('support_version');
        expect(sql).toContain('value_type');
        expect(sql).toContain('policy_version');
    });

    it('does not create Phase 7 provider, payment, paid-order, ledger, or settlement structures', () => {
        const sql = readSql();
        expect(sql).not.toMatch(/CREATE TABLE public\.payments\b/);
        expect(sql).not.toMatch(/CREATE TABLE public\.store_orders\b/);
        expect(sql).not.toMatch(/CREATE TABLE public\.finance_ledger_entries\b/);
        expect(sql).not.toContain('payment_pending');
        expect(sql).not.toContain('provider_payment');
    });
});
