import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'supabase', 'migrations',
  '20260814000044_marketplace_phase9_store_view_filter_contract.sql');
const sql = fs.readFileSync(file, 'utf8');

describe('Phase 9 Unit 7C WU2A Store View filter correction', () => {
  it('adds one versioned filtered page RPC without replacing M43 contracts', () => {
    expect(sql).toContain('CREATE FUNCTION public.phase9_store_view_page_v2(');
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.phase9_store_view_page_v1');
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.phase9_store_view_detail_v1');
    expect(sql).not.toContain('OFFSET');
  });

  it('reuses authoritative composition and filters before keyset pagination', () => {
    const composed = sql.indexOf('WITH composed AS MATERIALIZED');
    const filtered = sql.indexOf('filtered AS MATERIALIZED');
    const candidates = sql.indexOf('candidates AS');
    const limit = sql.indexOf('LIMIT p_page_size+1');
    expect(sql).toContain('marketplace_sec.phase9_store_view_item_v1(i,false)');
    expect(sql).toContain("c.item#>>'{lifecycle,effectiveState}'=v_filter");
    expect(composed).toBeGreaterThanOrEqual(0);
    expect(filtered).toBeGreaterThan(composed);
    expect(candidates).toBeGreaterThan(filtered);
    expect(limit).toBeGreaterThan(candidates);
  });

  it('uses the attention bucket for needs_attention while preserving effective states', () => {
    expect(sql).toContain("v_filter='needs_attention'");
    expect(sql).toContain("c.item#>>'{attention,attentionState}'='action_required'");
    expect(sql).toContain("v_filter<>'needs_attention'");
    expect(sql).toContain("c.item#>>'{lifecycle,effectiveState}'=v_filter");
  });

  it('binds the opaque cursor to contract version filter actor and store', () => {
    expect(sql).toContain("v_parts[1]<>'phase9-store-view-v2'");
    expect(sql).toContain('v_parts[2]<>v_filter');
    expect(sql).toContain('v_parts[3]<>auth.uid()::text');
    expect(sql).toContain('v_parts[4]<>v_store::text');
    expect(sql).toContain("RAISE EXCEPTION 'P9_CURSOR_INVALID'");
    expect(sql).toContain("ORDER BY (f.i).updated_at DESC,(f.i).id DESC");
  });

  it('keeps the public RPC authenticated-only and private scope server-derived', () => {
    expect(sql).toContain('v_store:=marketplace_sec.phase9_owner_store(NULL)');
    expect(sql).toContain('SECURITY DEFINER SET search_path=\'\'');
    expect(sql).toContain('FROM PUBLIC,anon,authenticated,service_role');
    expect(sql).toContain('TO authenticated;');
    expect(sql).not.toMatch(/p_store(?:_id)?/iu);
  });
});
