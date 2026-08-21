import fs from 'fs';
import path from 'path';

const migrationName = '20260821000052_marketplace_phase9_unit6g_contract_persistence_foundation.sql';
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationName);
const sql = () => fs.readFileSync(migrationPath, 'utf8');

describe('Phase 9 Unit 6G Group 1 M52 structural contract', () => {
  it('is one new forward migration after immutable M51', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(migrationName).toMatch(/^20260821000052_/u);
  });

  it('adds only approved session fields and candidate disposition', () => {
    const source = sql();
    expect(source).toContain('default_price_minor');
    expect(source).toContain('batch_label');
    expect(source).toContain('DROP NOT NULL');
    expect(source).toContain("'owner_removed_from_scan'");
    expect(source).not.toMatch(/ALTER TABLE public\.store_inventory/iu);
    expect(source).not.toMatch(/ALTER TABLE public\.marketplace_book_listings/iu);
    expect(source).not.toMatch(/currency|price_rupees/iu);
  });

  it.each([
    'phase9_start_session_v2',
    'phase9_owner_session_summary_v3',
    'phase9_owner_batch_review_v1',
    'phase9_owner_remove_candidate_v1',
    'phase9_close_session_v3',
  ])('defines secured versioned RPC %s', (name) => {
    const match = sql().match(new RegExp(
      `CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`, 'u',
    ));
    expect(match).not.toBeNull();
    expect(match?.[0]).toContain('SECURITY DEFINER');
    expect(match?.[0]).toContain("SET search_path=''");
  });

  it('preserves legacy v2 Close bytes and M39 behavior', () => {
    const source = sql();
    expect(source).not.toContain('CREATE OR REPLACE FUNCTION public.phase9_close_session_v2');
    expect(source).toContain('phase9_unit6g_nullable_close_fence');
    expect(source).not.toContain('CREATE OR REPLACE FUNCTION public.phase9_add_candidate_to_inventory_v1');
    expect(source).not.toMatch(/UPDATE\s+public\.store_inventory/iu);
  });

  it('contains lifecycle, replay, worker, audit, event and grant fences', () => {
    const source = sql();
    [
      'FOR UPDATE', 'P9_CANDIDATE_VERSION_CONFLICT', 'P9_IDEMPOTENCY_MISMATCH',
      'ownerRemovedCandidates', 'phase9.candidate.owner_removed_from_scan',
      'review_disposition IS DISTINCT FROM', 'presentation_revision',
      'p_command_id IS NULL',
      'REVOKE ALL ON FUNCTION', 'TO authenticated', 'FROM PUBLIC,anon',
    ].forEach((marker) => expect(source).toContain(marker));
    expect(source).not.toMatch(/GRANT\s+(SELECT|INSERT|UPDATE|DELETE).*authenticated/iu);
  });
});
