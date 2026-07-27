import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrations = path.join(root, 'supabase', 'migrations');
const migrationName = '20260727000013_marketplace_phase9_service_rpc_wrappers.sql';
const migrationPath = path.join(migrations, migrationName);

const wrappers = {
  phase9_issue_scan_upload: {
    args: 'p_actor uuid,p_session_id uuid,p_source_kind text,p_declared_mime text,p_declared_bytes bigint,p_ordinal integer,p_idempotency_key text,p_command_id uuid',
    result: 'jsonb',
  },
  phase9_scan_upload_context: {
    args: 'p_actor uuid,p_capability_id uuid',
    result: 'jsonb',
  },
  phase9_register_scan_upload_completion: {
    args: 'p_actor uuid,p_capability_id uuid,p_source_kind text,p_bucket text,p_path text,p_object_identity text,p_source_sha256 text,p_observed_mime text,p_observed_bytes bigint,p_orchestration_version text,p_idempotency_key text,p_command_id uuid',
    result: 'jsonb',
  },
  claim_phase9_media_validation_jobs: {
    args: 'p_batch_size integer,p_worker text',
    result: 'TABLE(id uuid,attempt_count integer,lease_token text)',
  },
  phase9_media_validation_context: {
    args: 'p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer',
    result: 'jsonb',
  },
  phase9_revalidate_media_validation_lease: {
    args: 'p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_source_identity text,p_source_sha256 text',
    result: 'boolean',
  },
  phase9_bind_media_validation_snapshot: {
    args: 'p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_snapshot_path text,p_snapshot_sha256 text,p_snapshot_bytes bigint,p_snapshot_mime text',
    result: 'boolean',
  },
  phase9_complete_media_validation: {
    args: 'p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_source_identity text,p_source_sha256 text,p_snapshot_path text,p_target_path text,p_sha256 text,p_bytes bigint,p_width integer,p_height integer',
    result: 'jsonb',
  },
  phase9_fail_media_validation: {
    args: 'p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_retryable boolean,p_safe_error_code text',
    result: 'text',
  },
  claim_phase9_vision_jobs: {
    args: 'p_batch_size integer,p_worker text',
    result: 'TABLE(id uuid,attempt_count integer,lease_token text)',
  },
  phase9_vision_job_context: {
    args: 'p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer',
    result: 'jsonb',
  },
  phase9_persist_vision_analysis: {
    args: 'p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_result jsonb',
    result: 'jsonb',
  },
  phase9_fail_vision_job: {
    args: 'p_job_id uuid,p_worker text,p_lease_token text,p_attempt_count integer,p_safe_error_code text',
    result: 'text',
  },
} as const;

type WrapperName = keyof typeof wrappers;

const compact = (value: string) => value.replace(/\s+/gu, '').replace(/;/gu, '').toLowerCase();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

