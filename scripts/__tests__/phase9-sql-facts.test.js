const fs = require('fs');
const path = require('path');

const { parseMigrationTexts, runFacts } = require('../phase9-sql-facts');

const M99 = '20261106000099_marketplace_phase9_8c_fix_round.sql';

function sql(...lines) {
  return lines.join('\n');
}

function identityIn(result, identity) {
  return result.identities.find((entry) => entry.identity === identity);
}

function readRealMigrations() {
  const dir = path.join(process.cwd(), 'supabase', 'migrations');
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, text: fs.readFileSync(path.join(dir, file), 'utf8') }));
}

const realEntries = readRealMigrations();
const real = parseMigrationTexts(realEntries);

describe('parseMigrationTexts synthetic states', () => {
  it('single definition yields one entry with file, line and verbatim header', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: sql(
        'CREATE FUNCTION p.f(p_a uuid, p_b text)',
        'RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $fn$',
        "BEGIN RAISE EXCEPTION 'P9_STATE_CONFLICT'; END",
        '$fn$;',
      ),
    }]);
    const entry = identityIn(result, 'p.f(uuid,text)');
    expect(entry).toBeDefined();
    expect(entry.current.file).toBe('a.sql');
    expect(entry.current.line).toBe(1);
    expect(entry.current.header).toContain('CREATE FUNCTION p.f(p_a uuid, p_b text)');
    expect(entry.current.header).toContain('RETURNS void');
    expect(entry.current.header).toContain('SECURITY INVOKER');
    expect(entry.current.raises).toEqual(['P9_STATE_CONFLICT']);
    expect(entry.earlier).toEqual([]);
    expect(result.counts).toMatchObject({ seen: 1, parsed: 1, unparsed: 0, ignoredComments: 0 });
  });

  it('later file wins and earlier definition is listed by file:line only', () => {
    const result = parseMigrationTexts([
      { file: 'a.sql', text: 'CREATE FUNCTION public.f() RETURNS void AS $$ BEGIN END $$;' },
      { file: 'b.sql', text: 'CREATE FUNCTION public.f() RETURNS void AS $$ BEGIN END $$;' },
    ]);
    const entry = identityIn(result, 'public.f()');
    expect(entry.current.file).toBe('b.sql');
    expect(entry.current.line).toBe(1);
    expect(entry.earlier).toEqual([{ file: 'a.sql', line: 1 }]);
  });

  it('later definition in the same file wins', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: sql(
        'CREATE FUNCTION public.f() RETURNS void AS $$ BEGIN END $$;',
        'CREATE FUNCTION public.f() RETURNS void AS $$ BEGIN END $$;',
      ),
    }]);
    const entry = identityIn(result, 'public.f()');
    expect(entry.current.line).toBe(2);
    expect(entry.earlier).toEqual([{ file: 'a.sql', line: 1 }]);
  });

  it('created then dropped without re-creation is reported DROPPED', () => {
    const result = parseMigrationTexts([
      { file: 'a.sql', text: 'CREATE FUNCTION public.f() RETURNS void AS $$ BEGIN END $$;' },
      { file: 'b.sql', text: 'DROP FUNCTION public.f();' },
    ]);
    const entry = identityIn(result, 'public.f()');
    expect(entry.state).toBe('DROPPED');
    expect(entry.current).toBeNull();
    expect(entry.dropped).toEqual({ file: 'b.sql', line: 1 });
    expect(entry.earlier).toEqual([{ file: 'a.sql', line: 1 }]);
  });

  it('drop then create with different argument types splits the identity', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: sql(
        'CREATE FUNCTION public.f() RETURNS void AS $$ BEGIN END $$;',
        'DROP FUNCTION public.f();',
        'CREATE FUNCTION public.f(p_id uuid) RETURNS void AS $$ BEGIN END $$;',
      ),
    }]);
    const zero = identityIn(result, 'public.f()');
    const one = identityIn(result, 'public.f(uuid)');
    expect(zero.state).toBe('DROPPED');
    expect(zero.dropped).toEqual({ file: 'a.sql', line: 2 });
    expect(one.state).toBe('CURRENT');
    expect(one.current.line).toBe(3);
    expect(one.earlier).toEqual([]);
  });

  it('two live overloads are separate identities', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: sql(
        'CREATE FUNCTION public.f() RETURNS void AS $$ BEGIN END $$;',
        'CREATE FUNCTION public.f(p_id uuid) RETURNS void AS $$ BEGIN END $$;',
      ),
    }]);
    expect(identityIn(result, 'public.f()').state).toBe('CURRENT');
    expect(identityIn(result, 'public.f(uuid)').state).toBe('CURRENT');
  });

  it('plain CREATE is parsed like OR REPLACE', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: 'CREATE FUNCTION public.f() RETURNS void AS $$ BEGIN END $$;',
    }]);
    const entry = identityIn(result, 'public.f()');
    expect(entry.state).toBe('CURRENT');
    expect(result.counts).toMatchObject({ seen: 1, parsed: 1, unparsed: 0 });
  });

  it('case, multi-line header and $fn$ body parse', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: sql(
        'create function public.f(',
        '  p_a uuid,',
        '  p_b text',
        ')',
        'returns void language plpgsql',
        'as $fn$',
        'begin',
        'end',
        '$fn$;',
      ),
    }]);
    const entry = identityIn(result, 'public.f(uuid,text)');
    expect(entry.current.line).toBe(1);
    expect(entry.current.tag).toBe('$fn$');
    expect(result.counts.parsed).toBe(1);
  });

  it('unreadable create is UNPARSED with file:line and exit 0', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: 'CREATE FUNCTION public.f() RETURNS void AS $$ BEGIN',
    }]);
    expect(result.counts).toMatchObject({ seen: 1, parsed: 0, unparsed: 1 });
    expect(result.unparsed).toHaveLength(1);
    expect(result.unparsed[0].file).toBe('a.sql');
    expect(result.unparsed[0].line).toBe(1);
    const run = runFacts({ entries: [{ file: 'a.sql', text: 'CREATE FUNCTION public.f() RETURNS void AS $$ BEGIN' }], queries: [], summary: true });
    expect(run.exitCode).toBe(0);
    expect(run.output).toContain('UNPARSED');
  });

  it('create inside a DO block is UNPARSED with the inner line', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: sql(
        'DO $$',
        'BEGIN',
        '  CREATE FUNCTION public.g() RETURNS void AS $inner$ BEGIN END $inner$;',
        'END',
        '$$;',
      ),
    }]);
    expect(result.counts).toMatchObject({ seen: 1, parsed: 0, unparsed: 1 });
    expect(result.unparsed[0]).toMatchObject({ file: 'a.sql', line: 3 });
    const run = runFacts({ entries: [{ file: 'a.sql', text: sql('DO $$', 'BEGIN', '  CREATE FUNCTION public.g() RETURNS void AS $inner$ BEGIN END $inner$;', 'END', '$$;') }], queries: [], summary: true });
    expect(run.exitCode).toBe(0);
  });

  it('unknown name says so and exits 1', () => {
    const run = runFacts({ entries: [], queries: ['missing'], summary: false });
    expect(run.exitCode).toBe(1);
    expect(run.output).toContain('No function identity matches');
  });

  it('comment match is ignored comment, not statement or UNPARSED', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: '-- CREATE OR REPLACE FUNCTION migrations can leave anon callable\n',
    }]);
    expect(result.counts).toMatchObject({ seen: 0, parsed: 0, unparsed: 0, ignoredComments: 1 });
    expect(result.ignoredComments).toEqual([{ file: 'a.sql', line: 1 }]);
  });

  it('rename is noted, new name gets no entry, old current from later create', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: sql(
        'CREATE FUNCTION public.old() RETURNS void AS $$ BEGIN END $$;',
        'ALTER FUNCTION public.old() RENAME TO new_name;',
        'CREATE FUNCTION public.old() RETURNS void AS $$ BEGIN END $$;',
      ),
    }]);
    const entry = identityIn(result, 'public.old()');
    expect(entry.current.line).toBe(3);
    expect(entry.earlier).toEqual([{ file: 'a.sql', line: 1 }]);
    expect(entry.renames).toEqual([{ file: 'a.sql', line: 2, to: 'new_name' }]);
    expect(identityIn(result, 'public.new_name()')).toBeUndefined();
    expect(result.renamesSeen).toHaveLength(1);
  });

  it('unqualified identity is public', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: 'CREATE FUNCTION f() RETURNS void AS $$ BEGIN END $$;',
    }]);
    expect(identityIn(result, 'public.f()')).toBeDefined();
  });

  it('CRLF input yields identical result and line numbers', () => {
    const lf = sql(
      'CREATE FUNCTION public.f()',
      'RETURNS void AS $$',
      'BEGIN',
      'END',
      '$$;',
    );
    const crlf = lf.replace(/\n/g, '\r\n');
    const lfResult = parseMigrationTexts([{ file: 'x.sql', text: lf }]);
    const crlfResult = parseMigrationTexts([{ file: 'x.sql', text: crlf }]);
    expect(crlfResult).toEqual(lfResult);
    expect(identityIn(crlfResult, 'public.f()').current.line).toBe(1);
  });
});

