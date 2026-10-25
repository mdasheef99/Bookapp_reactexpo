// Owner M82 brief (2026-10-26); picker SDD §§5-8/11; slice 6 SDD §§3/10/11.
import fs from 'fs';
import path from 'path';

const directory = path.join(process.cwd(), 'supabase/migrations');
const name = '20261026000082_marketplace_phase9_edition_choice_survives_first_save.sql';
const pattern = /^\d{8}000082_marketplace_phase9_edition_choice_survives_first_save\.sql$/u;
const target = 'marketplace_sec.phase9_edition_identity_change()';
const read = (file: string) => fs.existsSync(path.join(directory, file)) ? fs.readFileSync(path.join(directory, file), 'utf8') : '';
const source = () => read(name);
const sql = () => source().replace(/--[^\n]*/gu, '');
const functionDefinition = (text: string) => text.match(/CREATE OR REPLACE FUNCTION marketplace_sec\.phase9_edition_identity_change\(\)[\s\S]*?END\$\$;/u)?.[0] ?? '';
const rowPairs = () => sql().match(/ROW\(NEW\.observed_title[\s\S]*?IS NOT DISTINCT FROM\s*ROW\(OLD\.observed_title[\s\S]*?OLD\.owner_isbn13\)/gu) ?? [];
const guard = "AND NOT (NEW.review_disposition IN ('owner_removed_from_scan','skipped_false_detection') AND NEW.review_disposition IS DISTINCT FROM OLD.review_disposition)";

describe('M82 first review preserves the controlled edition selection', () => {
  it('has the exact forward migration name, LF text and transaction boundaries', () => {
    expect(fs.readdirSync(directory).filter(file => pattern.test(file))).toEqual([name]);
    expect(source()).not.toContain('\r');
    expect(source().split('BEGIN;')[0]).not.toMatch(/\b(?:PROPOSED|applied)\b/iu);
    expect(sql().trim()).toMatch(/^BEGIN;[\s\S]*COMMIT;$/u);
  });
  it('replaces exactly the target function with the same definer signature', () => {
    expect(sql().match(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/giu)).toHaveLength(1);
    expect(sql()).toContain(`CREATE OR REPLACE FUNCTION ${target}`);
    expect(sql()).toContain("RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$");
  });
  it('contains no trigger DDL, DROP, data writes outside the function or other object changes', () => {
    expect(sql()).not.toMatch(/\bDROP\b|\b(?:CREATE|ALTER)\s+TRIGGER\b/iu);
    const tail = sql().replace(functionDefinition(sql()), '').replace(/\s+/gu, ' ').trim();
    expect(tail).toBe(`BEGIN; ALTER FUNCTION ${target} OWNER TO postgres; REVOKE ALL ON FUNCTION ${target} FROM PUBLIC, anon, authenticated, service_role; COMMIT;`);
  });
  it('restates postgres ownership', () => {
    expect(sql()).toContain(`ALTER FUNCTION ${target} OWNER TO postgres;`);
  });
  it('revokes execution from PUBLIC and all API roles', () => {
    expect(sql()).toContain(`REVOKE ALL ON FUNCTION ${target} FROM PUBLIC, anon, authenticated, service_role;`);
  });
  it('both row comparisons retain observed identity and ISBN only', () => {
    const pairs = rowPairs(); expect(pairs).toHaveLength(2);
    for (const pair of pairs) {
      expect(pair).not.toMatch(/(?:NEW|OLD)\.(?:state|review_disposition)/u);
      expect(pair.match(/(?:NEW|OLD)\.[a-z0-9_]+/gu)).toEqual(['NEW', 'OLD'].flatMap(prefix =>
        ['observed_title', 'observed_authors', 'observed_language', 'observed_isbn_clue', 'observed_publisher_clue', 'owner_isbn13'].map(column => `${prefix}.${column}`)));
    }
  });
  it('guards removal transitions in both exemptions', () => {
    expect(sql().split(guard)).toHaveLength(3);
    expect(sql()).toContain(guard + '),false)');
    expect(sql()).toContain(guard + ' THEN RETURN NEW; END IF;');
  });
  it('is otherwise identical to the M78 function, without refactoring', () => {
    let expected = functionDefinition(read('20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql').replace(/\r\n/gu, '\n'));
    expected = expected.replaceAll('NEW.observed_publisher_clue,NEW.state,NEW.review_disposition,NEW.owner_isbn13', 'NEW.observed_publisher_clue,NEW.owner_isbn13')
      .replaceAll('OLD.observed_publisher_clue,OLD.state,OLD.review_disposition,OLD.owner_isbn13)', 'OLD.observed_publisher_clue,OLD.owner_isbn13)\n  ' + guard);
    expect(functionDefinition(source())).toBe(expected);
  });
});
