import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260715000001_marketplace_phase4_security_hardening.sql',
);

describe('marketplace Phase 4 security hardening', () => {
    it('keeps the listing synchronization function trigger-only', () => {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        expect(sql).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.sync_marketplace_listing_from_inventory\(\)\s+FROM\s+PUBLIC/i);
        expect(sql).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.sync_marketplace_listing_from_inventory\(\)\s+FROM\s+anon/i);
        expect(sql).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.sync_marketplace_listing_from_inventory\(\)\s+FROM\s+authenticated/i);
        expect(sql).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.sync_marketplace_listing_from_inventory\(\)\s+TO\s+service_role/i);
    });
});