describe('parseMigrationTexts synthetic edge cases', () => {
  it('RETURNS TABLE bracket is not the argument list', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: sql(
        'CREATE FUNCTION public.f(p_a uuid)',
        'RETURNS TABLE(id uuid, label text)',
        'LANGUAGE sql AS $$',
        "SELECT p_a, 'x'::text",
        '$$;',
      ),
    }]);
    expect(identityIn(result, 'public.f(uuid)')).toBeDefined();
    expect(identityIn(result, 'public.f(uuid,id uuid,label text)')).toBeUndefined();
  });

  it('DEFAULT with brackets and parentheses does not break type derivation', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: sql(
        'CREATE FUNCTION public.f(',
        '  p_tags text[] DEFAULT ARRAY[]::text[],',
        '  p_at timestamptz DEFAULT now()',
        ') RETURNS void AS $$ BEGIN END $$;',
      ),
    }]);
    expect(identityIn(result, 'public.f(text[],timestamptz)')).toBeDefined();
  });

  it('RAISE EXCEPTION USING is dynamic and RAISE in a line comment is skipped', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: sql(
        'CREATE FUNCTION public.f() RETURNS void AS $$',
        'BEGIN',
        "  -- RAISE EXCEPTION 'IGNORED';",
        "  RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='P9_DYNAMIC';",
        'END',
        '$$;',
      ),
    }]);
    const entry = identityIn(result, 'public.f()');
    expect(entry.current.raises).toEqual(['(dynamic) a.sql:4']);
  });

  it('multi-line ALTER FUNCTION RENAME identity parses; SET SCHEMA is not interpreted', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: sql(
        'CREATE FUNCTION public.f(p uuid) RETURNS void AS $$ BEGIN END $$;',
        'ALTER FUNCTION public.f(',
        '  uuid',
        ') SET SCHEMA s;',
        'ALTER FUNCTION s.f(uuid) RENAME TO f_legacy;',
        'CREATE FUNCTION public.f(p uuid) RETURNS void AS $$ BEGIN END $$;',
      ),
    }]);
    const current = identityIn(result, 'public.f(uuid)');
    expect(current.current.line).toBe(6);
    expect(current.earlier).toEqual([{ file: 'a.sql', line: 1 }]);
    expect(current.grants.some((grant) => grant.line === 2 && grant.statement.indexOf('SET SCHEMA') !== -1)).toBe(true);
    const moved = identityIn(result, 's.f(uuid)');
    expect(moved.state).toBe('RENAMED');
    expect(moved.current).toBeNull();
    expect(moved.renames).toEqual([{ file: 'a.sql', line: 5, to: 'f_legacy' }]);
    expect(identityIn(result, 'public.f_legacy(uuid)')).toBeUndefined();
  });

  it('rename of an identity with no CREATE is listed and has no current definition', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: 'ALTER FUNCTION public.ghost(uuid) RENAME TO ghost_legacy;',
    }]);
    const entry = identityIn(result, 'public.ghost(uuid)');
    expect(entry.state).toBe('RENAMED');
    expect(entry.current).toBeNull();
    expect(entry.renames).toEqual([{ file: 'a.sql', line: 1, to: 'ghost_legacy' }]);
    expect(identityIn(result, 'public.ghost_legacy(uuid)')).toBeUndefined();
    expect(result.renamesSeen).toHaveLength(1);
  });

  it('multi-identity REVOKE/GRANT statement is quoted for each matched identity', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: sql(
        'CREATE FUNCTION public.a() RETURNS void AS $$ BEGIN END $$;',
        'CREATE FUNCTION public.b(p_id uuid) RETURNS void AS $$ BEGIN END $$;',
        'REVOKE ALL ON FUNCTION public.a(), public.b(uuid) FROM PUBLIC;',
        'GRANT EXECUTE ON FUNCTION public.a(), public.b(uuid) TO authenticated;',
      ),
    }]);
    const a = identityIn(result, 'public.a()');
    const b = identityIn(result, 'public.b(uuid)');
    expect(a.grants.map((grant) => grant.line)).toEqual([3, 4]);
    expect(b.grants.map((grant) => grant.line)).toEqual([3, 4]);
    expect(a.grants[0].statement).toContain('public.b(uuid)');
    expect(b.grants[1].statement).toContain('public.a()');
  });

  it('more than 20 matches prints only identity and file:line and asks for a narrower name', () => {
    const lines = [];
    for (let i = 0; i < 21; i += 1) {
      lines.push('CREATE FUNCTION public.f' + i + '() RETURNS void AS $$ BEGIN END $$;');
    }
    const run = runFacts({ entries: [{ file: 'x.sql', text: lines.join('\n') }], queries: ['f'], summary: false });
    expect(run.exitCode).toBe(0);
    expect(run.output).toContain('ask for a narrower name');
    expect(run.output).not.toContain('###');
    const bullets = run.output.split('\n').filter((line) => line.indexOf('- `public.f') === 0);
    expect(bullets).toHaveLength(21);
  });

  it('schema-qualified types-only argument parses', () => {
    const result = parseMigrationTexts([{
      file: 'a.sql',
      text: 'CREATE FUNCTION public.f(public.image_extraction_candidates) RETURNS void AS $$ BEGIN END $$;',
    }]);
    expect(identityIn(result, 'public.f(public.image_extraction_candidates)')).toBeDefined();
  });

  it('--summary prints only the summary line and UNPARSED list', () => {
    const run = runFacts({
      entries: [{ file: 'a.sql', text: 'CREATE FUNCTION public.f() RETURNS void AS $$ BEGIN END $$;' }],
      queries: [],
      summary: true,
    });
    expect(run.exitCode).toBe(0);
    expect(run.output).toContain('Seen 1 create-function statements');
    expect(run.output).not.toContain('###');
    expect(run.output).not.toContain('Defined in');
  });

  it('unknown/unparsed summary arithmetic holds', () => {
    const text = sql(
      '-- CREATE OR REPLACE FUNCTION ignored',
      'CREATE FUNCTION public.f() RETURNS void AS $$ BEGIN END $$;',
      'CREATE FUNCTION public.g() RETURNS void AS $$ BEGIN',
    );
    const result = parseMigrationTexts([{ file: 'a.sql', text }]);
    expect(result.counts).toMatchObject({ seen: 2, parsed: 1, unparsed: 1, ignoredComments: 1 });
    expect(result.counts.parsed + result.counts.unparsed).toBe(result.counts.seen);
  });
});

