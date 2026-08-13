import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'supabase', 'migrations',
  '20260813000041_marketplace_phase9_unit7a_quality_handoff.sql');
const sql = fs.readFileSync(file, 'utf8');

describe('Phase 9 Unit 7A quality handoff correction', () => {
  it('derives quality server-side for candidate-created inventory', () => {
    expect(sql).toContain('phase9_inventory_quality_status_v1');
    expect(sql).toContain("NEW.entry_method='image_extraction'");
    expect(sql).toContain('NEW.created_from_candidate_id IS NOT NULL');
    expect(sql).toContain('BEFORE INSERT ON public.store_inventory');
    expect(sql).toContain("THEN RETURN 'missing_metadata'");
    expect(sql).toContain("THEN RETURN 'needs_photo'");
    expect(sql).toContain("RETURN 'ready'");
  });

  it('refreshes the M40 projection trigger when quality changes', () => {
    expect(sql).toMatch(/CREATE TRIGGER phase9_store_inventory_listing_sync[\s\S]*UPDATE OF[\s\S]*listing_quality_status[\s\S]*EXECUTE FUNCTION public\.sync_marketplace_listing_from_inventory/u);
    expect(sql).toContain('phase9_prepare_quality_projection_refresh_v1');
    expect(sql).toContain("NEW.visibility_status:='blocked'");
    expect(sql).toContain("NEW.publication_status:='private'");
  });

  it('limits backfill to deterministically derived Unit 7A rows', () => {
    expect(sql).toMatch(/UPDATE public\.store_inventory i[\s\S]*phase9_inventory_quality_status_v1\(i\)/u);
    expect(sql).toContain("i.entry_method='image_extraction'");
    expect(sql).toContain('i.created_from_candidate_id IS NOT NULL');
    expect(sql).not.toMatch(/SET listing_quality_status\s*=\s*'ready'/u);
  });
});
