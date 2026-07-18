import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
    process.cwd(), 'supabase', 'migrations',
    '20260716000005_marketplace_phase6_eligibility_resolver.sql',
);

describe('marketplace Phase 6 server eligibility resolver', () => {
    const readSql = () => fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

    it('resolves active typed policy by store, locality, city, then global scope', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.resolve_phase6_policy');
        expect(sql).toContain("WHEN 'store' THEN 4");
        expect(sql).toContain("WHEN 'locality' THEN 3");
        expect(sql).toContain("WHEN 'city' THEN 2");
        expect(sql).toContain("WHEN 'global' THEN 1");
        expect(sql).toContain('pc.effective_from <= p_at');
        expect(sql).toContain('(pc.effective_to IS NULL OR pc.effective_to > p_at)');
    });

    it('evaluates canonical store, subscription, entitlement, rollout, and owner gates', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.evaluate_phase6_eligibility');
        expect(sql).toContain("v_store.status = 'active'");
        expect(sql).toContain("v_store.verification_status = 'approved'");
        expect(sql).toContain("v_store.setup_status = 'complete'");
        expect(sql).toContain("v_store.selling_status = 'allowed'");
        expect(sql).toContain("ss.status IN ('trialing','active','past_due','grace_period')");
        expect(sql).toContain("'commerce_order_requests_enabled'");
        expect(sql).toContain("'commerce_order_request_owner_commands_enabled'");
        expect(sql).toContain("'commerce_order_request_owner_notifications_enabled'");
        expect(sql).toContain("sa.role = 'owner'");
    });

    it('derives listing, moderation, inventory, fulfilment, and tariff from server rows', () => {
        const sql = readSql();
        expect(sql).toContain('public.marketplace_book_listings l');
        expect(sql).toContain('public.store_inventory i');
        expect(sql).toContain("l.moderation_status = 'approved'");
        expect(sql).toContain('i.quantity_available >= requested.requested_quantity');
        expect(sql).toContain("'commerce.delivery_fixed_tariff_minor'");
        expect(sql).toContain("'commerce.delivery_free_threshold_minor'");
        expect(sql).toContain("'commerce.delivery_minimum_subtotal_minor'");
    });

    it('keeps internal resolvers unavailable to client roles', () => {
        const sql = readSql();
        expect(sql).toContain('FROM PUBLIC, anon, authenticated');
        expect(sql).toContain('TO service_role');
        expect(sql).toContain("SECURITY DEFINER\nSET search_path = ''");
    });
});
