import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260628000002_marketplace_phase2c_review_metadata.sql',
);

describe('marketplace Phase 2C review metadata migration', () => {
    it('adds review reason and follow-up fields used by platform review', () => {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        expect(sql).toContain('ALTER TABLE public.store_verification_requests');
        expect(sql).toContain('ADD COLUMN IF NOT EXISTS rejection_reason TEXT');
        expect(sql).toContain("ADD COLUMN IF NOT EXISTS required_follow_up JSONB NOT NULL DEFAULT '{}'::jsonb");
        expect(sql).toContain('ALTER TABLE public.stores');
        expect(sql).toContain('ADD COLUMN IF NOT EXISTS restriction_reason TEXT');
    });
});
