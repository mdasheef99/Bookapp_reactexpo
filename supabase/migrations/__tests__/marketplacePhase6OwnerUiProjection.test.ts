import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'supabase/migrations/20260716000030_marketplace_phase6_owner_ui_safe_projections.sql');
const sql = () => fs.readFileSync(file, 'utf8');

describe('Phase 6 Unit 14 Owner safe UI projections', () => {
    it('adds versioned Owner list and detail projections', () => {
        expect(sql()).toMatch(/marketplace_list_owner_order_requests[\s\S]*version INTEGER/i);
        expect(sql()).toMatch(/marketplace_get_owner_order_request[\s\S]*'version', r\.version/i);
    });
    it('enforces current Owner capability for list and detail', () => {
        expect(sql().match(/has_phase6_owner_capability/g)?.length).toBeGreaterThanOrEqual(2);
    });
    it('excludes phone, address, global customer identity, and private snapshots', () => {
        expect(sql()).not.toMatch(/phone|delivery_address|customer_user_id|private_snapshot/i);
    });
    it('exposes bounded item and deadline fields only', () => {
        expect(sql()).toMatch(/'quantity_available', inv\.quantity_available/i);
        expect(sql()).toMatch(/'unit_price_bound_minor', i\.server_bound_unit_price_minor/i);
        expect(sql()).toMatch(/'closure_pause_expires_at', r\.closure_pause_expires_at/i);
    });
});
