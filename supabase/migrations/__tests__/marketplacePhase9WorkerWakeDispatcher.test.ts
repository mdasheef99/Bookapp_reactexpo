import fs from 'fs';
import path from 'path';

const migrationName = '20260810000036_marketplace_phase9_worker_wake_dispatcher.sql';
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationName);
const sql = () => fs.readFileSync(migrationPath, 'utf8');

describe('Phase 9 automatic worker wake dispatcher contract', () => {
  it('is one forward migration after M35', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(migrationName).toMatch(/^20260810000036_/u);
  });

  it('keeps the claimability helper read-only and exactly aligned to live claim eligibility', () => {
    const source = sql();
    const helper = source.match(
      /CREATE (?:OR REPLACE )?FUNCTION marketplace_sec\.has_claimable_phase9_work\([\s\S]*?\$\$;/u,
    )?.[0] ?? '';
    expect(helper).toContain("status IN ('open','retry_scheduled','in_progress')");
    expect(helper).toContain('next_attempt_at<=transaction_timestamp()');
    expect(helper).toContain("status<>'in_progress' OR j.lease_expires_at<=transaction_timestamp()");
    expect(helper).toContain('attempt_count<j.max_attempts');
    expect(helper).not.toMatch(/FOR UPDATE|SKIP LOCKED|INSERT|UPDATE|DELETE|attempt_count\s*=|lease_owner\s*=/iu);
    expect(source).not.toMatch(/CREATE OR REPLACE FUNCTION marketplace_sec\.claim_phase9_(?:media_validation|vision|metadata)_jobs/iu);
  });

  it('uses only fixed stage configuration and an explicit 120-second pg_net timeout', () => {
    const source = sql();
    expect(source).toContain('net.http_post');
    expect(source).toContain('timeout_milliseconds := 120000');
    expect(source).toContain("'contractVersion','phase9-v1','batchSize',1");
    expect(source).toContain("'Authorization','Bearer '||v_token");
    expect(source).toContain("'x-phase9-dispatch-id',v_dispatch_id::text");
    for (const name of [
      'phase9_media_worker_url', 'phase9_media_worker_ingress_token',
      'phase9_vision_worker_url', 'phase9_vision_worker_ingress_token',
      'phase9_metadata_worker_url', 'phase9_metadata_worker_ingress_token',
    ]) expect(source).toContain(name);
    expect(source).not.toMatch(/GEMINI|GOOGLE_BOOKS|SERVICE_ROLE_KEY/iu);
  });

  it('fences one wake per stage/tick and never mutates Phase 9 job state', () => {
    const source = sql();
    expect(source).toContain('UNIQUE(tick_started_at,job_kind)');
    expect(source).toContain('ON CONFLICT (tick_started_at,job_kind) DO NOTHING');
    const dispatcher = source.match(
      /CREATE (?:OR REPLACE )?FUNCTION marketplace_sec\.dispatch_phase9_worker_wakes\(\)[\s\S]*?\$\$;/u,
    )?.[0] ?? '';
    expect(dispatcher).not.toMatch(/(?:INSERT|UPDATE|DELETE)\s+(?:FROM\s+|INTO\s+)?public\.image_extraction_jobs/iu);
    expect(dispatcher).not.toMatch(/FOR UPDATE|SKIP LOCKED/iu);
  });

  it('keeps observability bounded and excludes URLs, credentials, payloads, and content', () => {
    const source = sql();
    const table = source.match(
      /CREATE TABLE marketplace_sec\.phase9_worker_wake_dispatches[\s\S]*?\);/u,
    )?.[0] ?? '';
    expect(table).toMatch(/dispatch_id uuid[\s\S]*request_id bigint[\s\S]*http_status integer/u);
    expect(table).not.toMatch(/url|token|secret|header|body|content|payload|error_msg/iu);
    expect(source).toContain("created_at<transaction_timestamp()-interval '7 days'");
  });

  it('is postgres-private with fixed search paths and creates one inactive minute cron', () => {
    const source = sql();
    expect(source.match(/SET search_path=''/gu)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toMatch(/REVOKE ALL ON FUNCTION marketplace_sec\.has_claimable_phase9_work\(text\)\s+FROM PUBLIC,anon,authenticated,service_role/u);
    expect(source).toMatch(/REVOKE ALL ON FUNCTION marketplace_sec\.dispatch_phase9_worker_wakes\(\)\s+FROM PUBLIC,anon,authenticated,service_role/u);
    expect(source).toContain("'phase9-worker-wake-dispatcher'");
    expect(source).toContain("'* * * * *'");
    expect(source).toContain('cron.alter_job(v_cron_job_id,active=>false)');
    expect(source).not.toMatch(/GRANT EXECUTE[\s\S]*TO (?:PUBLIC|anon|authenticated|service_role)/iu);
  });
});