function runtimeRpcNames(): string[] {
  const files = [
    'supabase/functions/_shared/imageInventory/runtime/ownerIngestion.ts',
    'supabase/functions/_shared/imageInventory/runtime/mediaValidationWorker.ts',
    'supabase/functions/_shared/imageInventory/runtime/visionAnalysisWorker.ts',
  ];
  const source = files.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  const direct = [...source.matchAll(/[A-Za-z]*[Cc]lient\.rpc\(\s*['"]((?:phase9_|claim_phase9_)[a-z0-9_]+)['"]/gu)];
  const bounded = [...source.matchAll(/rpcCall\(\s*client\s*,\s*['"]((?:phase9_|claim_phase9_)[a-z0-9_]+)['"]/gu)];
  return [...direct, ...bounded]
    .map((match) => match[1])
    .filter((name) => name !== 'phase9_start_session')
    .sort();
}

function wrapperBlock(sql: string, name: WrapperName): string {
  const next = Object.keys(wrappers)
    .filter((candidate) => candidate !== name)
    .map((candidate) => `CREATE FUNCTION public\\.${escape(candidate)}\\(`)
    .join('|');
  const match = sql.match(new RegExp(
    `CREATE FUNCTION public\\.${escape(name)}\\([\\s\\S]+?(?=${next}|COMMIT;)`,
    'i',
  ));
  if (!match) throw new Error(`missing wrapper ${name}`);
  return match[0];
}

describe('Phase 9 M13 service-only PostgREST RPC wrappers', () => {
  it('adds one forward M13 migration and keeps M09 absent', () => {
    const names = fs.readdirSync(migrations);
    expect(names).toContain(migrationName);
    expect(names.some((name) => /^20260722000009_/u.test(name))).toBe(false);
  });

  it('wraps exactly the private RPCs used by Owner, media, vision, and the operator path', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const expected = Object.keys(wrappers).sort();
    expect(runtimeRpcNames()).toEqual(expected);
    const created = [...sql.matchAll(/CREATE FUNCTION public\.([a-z0-9_]+)\(/giu)]
      .map((match) => match[1])
      .sort();
    expect(created).toEqual(expected);
  });

  it.each(Object.entries(wrappers))(
    '%s preserves the exact signature and delegates only to its authoritative function',
    (name, contract) => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const block = wrapperBlock(sql, name as WrapperName);
      const signature = block.match(/CREATE FUNCTION public\.[a-z0-9_]+\(([\s\S]*?)\)\s*RETURNS/iu);
      const result = block.match(/\bRETURNS\s+([\s\S]*?)\s+LANGUAGE sql/iu);
      const body = block.match(/\bAS \$wrapper\$\s*([\s\S]*?)\s*\$wrapper\$/iu);
      expect(compact(signature?.[1] ?? '')).toBe(compact(contract.args));
      expect(compact(result?.[1] ?? '')).toBe(compact(contract.result));
      expect(compact(body?.[1] ?? '')).toBe(
        compact(`SELECT * FROM marketplace_sec.${name}(${contract.args
          .split(',')
          .map((argument) => argument.trim().split(/\s+/u)[0])
          .join(',')})`),
      );
    },
  );

  it.each(Object.entries(wrappers))(
    '%s is postgres-owned, pinned, invoker-only, and executable only by service_role',
    (name, contract) => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const block = wrapperBlock(sql, name as WrapperName);
      const identity = contract.args
        .split(',')
        .map((argument) => argument.trim().split(/\s+/u).slice(1).join(' '))
        .join(',');
      expect(block).toMatch(/LANGUAGE sql\s+SECURITY INVOKER\s+SET search_path=''/iu);
      expect(compact(block)).toContain(compact(
        `ALTER FUNCTION public.${name}(${identity}) OWNER TO postgres`,
      ));
      expect(compact(block)).toContain(compact(
        `REVOKE ALL ON FUNCTION public.${name}(${identity}) FROM PUBLIC,anon,authenticated`,
      ));
      expect(compact(block)).toContain(compact(
        `GRANT EXECUTE ON FUNCTION public.${name}(${identity}) TO service_role`,
      ));
      expect(block).not.toMatch(/SECURITY DEFINER/iu);
    },
  );

  it('is transactional, additive, and contains no schema exposure, dynamic SQL, table DML, or Storage mutation', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/\bBEGIN;[\s\S]+COMMIT;\s*$/u);
    expect(sql).not.toMatch(/\bEXECUTE\b\s+(?:format|\w+\s+USING)/iu);
    expect(sql).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|TRUNCATE)\b/iu);
    expect(sql).not.toMatch(/\bstorage\.(?:objects|buckets)\b/iu);
    expect(sql).not.toMatch(/\b(?:pgrst\.db_schemas|db\.schemas|ALTER ROLE .*pgrst)\b/iu);
    expect(sql).not.toMatch(/\b(?:GRANT|REVOKE)\b[\s\S]*\bON TABLE\b/iu);
  });
});
