import fs from 'fs';
import path from 'path';

const migrationName = '20260810000038_marketplace_phase9_metadata_retry_correction.sql';
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationName);

describe('Phase 9 metadata retry forward correction', () => {
  it('is one forward migration after applied M37 and leaves M32-M37 immutable', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(migrationName).toMatch(/^20260810000038_/u);
  });

  it('exposes only the selected physical call claim attempt through the existing context RPC', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');
    expect(source).toContain('CREATE FUNCTION marketplace_sec.phase9_metadata_job_context_v2(');
    expect(source).toContain("SET search_path=''");
    expect(source).toContain('pc.claim_attempt_number');
    expect(source).toContain("'currentPhysicalClaimAttempt'");
    expect(source).toContain("'contractVersion','p9-metadata-job-context-v2'");
    expect(source).not.toMatch(/ALTER TABLE|CREATE TABLE|DROP TABLE|job_max_attempts/iu);
  });

  it('preserves the service-only private/public function grant boundary', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');
    expect(source).toContain('OWNER TO postgres');
    expect(source).toMatch(/REVOKE ALL ON FUNCTION marketplace_sec\.phase9_metadata_job_context_v2\(uuid,text,text,integer\)[\s\S]*FROM PUBLIC,anon,authenticated/u);
    expect(source).toMatch(/GRANT EXECUTE ON FUNCTION marketplace_sec\.phase9_metadata_job_context_v2\(uuid,text,text,integer\)[\s\S]*TO service_role/u);
    expect(source).not.toMatch(/TO\s+(?:anon|authenticated)/u);
  });
});
