import fs from 'fs';
import path from 'path';

const migrationPath = path.resolve(
    __dirname,
    '../20260714000001_harden_club_primary_and_exchange_city.sql',
);

describe('club primary venue and exchange city hardening migration', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    it('uses one authorized, membership-validating transaction to set the primary venue', () => {
        expect(sql).toContain('CREATE OR REPLACE FUNCTION public.set_primary_club_venue');
        expect(sql).toContain('public.is_active_eligible_club_manager(auth.uid(), p_club_id)');
        expect(sql).toContain('FROM public.club_venues');
        expect(sql).toContain('venue_id = p_venue_id');
        expect(sql).toContain('FOR UPDATE');
        expect(sql).toMatch(/UPDATE public\.club_venues[\s\S]*SET is_primary = \(venue_id = p_venue_id\)/);
        expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.set_primary_club_venue(uuid, uuid) FROM anon');
    });

    it('replaces request_transaction and compares stored normalized city keys', () => {
        expect(sql).toContain('ADD COLUMN IF NOT EXISTS city_key text');
        expect(sql).toContain('CREATE OR REPLACE FUNCTION public.request_transaction');
        expect(sql).toContain('v_pickup_venue.city_key IS DISTINCT FROM v_listing.city_key');
        expect(sql).toContain('Pickup venue must be in the same city as the listing');
    });
});
