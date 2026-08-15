import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'supabase', 'migrations',
  '20260815000045_marketplace_phase9_unit7c_media_history.sql');
const sql = fs.readFileSync(file, 'utf8');

function section(start: string, end: string) {
  const from = sql.indexOf(start);
  const to = sql.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return sql.slice(from, to);
}

describe('Phase 9 Unit 7C WU4 forward migration', () => {
  it('adds only the controlled media read reorder remove replace and history surfaces', () => {
    for (const name of [
      'phase9_store_view_media_v1',
      'phase9_reorder_store_view_media_v1',
      'phase9_remove_store_view_media_v1',
      'phase9_replace_store_view_media_v1',
      'phase9_store_view_history_v1',
      'phase9_owner_media_records_v1',
    ]) expect(sql).toContain(name);
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.sync_marketplace_listing_from_inventory()');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION marketplace_sec.phase9_refresh_listing_for_media_change()');
    expect(sql).not.toContain('phase9_set_publication_state_v3');
  });

  it('keeps media commands off the projection and reuses the existing Unit 7B pipeline', () => {
    const reorder = section('CREATE FUNCTION public.phase9_reorder_store_view_media_v1(',
      'CREATE FUNCTION public.phase9_remove_store_view_media_v1(');
    const remove = section('CREATE FUNCTION public.phase9_remove_store_view_media_v1(',
      'CREATE FUNCTION public.phase9_replace_store_view_media_v1(');
    const replace = section('CREATE FUNCTION public.phase9_replace_store_view_media_v1(',
      '-- Read-only bounded owner history:');
    for (const body of [reorder, remove, replace]) {
      expect(body).not.toContain('INSERT INTO public.marketplace_book_listings');
      expect(body).not.toContain('UPDATE public.marketplace_book_listings');
      expect(body).not.toContain('INSERT INTO public.media_assets');
    }
    expect(sql).toContain('phase9_upload_capabilities');
    expect(sql).toContain("set_config('phase9.media_atomic_swap','on',true)");
    expect(sql).toContain('phase9_authorize_store_view_media_upload_v1');
    expect(sql).toContain('target_media_link_id');
    expect(sql).toContain('operation_kind');
  });

  it('preserves the Unit 7B damage and primary safety gates inside the media commands', () => {
    const remove = section('CREATE FUNCTION public.phase9_remove_store_view_media_v1(',
      'CREATE FUNCTION public.phase9_replace_store_view_media_v1(');
    expect(remove).toContain("'P9_MEDIA_CHANGE_UNSAFE'");
    expect(remove).toContain('has_damage');
    expect(remove).toContain("role='primary_fallback'");
    expect(remove).toContain('phase9_public_media_eligible');
    expect(sql).not.toContain('CREATE FUNCTION marketplace_sec.phase9_publication_ineligibility');
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION marketplace_sec.phase9_publication_ineligibility');
  });

  it('never exposes raw staging paths or private media in the owner read', () => {
    const read = section('CREATE FUNCTION marketplace_sec.phase9_owner_media_records_v1(',
      'CREATE FUNCTION public.phase9_store_view_media_v1(');
    expect(read).toContain("'inventory-photos'");
    expect(read).not.toContain('marketplace-media-staging');
    expect(read).not.toContain("'private_scan'");
    expect(read).not.toContain('createSignedUploadUrl');
    expect(read).toContain('phase9_public_media_eligible');
    expect(read).toContain("'upload_pending'");
  });

  it('uses deterministic ordering and the existing media-change projection refresh', () => {
    const projection = section(
      'CREATE OR REPLACE FUNCTION public.sync_marketplace_listing_from_inventory()',
      'CREATE OR REPLACE FUNCTION marketplace_sec.phase9_refresh_listing_for_media_change()',
    );
    expect(projection).toContain('array_agg(a.id ORDER BY l.public_order,l.created_at)');
    expect(projection).toContain('array_agg(a.object_path ORDER BY l.public_order,l.created_at)');
    const refresh = section(
      'CREATE OR REPLACE FUNCTION marketplace_sec.phase9_refresh_listing_for_media_change()',
      '-- Owner-safe media records:',
    );
    expect(refresh).toContain('phase9.media_atomic_swap');
    expect(refresh).toContain("visibility_status='blocked'");
    expect(refresh).toContain('SET cover_url=cover_url');
    expect(refresh).toContain("v_reason<>'stock'");
  });

  it('uses one version increment, one audit/event pair, hashed replay fingerprints, and media_change revisions per command', () => {
    for (const operation of ['U7CC03', 'U7CC04', 'U7CC05']) expect(sql).toContain(operation);
    expect(sql.match(/version=version\+1/gu)).toHaveLength(3);
    expect(sql.match(/INSERT INTO public\.marketplace_audit_logs/gu)).toHaveLength(3);
    expect(sql.match(/INSERT INTO public\.marketplace_events/gu)).toHaveLength(3);
    expect(sql.match(/'media_change',p_command_id,false/gu)).toHaveLength(3);
    expect(sql).toContain("extensions.digest(concat_ws('|',auth.uid(),p_command_id");
  });

  it('keeps the revision history append-only and the activity read bounded', () => {
    const history = section('-- Read-only bounded owner history:',
      'ALTER FUNCTION public.sync_marketplace_listing_from_inventory() OWNER TO postgres;');
    expect(history).not.toContain('UPDATE public.phase9_publication_revisions');
    expect(history).not.toContain('DELETE FROM public.phase9_publication_revisions');
    expect(history).not.toContain('DELETE FROM public.marketplace_audit_logs');
    expect(history).not.toContain('UPDATE public.marketplace_audit_logs');
    expect(history).toContain('LIMIT 50');
    expect(history).toContain('entry_kind');
    expect(history).toContain('jsonb_strip_nulls');
    expect(history).not.toContain("coalesce(a.details,'{}'::jsonb)");
    expect(history).not.toContain("coalesce(e.payload,'{}'::jsonb)");
    expect(history).toContain('LIMIT 25');
    expect(history).toContain("'publicSnapshot'");
    expect(history).not.toContain('object_path');
  });

  it('applies the standard ACL surface to owner commands and internal helpers', () => {
    expect(sql).toContain('TO authenticated,service_role;');
    expect(sql).toContain('FROM PUBLIC,anon,authenticated,service_role;');
  });
});
