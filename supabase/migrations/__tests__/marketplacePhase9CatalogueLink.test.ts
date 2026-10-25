// 02a §§4/7/9.2/10/11: forward M81 guard. M52's existing guard stays untouched.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const directory = path.join(process.cwd(), 'supabase', 'migrations');
// §11 specifies 14 TOTAL digits: YYYYMMDD + 000081 (not 14 + 6).
const pattern = /^\d{8}000081_marketplace_phase9_catalogue_link_at_add\.sql$/u;
const names = () => fs.readdirSync(directory).filter(name => pattern.test(name));
const source = () => {
  const files = names();
  // Missing M81 yields ASSERTION failures below, never an ENOENT harness crash.
  return files.length === 1 ? fs.readFileSync(path.join(directory, files[0]), 'utf8').replace(/\r\n/gu, '\n') : '';
};
const uncomment = (sql: string) => sql.replace(/--[^\n]*/gu, '').replace(/\/\*[\s\S]*?\*\//gu, '');

// Computed 2026-10-25 using node:crypto createHash('sha256') over each CURRENT
// file's UTF-8 text, after .replace(/\r\n/g, '\n'); no migration was modified.
// Allow-list is hard-coded, NOT calculated from expected fixtures at test time.
const immutable = {
  '20261008000069_marketplace_phase9_edition_picker_commit_cleanup.sql': ['008f9ebb8cdf3288053b10ffcf2a50db36d96807a0b42787d89339eae79e0cde'],
  '20261008000070_marketplace_phase9_edition_picker_confirmation.sql': ['cbc63a03bf92a7609b4997b80c7ca3bb36c70d0568613d4d56ca76ede230af3c'],
  '20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql': ['b6fc038d2b245cca1ebd9034e37889e87e245e1d4c3154e94960214fb0d1744b'],
  '20261023000079_marketplace_phase9_isbn_match_metadata_state.sql': ['6513b5614292c0a90d867650c1b3302be8fe85ced865f86e643adf1ba9b81188'],
  '20261023000080_marketplace_phase9_manual_card_and_current_match_state.sql': ['e4534f5adf6c559703440e0e006e21dd3b39a21ed809484ce3c38cdcc653e519'],
};

describe('02a slice 6 catalogue-link forward migration', () => {
  // AC6-15 expected RED: M81/helper absent, checked before any ACL assertion.
  it('AC6-15: exactly one correctly named M81 exists', () => {
    expect(names()).toHaveLength(1);
    expect(names()[0]).toMatch(pattern);
  });

  // AC6-15 expected RED: no private three-UUID SECURITY DEFINER helper.
  it('AC6-15: defines the exact private helper contract and pinned search path', () => {
    const sql = uncomment(source());
    const definition = sql.match(/CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+marketplace_sec\.phase9_catalogue_link_for_add_v1\s*\(([^)]*)\)([\s\S]*?)\bAS\s+\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/iu);
    expect(definition).not.toBeNull();
    expect(definition?.[1].split(',').map(argument => argument.trim().split(/\s+/u).pop()?.toLowerCase())).toEqual(['uuid', 'uuid', 'uuid']);
    expect(definition?.[2]).toMatch(/RETURNS\s+TABLE\s*\(\s*canonical_work_id\s+uuid\s*,\s*canonical_edition_id\s+uuid\s*\)/iu);
    expect(definition?.[2]).toMatch(/\bSECURITY\s+DEFINER\b/iu);
    expect(definition?.[2]).toMatch(/\bVOLATILE\b/iu);
    expect(definition?.[2]).toMatch(/SET\s+search_path\s*=\s*''/iu);
    expect(sql).toMatch(/ALTER\s+FUNCTION\s+marketplace_sec\.phase9_catalogue_link_for_add_v1\s*\(\s*uuid\s*,\s*uuid\s*,\s*uuid\s*\)\s+OWNER\s+TO\s+postgres/iu);
  });

  // AC6-15 expected RED: explicit four-role revocation absent; runtime checks in DB/PG.
  it.each(['PUBLIC', 'anon', 'authenticated', 'service_role'])('AC6-15: explicitly revokes helper execution from %s', (role) => {
    const statements = uncomment(source()).split(';');
    const revokes = statements.filter(statement => /REVOKE\s+ALL(?:\s+PRIVILEGES)?\s+ON\s+FUNCTION\s+marketplace_sec\.phase9_catalogue_link_for_add_v1\s*\(\s*uuid\s*,\s*uuid\s*,\s*uuid\s*\)\s+FROM\s+/iu.test(statement));
    expect(revokes.some(statement => new RegExp(`\\b${role}\\b`, 'iu').test(statement.split(/\bFROM\b/iu).pop() ?? ''))).toBe(true);
    expect(uncomment(source())).not.toMatch(/GRANT\s+(?:ALL|EXECUTE)[\s\S]*?ON\s+FUNCTION\s+marketplace_sec\.phase9_catalogue_link_for_add_v1/iu);
  });

  // AC6-24 expected RED: broad client canonical grants not revoked before M81.
  it.each(['canonical_works', 'canonical_editions'])('AC6-24: revokes all seven canonical non-SELECT privileges on %s from both client roles', (table) => {
    const statements = uncomment(source()).split(';').filter(statement => /\bREVOKE\b/iu.test(statement));
    for (const role of ['anon', 'authenticated']) for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) {
      expect(statements.some(statement => {
        const match = statement.match(/\bREVOKE\s+([\s\S]*?)\s+ON\s+(?:TABLE\s+)?([\s\S]*?)\s+FROM\s+([\s\S]*)$/iu);
        return match && new RegExp(`\\b${privilege}\\b`, 'iu').test(match[1])
          && new RegExp(`public\\.${table}\\b`, 'iu').test(match[2])
          && new RegExp(`\\b${role}\\b`, 'iu').test(match[3]);
      })).toBe(true);
    }
    expect(uncomment(source())).not.toMatch(/REVOKE\s+(?:ALL|SELECT)\s+ON\s+(?:TABLE\s+)?public\.canonical_/iu);
    const canonicalRevokes = statements.filter(statement => /\bON\s+(?:TABLE\s+)?public\.canonical_(?:works|editions)\b/iu.test(statement));
    expect(canonicalRevokes.every(statement => !/\b(?:PUBLIC|postgres|service_role)\b/iu.test(statement.split(/\bFROM\b/iu).pop() ?? ''))).toBe(true);
    expect(uncomment(source())).not.toMatch(/ALTER\s+DEFAULT\s+PRIVILEGES|(?:CREATE|ALTER|DROP)\s+POLICY/iu);
  });

  // AC6-1 expected RED: Add has no helper call; no new schema objects are permitted.
  it('AC6-1: replaces Add in a forward transaction without adding tables, columns or indexes', () => {
    const sql = uncomment(source());
    expect(sql).toMatch(/\bBEGIN\s*;/iu); expect(sql).toMatch(/\bCOMMIT\s*;/iu);
    expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.phase9_add_candidate_to_inventory_v1\s*\(/iu);
    expect(sql.match(/phase9_catalogue_link_for_add_v1\s*\(/giu)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(sql).not.toMatch(/CREATE\s+(?:(?:UNLOGGED|TEMP(?:ORARY)?|UNIQUE)\s+)?(?:TABLE|INDEX)\b|ALTER\s+TABLE\b/iu);
  });

  // AC6-15 immutable-file regression already green; preceding M81 positives RED.
  it.each(Object.entries(immutable))('AC6-15: preserves LF-normalized SHA-256 of %s', (file, allowList) => {
    const text = fs.readFileSync(path.join(directory, file), 'utf8').replace(/\r\n/gu, '\n');
    expect(allowList).toContain(createHash('sha256').update(text, 'utf8').digest('hex'));
  });
});
