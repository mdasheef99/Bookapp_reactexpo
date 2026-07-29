import fs from 'fs';
import path from 'path';

const migration =
  '20260729000018_marketplace_phase9_search_variant_proposals.sql';
const file = path.join(process.cwd(), 'supabase', 'migrations', migration);
const postgres17Gate = path.join(
  process.cwd(), 'scripts', 'verify-phase9-m18-postgres17.ps1',
);
const sql = () => fs.readFileSync(file, 'utf8');

describe('Phase 9 Unit 5C-2 search-variant persistence foundation', () => {
  it('is an additive forward-only M18 and preserves M01 aliases', () => {
    expect(fs.existsSync(file)).toBe(true);
    expect(migration).toMatch(/000018_/);
    expect(sql()).not.toMatch(
      /DROP\s+(?:TABLE|COLUMN)|ALTER\s+TABLE\s+public\.book_search_aliases/i,
    );
  });

  it('uses a separate private proposal relation with complete source and provenance', () => {
    const text = sql();
    [
      'phase9_search_variant_proposals',
      'analysis_result_id',
      'vision_job_id',
      'candidate_id',
      'observation_id',
      'source_field',
      'source_text',
      'source_language',
      'source_script',
      'variant_text',
      'variant_normalized',
      'variant_language',
      'variant_script',
      'variant_type',
      'generation_source',
      'provider_key',
      'model_key',
      'model_version',
      'prompt_version',
      'proposal_schema_version',
      'contract_version',
    ].forEach((name) => expect(text).toContain(name));
  });

  it('models the bounded lifecycle but registers proposed and non-searchable only', () => {
    const text = sql();
    expect(text).toMatch(
      /status\s+text[\s\S]*'proposed'[\s\S]*'active'[\s\S]*'rejected'[\s\S]*'stale'/i,
    );
    expect(text).toMatch(/search_eligible\s+boolean[\s\S]*DEFAULT\s+false/i);
    expect(text).toMatch(/status\s*,?\s*search_eligible[\s\S]*'proposed'\s*,\s*false/i);
    expect(text).not.toMatch(/SET\s+status\s*=\s*'active'/i);
  });

  it('has durable scoped idempotency and does not reset lifecycle on replay', () => {
    const text = sql();
    expect(text).toContain('proposal_identity');
    expect(text).toMatch(
      /ON\s+CONFLICT\s*\(\s*proposal_identity\s*\)\s*DO\s+NOTHING/i,
    );
    expect(text).not.toMatch(
      /ON\s+CONFLICT[\s\S]*DO\s+UPDATE[\s\S]*status\s*=\s*'proposed'/i,
    );
  });

  it('uses the existing claim fence through an atomic combined persistence RPC', () => {
    const text = sql();
    expect(text).toContain('phase9_persist_vision_analysis_with_variants');
    expect(text).toMatch(
      /marketplace_sec\.phase9_persist_vision_analysis\s*\(/i,
    );
    [
      'p_job_id',
      'p_worker',
      'p_lease_token',
      'p_attempt_count',
      'p_result',
      'p_variants',
    ].forEach((name) => expect(text).toContain(name));
    expect(text).toContain("SET search_path=''");
  });

  it('keeps writes RPC-only and exposes only a bounded private read RPC', () => {
    const text = sql();
    expect(text).toContain('phase9_read_search_variant_proposals');
    expect(text).toMatch(
      /REVOKE\s+ALL\s+PRIVILEGES[\s\S]*phase9_search_variant_proposals[\s\S]*FROM[\s\S]*service_role/i,
    );
    expect(text).toMatch(
      /GRANT\s+SELECT[\s\S]*phase9_search_variant_proposals[\s\S]*TO\s+service_role/i,
    );
    expect(text).toMatch(
      /REVOKE\s+ALL[\s\S]*phase9_persist_vision_analysis_with_variants[\s\S]*FROM\s+PUBLIC\s*,?\s*anon\s*,?\s*authenticated/i,
    );
    expect(text).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE|DELETE|TRUNCATE|MAINTAIN|ALL)[\s\S]*phase9_search_variant_proposals[\s\S]*TO\s+service_role/i,
    );
  });

  it('contains no inventory, listing, canonical, search-index, or provider-call mutation', () => {
    const text = sql();
    expect(text).not.toMatch(
      /INSERT\s+INTO\s+public\.(?:store_inventory|marketplace_book_listings|canonical_works|canonical_editions|book_search_aliases)/i,
    );
    expect(text).not.toMatch(/http|net\.|provider_request|storage\./i);
  });

  it('keeps a rollback-only real PostgreSQL 17 ACL verification gate', () => {
    const gate = fs.readFileSync(postgres17Gate, 'utf8');
    expect(gate).toContain("current_setting('server_version_num')");
    expect(gate).toMatch(/has_table_privilege\(\s*'service_role'/);
    expect(gate).toContain("'MAINTAIN'");
    expect(gate).toContain('ROLLBACK;');
    expect(gate).toContain('P9_M18_ROLLBACK_INCOMPLETE');
    expect(gate).toContain('--no-password');
  });
});
