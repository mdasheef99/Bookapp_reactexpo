import fs from 'fs';
import path from 'path';

const migrationName = '20260830000056_marketplace_phase9_metadata_throughput.sql';
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationName);
const sql = () => fs.readFileSync(migrationPath, 'utf8');

describe('Phase 9 bounded metadata throughput migration', () => {
  it('is a new forward migration after immutable M55', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(migrationName).toMatch(/^20260830000056_/u);
  });

  it('changes only the metadata wake budget and preserves every live stage', () => {
    const source = sql();
    expect(source).toContain('CREATE OR REPLACE FUNCTION marketplace_sec.dispatch_phase9_worker_wakes()');
    expect(source).toContain("('media_validate_sanitize','phase9_media_worker_url'");
    expect(source).toContain("('vision_extract','phase9_vision_worker_url'");
    expect(source).toContain("('metadata_enrich','phase9_metadata_worker_url'");
    expect(source).toContain("('publication_retry','phase9_publication_worker_url'");
    expect(source).toContain("CASE WHEN v_kind='metadata_enrich' THEN 15 ELSE 1 END");
    expect(source).toContain('timeout_milliseconds:=120000');
    expect(source).not.toMatch(/CREATE OR REPLACE FUNCTION marketplace_sec\.claim_phase9_/u);
    expect(source).not.toMatch(/(?:INSERT|UPDATE|DELETE)\s+(?:FROM\s+|INTO\s+)?public\.image_extraction_jobs/iu);
  });

  it('retains the private security and one-wake-per-stage boundary', () => {
    const source = sql();
    expect(source).toContain("SECURITY DEFINER SET search_path=''");
    expect(source).toContain('ON CONFLICT(tick_started_at,job_kind) DO NOTHING');
    expect(source).toMatch(/REVOKE ALL ON FUNCTION marketplace_sec\.dispatch_phase9_worker_wakes\(\)\s+FROM PUBLIC,anon,authenticated,service_role/u);
    expect(source).not.toContain('cron.schedule(');
  });
});
