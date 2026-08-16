import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'supabase', 'migrations',
  '20260816000046_marketplace_phase9_unit7c_private_save_revision_correction.sql');
const sql = fs.readFileSync(file, 'utf8');

describe('Phase 9 Unit 7C M46 private-save revision correction', () => {
  it('is one forward-only replacement of the existing Save function', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.phase9_update_store_inventory_details_v1(');
    expect(sql).toContain("IF v_public_changed THEN");
    expect(sql).toContain("v_revision:=marketplace_sec.phase9_append_publication_revision_v1(");
    expect(sql).toContain('ELSE\n    v_revision:=NULL;');
    expect(sql).not.toContain('CREATE TABLE');
    expect(sql).not.toContain('DELETE FROM public.phase9_publication_revisions');
    expect(sql).not.toContain('UPDATE public.phase9_publication_revisions');
  });

  it('preserves the Owner function security boundary', () => {
    expect(sql).toContain('ALTER FUNCTION public.phase9_update_store_inventory_details_v1(');
    expect(sql).toContain('OWNER TO postgres');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.phase9_update_store_inventory_details_v1(');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.phase9_update_store_inventory_details_v1(');
    expect(sql).toContain('TO authenticated,service_role');
  });
});
