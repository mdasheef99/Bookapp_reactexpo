import fs from 'fs';
import path from 'path';

const migrationNames = [
    '20260716000001_marketplace_phase6_order_request_core.sql',
    '20260716000006_marketplace_phase6_cart_command_foundation.sql',
    '20260716000007_marketplace_phase6_cart_commands.sql',
    '20260716000008_marketplace_phase6_cart_replacement.sql',
];

const readSql = () => migrationNames
    .map((name) => fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', name), 'utf8'))
    .join('\n');

describe('Phase 6 transactional cart commands', () => {
    it('defines the complete named cart command surface and opaque replacement tokens', () => {
        const sql = readSql();
        [
            'marketplace_get_or_create_cart',
            'marketplace_get_active_cart',
            'marketplace_add_cart_item',
            'marketplace_set_cart_item_quantity',
            'marketplace_remove_cart_item',
            'marketplace_confirm_cart_replacement',
        ].forEach((name) => expect(sql).toContain(`public.${name}`));
        expect(sql).toContain('CREATE TABLE public.marketplace_cart_replacement_tokens');
        expect(sql).toContain('token_hash TEXT NOT NULL UNIQUE');
        expect(sql).toContain('expires_at TIMESTAMPTZ NOT NULL');
    });

    it('serializes concurrent create/replacement and uses row locks in deterministic order', () => {
        const sql = readSql();
        expect(sql).toContain("pg_advisory_xact_lock(hashtextextended('phase6-cart:' || v_actor::TEXT, 0))");
        expect(sql).toContain('ORDER BY c.id FOR UPDATE');
        expect(sql).toContain('ORDER BY l.id FOR UPDATE');
        expect(sql).toContain('ORDER BY i.id FOR UPDATE');
        expect(sql).toContain('marketplace_carts_one_active_per_user');
        expect(sql).toContain("WHERE status = 'active'");
    });

    it('implements payload-bound idempotency and stale-version protection', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.claim_phase6_command');
        expect(sql).toContain('marketplace_sec.complete_phase6_command');
        expect(sql).toContain("RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED'");
        expect(sql).toContain("RAISE EXCEPTION 'COMMAND_IN_PROGRESS'");
        expect(sql).toContain("RAISE EXCEPTION 'STALE_VERSION'");
        expect(sql).toContain('digest(p_payload::TEXT, \'sha256\')');
    });

    it('lazily abandons expired carts and preserves the old cart until replacement confirmation', () => {
        const sql = readSql();
        expect(sql).toContain("v_cart.expires_at <= transaction_timestamp()");
        expect(sql).toContain("SET status = 'abandoned'");
        expect(sql).toContain("'marketplace_cart.abandoned'");
        expect(sql).toContain("'CROSS_STORE_REPLACEMENT_REQUIRED'");
        expect(sql).toContain("SET status = 'replaced'");
        expect(sql).toContain("'marketplace_cart.replaced'");
        expect(sql).toContain('AND used_at IS NULL');
    });

    it('derives actor/store/listing/inventory server-side and creates no cart-stage holds', () => {
        const sql = readSql();
        expect(sql).toContain('v_actor UUID := auth.uid()');
        expect(sql).toContain('public.marketplace_book_listings l');
        expect(sql).toContain('public.store_inventory i');
        expect(sql).toContain('v_listing.store_id <> v_inventory.store_id');
        expect(sql).not.toMatch(/INSERT INTO public\.inventory_holds/);
        expect(sql).not.toContain('payment_pending');
    });

    it('revalidates listing, moderation, price, and inventory on quantity updates', () => {
        const sql = readSql();
        const updateCommand = sql.split(
            'CREATE FUNCTION public.marketplace_set_cart_item_quantity',
        )[1].split('CREATE FUNCTION public.marketplace_remove_cart_item')[0];
        expect(updateCommand).toContain('public.marketplace_book_listings');
        expect(updateCommand).toContain("moderation_status <> 'approved'");
        expect(updateCommand).toContain("v_listing.status <> 'active'");
        expect(updateCommand).toContain('price_snapshot_minor=v_listing.selling_price_minor');
        expect(updateCommand).toContain('quantity_available < p_quantity');
    });

    it('keeps writes behind authenticated SECURITY DEFINER RPCs', () => {
        const sql = readSql();
        expect(sql).toContain("SECURITY DEFINER\nSET search_path = ''");
        expect(sql).toContain('FROM PUBLIC, anon');
        expect(sql).toContain('TO authenticated, service_role');
    });
});
