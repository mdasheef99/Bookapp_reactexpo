import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationName = '20260809000033_marketplace_phase9_vision_reservation_correction.sql';
const migrationPath = path.join(root, 'supabase', 'migrations', migrationName);

describe('Phase 9 vision reservation forward correction', () => {
  it('exists as M33 without editing applied migration history', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('creates a private idempotent reservation helper and calls it before media resolution', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/CREATE FUNCTION marketplace_sec\.phase9_ensure_vision_usage_reservation/i);
    expect(sql).toMatch(/ON CONFLICT\s*\(store_id,job_id,cost_kind,policy_version\)\s*DO NOTHING/i);
    expect(sql).toMatch(/idempotency_identity[^;]+v_job\.dedupe_key/is);
    expect(sql).toMatch(/PERFORM marketplace_sec\.phase9_ensure_vision_usage_reservation\(v_vision\)[\s\S]+status='resolved'/i);
    expect(sql).toMatch(/v_session\.status IS DISTINCT FROM 'active'/i);
    expect(sql).toMatch(/v_media\.uploaded_by IS DISTINCT FROM v_session\.created_by/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION marketplace_sec\.phase9_ensure_vision_usage_reservation\(uuid\)[\s\S]+PUBLIC,anon,authenticated/i);
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION marketplace_sec\.phase9_ensure_vision_usage_reservation\(uuid\) TO (?:anon|authenticated)/i);
  });

  it('repairs only validated nonterminal vision jobs and leaves history untouched', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/j\.status IN \('open','retry_scheduled'\)/i);
    expect(sql).toMatch(/j\.lease_owner IS NULL/i);
    expect(sql).toMatch(/i\.state IN \('queued','processing'\)/i);
    expect(sql).toMatch(/m\.privacy_class='private_scan'/i);
    expect(sql).toMatch(/m\.detected_mime='image\/webp'/i);
    expect(sql).toMatch(/m\.validated_at IS NOT NULL/i);
    expect(sql).toMatch(/s\.status='active'/i);
    expect(sql).toMatch(/m\.uploaded_by=s\.created_by/i);
    expect(sql).not.toMatch(/j\.status IN \([^)]*resolved/i);
    expect(sql).not.toMatch(/8bf664bb-5afa-41f7-ad2c-d86d9b2de2e8/i);
  });
});
