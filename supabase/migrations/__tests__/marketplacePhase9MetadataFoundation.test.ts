import fs from 'fs';
import path from 'path';

const migration = '20260728000015_marketplace_phase9_metadata_foundation.sql';
const file = path.join(process.cwd(), 'supabase', 'migrations', migration);
const sql = () => fs.readFileSync(file, 'utf8');

describe('Phase 9 Unit 5A metadata persistence foundation', () => {
  it('is a forward-only additive M15 and leaves M09 absent', () => {
    expect(fs.existsSync(file)).toBe(true);
    expect(migration).toMatch(/000015_/);
    expect(sql()).not.toMatch(/000009|DROP TABLE|DROP COLUMN/i);
  });

  it('separates metadata lookup, cache, attempt, and immutable snapshot authority', () => {
    const text = sql();
    [
      'phase9_metadata_lookups',
      'phase9_metadata_cache_entries',
      'phase9_selected_metadata_snapshots',
      'metadata_enrichment_attempts',
      'selected_metadata_snapshot_id',
    ].forEach((name) => expect(text).toContain(name));
    expect(text).not.toContain('ALTER TABLE public.vision_provider_attempts');
    expect(text).toMatch(/phase9_reject_selected_metadata_snapshot_mutation/i);
  });

  it('persists required routing, cache, coalescing, cost, and disposition lineage', () => {
    const text = sql();
    [
      'query_identity', 'lookup_contract_version', 'normalizer_version',
      'provider_role', 'capability_version', 'routing_policy_version',
      'predecessor_outcome', 'usage_reservation_id', 'pricing_policy_version',
      'calculated_cost_units', 'leader_lookup_id', 'privacy_scope',
      'reuse_policy_version', 'cache_policy_version', 'cache_namespace',
      'outcome_source_attempt_id', 'provider_request_id', 'storage_allowed',
      'possibly_duplicate_spend_of_attempt_id',
      'phase9_metadata_attempt_no_raw_provider_payload',
    ].forEach((name) => expect(text).toContain(name));
  });

  it('uses fenced service-only RPCs with invoker wrappers and no dynamic SQL', () => {
    const text = sql();
    [
      'claim_phase9_metadata_jobs',
      'phase9_complete_local_metadata_match',
      'phase9_register_metadata_lookup',
      'phase9_register_metadata_attempt',
      'phase9_finalize_metadata_attempt',
      'phase9_select_metadata_snapshot',
      'phase9_store_metadata_cache',
      'phase9_invalidate_metadata_cache',
    ].forEach((name) => expect(text).toContain(name));
    expect(text).toContain('FOR UPDATE SKIP LOCKED');
    expect(text).toContain('lease_token_hash');
    expect(text).toContain("SECURITY INVOKER");
    expect(text).toContain('FROM PUBLIC,anon,authenticated');
    expect(text).toContain('TO service_role');
    expect(text).not.toMatch(
      /GRANT SELECT,\s*(?:INSERT|UPDATE)[^;]*phase9_metadata_(?:lookups|cache_entries)/i,
    );
    expect(text).not.toMatch(
      /GRANT SELECT,\s*INSERT[^;]*phase9_selected_metadata_snapshots/i,
    );
    expect(text).not.toMatch(/\bEXECUTE\s+(?:format|\$|'|")/i);
  });

  it('does not accept raw payloads or create inventory/publication/alias side effects', () => {
    const text = sql();
    expect(text).not.toMatch(/p_raw_payload|INSERT INTO public\.store_inventory|marketplace_book_listings|book_search_aliases/i);
  });
});
