import fs from 'fs';
import path from 'path';

const migrationNames = [
    '20260716000001_marketplace_phase6_order_request_core.sql',
    '20260716000011_marketplace_phase6_hold_helpers.sql',
    '20260716000012_marketplace_phase6_owner_review_outcomes.sql',
];
const readSql = () => migrationNames.map((name) => fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', name), 'utf8',
)).join('\n');

describe('Phase 6 Owner outcomes and bucket-transfer holds', () => {
    it('defines the complete Owner command surface behind capability checks', () => {
        const sql = readSql();
        [
            'start_store_review', 'confirm_full', 'confirm_partial',
            'mark_items_unavailable', 'reject_order_request',
        ].forEach((name) => expect(sql).toContain(`public.${name}`));
        expect(sql).toContain('marketplace_sec.has_phase6_owner_capability');
        expect(sql).toContain("'phase6_order_commands'");
    });

    it('locks request, request items, inventory, and existing holds deterministically', () => {
        const sql = readSql();
        expect(sql).toContain('ORDER BY r.id FOR UPDATE');
        expect(sql).toContain('ORDER BY ri.inventory_id FOR UPDATE');
        expect(sql).toContain('ORDER BY i.id FOR UPDATE');
        expect(sql).toContain('ORDER BY h.id FOR UPDATE');
        expect(sql).toContain("RAISE EXCEPTION 'STALE_VERSION'");
    });

    it('moves inventory atomically from available to reserved without changing total', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.create_bucket_transfer_holds');
        expect(sql).toContain('quantity_available=quantity_available-v_quantity');
        expect(sql).toContain('quantity_reserved=quantity_reserved+v_quantity');
        expect(sql).toContain('quantity_total=quantity_available+quantity_reserved+quantity_sold+quantity_removed');
        expect(sql).toContain("p_hold_type NOT IN ('soft','firm')");
    });

    it('creates firm holds for full confirmation and soft holds for partial confirmation', () => {
        const sql = readSql();
        expect(sql).toContain("'firm'");
        expect(sql).toContain("'soft'");
        expect(sql).toContain("'payment_ready'");
        expect(sql).toContain("'awaiting_customer_decision'");
        expect(sql).toContain("'order_request.confirmed'");
        expect(sql).toContain("'order_request.partially_confirmed'");
    });

    it('keeps unavailable distinct from non-stock full rejection', () => {
        const sql = readSql();
        expect(sql).toContain("'unavailable'");
        expect(sql).toContain("'order_request.unavailable'");
        expect(sql).toContain("'store_rejected'");
        expect(sql).toContain("'order_request.rejected'");
        expect(sql).toContain('marketplace_sec.assert_non_stock_rejection_reason');
    });

    it('preserves idempotency, evidence, notifications, tasks, and the Phase 7 boundary', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.claim_phase6_command');
        expect(sql).toContain('INSERT INTO public.commerce_transition_log');
        expect(sql).toContain('INSERT INTO public.marketplace_events');
        expect(sql).toContain('INSERT INTO public.marketplace_notifications');
        expect(sql).not.toContain('payment_pending');
        expect(sql).not.toContain('provider_payment');
    });

    it('prevents replay/race duplication and preserves exactly-once bucket symmetry', () => {
        const sql = readSql();
        const command = sql.split('CREATE FUNCTION marketplace_sec.execute_owner_outcome')[1];
        expect(command.indexOf('claim_phase6_command')).toBeLessThan(
            command.indexOf('SELECT * INTO v_request'),
        );
        expect(sql).toContain('inventory_holds_one_active_request_item');
        expect(sql).toContain('AND quantity_available>=v_quantity');
        expect(sql).toContain('AND quantity_reserved>=v_hold.quantity');
        expect(sql).toContain('quantity_reserved=quantity_reserved-v_hold.quantity');
        expect(sql).toContain('quantity_available=quantity_available+v_hold.quantity');
        expect(sql).toContain("WHERE id=v_hold.id AND status='active'");
    });

    it('validates every item and all prices before hold creation', () => {
        const sql = readSql();
        const command = sql.split('CREATE FUNCTION marketplace_sec.execute_owner_outcome')[1];
        expect(command.indexOf('FOR v_payload IN')).toBeLessThan(
            command.indexOf('create_bucket_transfer_holds'),
        );
        expect(sql).toContain('v_input_items<>v_total_items');
        expect(sql).toContain('v_payload.unit_price_minor>v_row.server_bound_unit_price_minor');
        expect(sql).toContain('IF v_positive=0');
        expect(sql).toContain("p_outcome='confirm_partial' AND v_reduced=0");
    });
});
