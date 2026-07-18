import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260716000004_marketplace_phase6_authorization_safe_reads.sql',
);

describe('marketplace Phase 6 authorization and safe reads', () => {
    const readSql = () => fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

    it('requires an active owner and the capability-specific enabled entitlement', () => {
        const sql = readSql();
        expect(sql).toContain('marketplace_sec.has_phase6_owner_capability');
        expect(sql).toContain("sa.role = 'owner'");
        expect(sql).toContain("sa.status = 'active'");
        expect(sql).toContain("'phase6_order_commands'");
        expect(sql).toContain("'commerce_order_request_owner_commands_enabled'");
        expect(sql).toContain("'phase6_order_notifications'");
        expect(sql).toContain("'commerce_order_request_owner_notifications_enabled'");
        expect(sql).toContain('se.is_enabled = true');
    });

    it('enables deny-by-default RLS and revokes direct client access to authoritative tables', () => {
        const sql = readSql();
        [
            'marketplace_carts',
            'marketplace_cart_items',
            'store_order_requests',
            'store_order_request_items',
            'inventory_holds',
            'store_order_request_private_snapshots',
            'event_action_tasks',
            'marketplace_events',
            'marketplace_audit_logs',
        ].forEach((table) => expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`));
        expect(sql).toContain('REVOKE ALL ON public.store_order_requests FROM anon, authenticated');
        expect(sql).toContain('GRANT ALL ON public.store_order_requests TO service_role');
    });

    it('replaces role-blind store-wide notification reads with recipient-own access', () => {
        const sql = readSql();
        expect(sql).toContain('DROP POLICY IF EXISTS "notifications select own"');
        expect(sql).toContain('CREATE POLICY "notifications recipient select"');
        expect(sql).toContain('user_id = auth.uid()');
        expect(sql).not.toContain('marketplace_sec.is_store_admin(store_id)');
    });

    it('exposes separate customer, owner, and support safe-read projections', () => {
        const sql = readSql();
        [
            'marketplace_list_customer_order_requests',
            'marketplace_get_customer_order_request',
            'marketplace_list_owner_order_requests',
            'marketplace_get_owner_order_request',
            'marketplace_get_support_order_request',
        ].forEach((name) => expect(sql).toContain(`public.${name}`));
        expect(sql).toContain('r.user_id = auth.uid()');
        expect(sql).toContain("marketplace_sec.has_platform_role(ARRAY['platform_admin','support_agent'])");
        expect(sql).toContain("SECURITY DEFINER\nSET search_path = ''");
    });

    it('keeps private snapshots, raw events, tasks, and audits out of client projections', () => {
        const sql = readSql();
        expect(sql).not.toMatch(/GRANT SELECT ON public\.store_order_request_private_snapshots TO authenticated/);
        expect(sql).not.toMatch(/GRANT SELECT ON public\.marketplace_events TO authenticated/);
        expect(sql).not.toMatch(/GRANT SELECT ON public\.event_action_tasks TO authenticated/);
        expect(sql).not.toMatch(/GRANT SELECT ON public\.marketplace_audit_logs TO authenticated/);
        expect(sql).not.toContain('DROP POLICY "public listings select"');
        expect(sql).not.toContain('DROP POLICY "public store profiles select"');
    });
});
