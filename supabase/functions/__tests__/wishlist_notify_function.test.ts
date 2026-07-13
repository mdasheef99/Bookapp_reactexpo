import fs from 'fs';
import path from 'path';

const functionPath = path.join(process.cwd(), 'supabase', 'functions', 'wishlist-notify', 'index.ts');

describe('wishlist-notify Edge Function', () => {
    it('invokes the wishlist notification RPC with a service-role client', () => {
        const source = fs.readFileSync(functionPath, 'utf8');

        expect(source).toContain('wishlist-notify');
        expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY');
        expect(source).toContain('WISHLIST_NOTIFY_CRON_SECRET');
        expect(source).toContain('Wishlist notify cron secret is not configured');
        expect(source).toContain('notify_wishlist_matches');
        expect(source).toContain('listingId');
    });
});
