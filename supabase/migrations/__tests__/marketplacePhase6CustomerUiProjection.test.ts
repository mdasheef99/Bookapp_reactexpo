import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260716000029_marketplace_phase6_ui_safe_projections.sql',
);

describe('Phase 6 Unit 13 safe UI projections', () => {
    const sql = () => fs.readFileSync(migrationPath, 'utf8');

    it('adds versioned customer list and detail projections', () => {
        expect(sql()).toMatch(/marketplace_list_customer_order_requests[\s\S]*version INTEGER/i);
        expect(sql()).toMatch(/marketplace_get_customer_order_request[\s\S]*'version', r\.version/i);
    });

    it('exposes immutable payment-ready commercial fields', () => {
        expect(sql()).toMatch(/'final_subtotal_minor', r\.final_subtotal_minor/i);
        expect(sql()).toMatch(/'final_delivery_tariff_minor', r\.final_delivery_tariff_minor/i);
        expect(sql()).toMatch(/'final_total_minor', r\.final_total_minor/i);
        expect(sql()).toMatch(/'payment_ready_at', r\.payment_ready_at/i);
    });

    it('exposes only safe item proposal fields needed for customer decisions', () => {
        expect(sql()).toMatch(/'pickup_eligible', i\.pickup_eligible_snapshot/i);
        expect(sql()).toMatch(/'delivery_eligible', i\.delivery_eligible_snapshot/i);
        expect(sql()).not.toMatch(/contact_snapshot|delivery_address_snapshot|customer_user_id/i);
    });

    it('keeps customer reads caller-owned', () => {
        expect(sql()).toMatch(/r\.user_id = auth\.uid\(\)/i);
        expect(sql()).toMatch(/SECURITY DEFINER[\s\S]*SET search_path = ''/i);
    });
});