describe('real folder known answers', () => {
  it('settle terminal usage is current in M99 line 9 with the required header and raises', () => {
    const entry = identityIn(real, 'marketplace_sec.phase9_settle_terminal_usage_v1(uuid,uuid,text)');
    expect(entry).toBeDefined();
    expect(entry.state).toBe('CURRENT');
    expect(entry.current.file).toBe(M99);
    expect(entry.current.line).toBe(9);
    expect(entry.current.header).toContain('RETURNS void');
    expect(entry.current.header).toContain('SECURITY INVOKER');
    expect(entry.current.raises).toEqual(['P9_STATE_CONFLICT']);
    expect(entry.grants.map((grant) => grant.line)).toEqual([130, 131]);
    expect(entry.grants[0].statement).toContain(
      'ALTER FUNCTION marketplace_sec.phase9_settle_terminal_usage_v1(uuid,uuid,text) OWNER TO postgres',
    );
    expect(entry.grants[1].statement).toContain(
      'REVOKE ALL ON FUNCTION marketplace_sec.phase9_settle_terminal_usage_v1(uuid,uuid,text)',
    );
    expect(entry.grants.some((grant) => /^GRANT\b/i.test(grant.statement))).toBe(false);
    expect(entry.earlier).toEqual([]);
  });

  it('dashboard inventory counts zero-arg is dropped in M99 line 157 and uuid is current at line 158', () => {
    const zero = identityIn(real, 'public.phase9_owner_dashboard_inventory_counts_v1()');
    expect(zero).toBeDefined();
    expect(zero.state).toBe('DROPPED');
    expect(zero.current).toBeNull();
    expect(zero.dropped).toEqual({ file: M99, line: 157 });
    expect(zero.earlier).toEqual([]);
    const one = identityIn(real, 'public.phase9_owner_dashboard_inventory_counts_v1(uuid)');
    expect(one).toBeDefined();
    expect(one.state).toBe('CURRENT');
    expect(one.current.file).toBe(M99);
    expect(one.current.line).toBe(158);
    expect(one.current.header).toContain('p_store_id uuid');
    expect(one.grants.map((grant) => grant.line)).toEqual([176, 177, 178]);
  });

  it('owner candidate edition choices is current in M99 line 135 with its earlier definition', () => {
    const entry = identityIn(real, 'public.phase9_owner_candidate_edition_choices_v1(uuid,uuid)');
    expect(entry).toBeDefined();
    expect(entry.state).toBe('CURRENT');
    expect(entry.current.file).toBe(M99);
    expect(entry.current.line).toBe(135);
    expect(entry.earlier).toEqual([
      { file: '20261007000066_marketplace_phase9_edition_picker_commands.sql', line: 22 },
    ]);
    expect(entry.grants.map((grant) => grant.line)).toEqual([149, 150, 152]);
    expect(entry.grants.some((grant) => /^GRANT EXECUTE\b/.test(grant.statement))).toBe(true);
  });

  it('active variant listing ids is created then dropped without a public re-creation', () => {
    const entry = identityIn(real, 'public.phase9_active_variant_listing_ids(text)');
    expect(entry).toBeDefined();
    expect(entry.state).toBe('DROPPED');
    expect(entry.current).toBeNull();
    expect(entry.dropped).toEqual({
      file: '20260729000021_marketplace_phase9_defer_active_variant_search.sql',
      line: 5,
    });
    expect(entry.earlier).toEqual([
      { file: '20260729000020_marketplace_phase9_variant_runtime_search.sql', line: 337 },
    ]);
  });

  it('unqualified update_trust_score resolves through its later public definition', () => {
    const entry = identityIn(real, 'public.update_trust_score()');
    expect(entry).toBeDefined();
    expect(entry.state).toBe('CURRENT');
    expect(entry.current.file).toBe('20260524043322_harden_profile_account_security.sql');
    expect(entry.current.line).toBe(151);
    expect(entry.earlier).toContainEqual({
      file: '20251228114030_002_p2p_exchange_system.sql',
      line: 112,
    });
  });

  it('exact statement, drop, rename, tag and comment counts', () => {
    expect(real.counts.seen).toBe(975);
    expect(real.counts.parsed).toBe(975);
    expect(real.counts.orReplace).toBe(347);
    expect(real.counts.plain).toBe(628);
    expect(real.counts.orReplace + real.counts.plain).toBe(real.counts.seen);
    expect(real.counts.unparsed).toBe(0);
    expect(real.counts.ignoredComments).toBe(1);
    expect(real.counts.drops).toBe(8);
    expect(real.counts.renames).toBe(22);
    expect(real.counts.tagCount).toBe(21);
    expect(real.unparsed).toEqual([]);
    expect(real.ignoredComments).toEqual([
      { file: '20260523035706_harden_clubs_rpc_execute_grants.sql', line: 4 },
    ]);

    const independentRegex = /create\s+(or\s+replace\s+)?function/gi;
    let independent = 0;
    for (const entry of realEntries) {
      const matches = entry.text.match(independentRegex);
      independent += matches ? matches.length : 0;
    }
    expect(independent).toBe(976);
    expect(real.counts.seen + real.counts.ignoredComments).toBe(independent);
    expect(real.counts.parsed + real.counts.unparsed).toBe(real.counts.seen);
  });

  it('renames are seen but never interpreted into new identities', () => {
    expect(real.renamesSeen).toHaveLength(22);
    const renamed = (file, line) => real.renamesSeen.find((entry) => entry.file === file && entry.line === line);
    expect(renamed('20260906000058_marketplace_phase9_media_completion_receipts.sql', 9)).toBeDefined();
    expect(renamed('20261007000068_marketplace_phase9_edition_picker_worker_completion.sql', 336)).toBeDefined();
    expect(renamed('20261008000069_marketplace_phase9_edition_picker_commit_cleanup.sql', 72)).toBeDefined();
    const moved = renamed('20261008000070_marketplace_phase9_edition_picker_confirmation.sql', 23);
    expect(moved).toBeDefined();
    expect(moved.to).toBe('phase9_edition_legacy_select_candidate');
    expect(moved.identity).toBe(
      'marketplace_sec.phase9_select_candidate_edition_v1(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid)',
    );
    expect(real.identities.some((entry) => entry.name === 'phase9_edition_legacy_metadata_state')).toBe(false);
    const legacy = identityIn(
      real,
      'marketplace_sec.phase9_edition_legacy_select_candidate(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid)',
    );
    expect(legacy).toBeDefined();
    expect(legacy.current.file).toBe('20261027000084_marketplace_phase9_catalogue_companions_completion.sql');
    expect(legacy.current.line).toBe(898);
    expect(legacy.earlier[0]).toEqual({
      file: '20261010000071_marketplace_phase9_edition_picker_selection_eligibility.sql',
      line: 7,
    });
    expect(legacy.renames).toEqual([]);
    const old = identityIn(real, 'marketplace_sec.phase9_owner_ux_metadata_state(uuid)');
    expect(old).toBeDefined();
    expect(old.renames).toContainEqual({
      file: '20261008000069_marketplace_phase9_edition_picker_commit_cleanup.sql',
      line: 72,
      to: 'phase9_edition_legacy_metadata_state',
    });
  });

  it('dollar tags are counted exactly and their first examples are correct', () => {
    expect(real.counts.tagCount).toBe(21);
    const tag = (name) => real.tags.find((entry) => entry.tag === name);
    expect(tag('$$')).toMatchObject({
      count: 791,
      firstFile: '20251228114030_002_p2p_exchange_system.sql',
      firstLine: 113,
    });
    expect(tag('$function$')).toMatchObject({ count: 140, firstFile: '20260522225430_exchange_rpc_prerequisite_reconciliation.sql', firstLine: 50 });
    expect(tag('$wrapper$')).toMatchObject({
      count: 15,
      firstFile: '20260727000013_marketplace_phase9_service_rpc_wrappers.sql',
      firstLine: 13,
    });
    expect(tag('$fn$')).toMatchObject({
      count: 1,
      firstFile: '20260822234500_clubs_b02_creation_cap_race_fix.sql',
      firstLine: 38,
    });
  });
});
