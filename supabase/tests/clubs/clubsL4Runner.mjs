#!/usr/bin/env node
/**
 * CLUB-WU-L01 · clubs L4 disposable-database test runner
 * ============================================================
 * Owns the full lifecycle for Clubs L4 backend-contract assurance:
 *   1. Docker availability check
 *   2. Uniquely named disposable PostgreSQL 17 container
 *      (pinned image: postgis/postgis:17-3.5 — PostgreSQL 17.x +
 *      PostGIS 3.5; chosen because migration 003 venues uses
 *      GEOGRAPHY(POINT). Digest verified 2026-08-26:
 *      sha256:624f5195b91d424dbebf018890148cc0e5a3e80db5467da8b53cc2ed2ce49216)
 *   3. Ephemeral loopback port binding (-p 127.0.0.1::5432)
 *   4. Generated credentials + generated clubs_l4_<suffix> databases
 *   5. Readiness polling using `pg`
 *   6. Platform substrate bootstrap (fixtures/clubs_l4_platform_bootstrap.sql)
 *   7. Replay bridge for live-verified untracked historical DDL
 *      (fixtures/clubs_l4_replay_bridge.sql — FLAGGED, see file header)
 *   8. Application of ACTUAL repository migrations for each suite
 *   9. Execution of requested contracts
 *  10. Reliable teardown in finally
 *
 * Exit-code contract:
 *   0 = all requested suites passed (including an expected-RED mutation
 *       demonstration when requested)
 *   1 = behavioral/contract assertion failed
 *   2 = infrastructure/bootstrap/safety failure
 *
 * Safety/environment guard: generated connections are always
 * 127.0.0.1/localhost against databases named clubs_l4_*. The runner
 * never consumes an external DATABASE_URL for its destructive fixture
 * path. The remote development Supabase project is never touched by
 * this harness.
 *
 * Usage:
 *   node supabase/tests/clubs/clubsL4Runner.mjs [b02|f04|all] [--mutation no-lock|no-repair]
 *   npm run test:clubs:l4 | test:clubs:l4:b02 | test:clubs:l4:f04
 *
 * Mutation demonstration (--mutation no-lock):
 *   Boots a THIRD disposable database, applies the real chain plus a
 *   runtime-generated overlay derived FROM THE ACTUAL B02 MIGRATION
 *   FILE with only the advisory-lock statement stripped, written to a
 *   temp dir outside the repository, then re-runs the identical B02
 *   contract EXPECTING failure. Proves the contract goes RED for the
 *   exact regression it guards. The overlay artifact is deleted in
 *   finally; no repository file is altered.
 *
 * Mutation demonstration (--mutation no-repair):
 *   Boots a FOURTH disposable database, applies f04_fixture.sql + the
 *   pre-migration duplicate seed, then a runtime-generated TEMP COPY of
 *   the actual F04 migration file with ONLY its duplicate-repair
 *   machinery bypassed (Step-1 loser filters → WHERE FALSE, Step-2
 *   fail-loudly guard → IF FALSE; indexes + RPC verbatim), EXPECTING
 *   the migration itself to fail at CREATE UNIQUE INDEX because
 *   duplicates remain — or, failing that, the survivor contract to
 *   fail. Proves the migration-boundary repair contract is load-bearing
 *   against exactly the defect it guards.
 * ============================================================ 
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { Client } from 'pg';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

const PINNED_IMAGE = 'postgis/postgis:17-3.5';
const BOOTSTRAP_FILE = '/repo/supabase/tests/clubs/fixtures/clubs_l4_platform_bootstrap.sql';
const BRIDGE_FILE = '/repo/supabase/tests/clubs/fixtures/clubs_l4_replay_bridge.sql';

/** Minimal dependency sequence of ACTUAL repository migrations for B02. */
const B02_MIGRATION_SEQUENCE = [
  '20251228083154_001_initial_schema.sql',
  '20251228114057_003_venues_and_clubs.sql',
  '20251228114118_004_chat_and_moderation.sql',
  '20251228114143_005_add_missing_user_profile_fields.sql',
  '20251231141336_add_all_google_books_fields.sql',
  '20251231142005_add_price_to_books.sql',
  '20260307000500_010_clubs_identity_invitations_public_contract.sql',
  '20260308222500_011_fix_club_members_select_policy_recursion.sql',
  '20260310153000_013_clubs_entitlement_enforcement.sql',
  '20260523054932_create_club_rpc.sql',
  '20260822234500_clubs_b02_creation_cap_race_fix.sql',
];

const F04_FIXTURE = '/repo/supabase/tests/f04_fixture.sql';
const F04_PRE_SEED = '/repo/supabase/tests/f04_pre_migration_duplicate_seed.sql';
const F04_REPAIR_CONTRACT = '/repo/supabase/tests/f04_migration_repair_contract.sql';
const F04_CONTRACT_TESTS = '/repo/supabase/tests/f04_contract_tests.sql';
const F04_CONCURRENCY_SCRIPT = join(REPO_ROOT, 'supabase', 'tests', 'f04_concurrency.mjs');
const F04_MIGRATION = '20260824100000_clubs_f04_reaction_single_reaction_invariant.sql';
const B02_MIGRATION = '20260822234500_clubs_b02_creation_cap_race_fix.sql';

class InfraError extends Error {}

function docker(args, opts = {}) {
  const res = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, ...opts });
  if (res.error) throw new InfraError(`failed to invoke docker: ${res.error.message}`);
  return res;
}

function assertDockerAvailable() {
  const res = docker(['info', '--format', '{{.ServerVersion}}']);
  if (res.status !== 0) {
    throw new InfraError(
      `Docker daemon not reachable (status ${res.status}). Start Docker Desktop and retry.\n${res.stderr ?? ''}`,
    );
  }
  console.log(`[runner] docker daemon ok (server ${res.stdout.trim()})`);
}

function ensurePinnedImage() {
  const inspect = docker(['image', 'inspect', PINNED_IMAGE]);
  if (inspect.status === 0) {
    console.log(`[runner] pinned image present: ${PINNED_IMAGE}`);
    return;
  }
  console.log(`[runner] pulling pinned image ${PINNED_IMAGE} ...`);
  const pull = docker(['pull', PINNED_IMAGE], { stdio: 'inherit' });
  if (pull.status !== 0) {
    throw new InfraError(`could not pull pinned image ${PINNED_IMAGE}`);
  }
}

function buildUrl({ port, user, password, database }) {
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}`;
}

/** Isolation guard: destructive/bootstrap paths may only target local disposable clubs_l4_* DBs. */
function guardLocalDisposable(database) {
  if (!/^clubs_l4_[a-z0-9_]+$/.test(database)) {
    throw new InfraError(`locality guard: refusing non-disposable database name '${database}'`);
  }
}

async function waitForReady(url, label, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 2_000 });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log(`[runner] ${label} ready`);
      return;
    } catch (e) {
      lastErr = e;
      await client.end().catch(() => {});
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new InfraError(`${label} did not become ready within ${timeoutMs}ms: ${lastErr?.message}`);
}

function psqlArgs(database) {
  return ['exec', '-i', CURRENT.container, 'psql', '-U', CURRENT.user, '-d', database,
    '-X', '-v', 'ON_ERROR_STOP=1', '-q'];
}

function psqlFile(database, containerPath, label) {
  const res = docker([...psqlArgs(database), '-f', containerPath], { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new InfraError(
      `bootstrap failed while applying ${label} (psql exit ${res.status})\n${res.stdout ?? ''}\n${res.stderr ?? ''}`,
    );
  }
  console.log(`[runner] applied ${label}`);
}

function psqlSql(database, sql, label) {
  const res = docker([...psqlArgs(database), '-c', sql], { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new InfraError(`bootstrap failed: ${label}\n${res.stdout ?? ''}\n${res.stderr ?? ''}`);
  }
  console.log(`[runner] ${label}`);
}

let CURRENT = null; // { container, user }

async function applyPlatformAndChain(database) {
  guardLocalDisposable(database);
  psqlFile(database, BOOTSTRAP_FILE, 'platform bootstrap');
  for (const file of B02_MIGRATION_SEQUENCE) {
    if (file === '20251228114118_004_chat_and_moderation.sql') {
      psqlFile(database, BRIDGE_FILE, 'FLAGGED replay bridge (live-verified untracked historical DDL)');
    }
    psqlFile(database, `/repo/supabase/migrations/${file}`, `migration ${file}`);
  }
}

async function createExtraDatabase(fromDatabase, newDatabase) {
  guardLocalDisposable(newDatabase);
  psqlSql(fromDatabase, `CREATE DATABASE ${newDatabase}`, `created database ${newDatabase}`);
}

async function runNodeScript(scriptPath, env, label) {
  console.log(`[runner] ▶ ${label}`);
  const child = spawn(process.execPath, [scriptPath], {
    env: { ...process.env, ...env },
    stdio: 'inherit',
    cwd: REPO_ROOT,
    windowsHide: true,
  });
  return new Promise((resolveExit) => {
    child.on('exit', (code) => resolveExit(code ?? 1));
    child.on('error', (e) => {
      console.error(`[runner] could not launch ${scriptPath}: ${e.message}`);
      resolveExit(2);
    });
  });
}

/**
 * Build the no-lock mutation overlay FROM THE ACTUAL B02 MIGRATION FILE,
 * stripping ONLY the advisory-lock statement. Written outside the repo;
 ** never committed; deleted by cleanup.
 */
function buildNoLockMutationOverlay(tempDir) {
  const src = readFileSync(join(REPO_ROOT, 'supabase', 'migrations', B02_MIGRATION), 'utf8');
  const mutated = src.replace(
    /^[ \t]*PERFORM pg_advisory_xact_lock[^;]*;[ \t]*$/m,
    '-- MUTATION(no-lock): advisory xact lock removed for L01-A RED proof (runtime temp copy)',
  );
  if (mutated === src) {
    throw new InfraError('mutation overlay produced no change: advisory-lock statement not found in real B02 migration');
  }
  const overlayPath = join(tempDir, 'b02_no_lock_mutation_overlay.sql');
  writeFileSync(overlayPath, mutated, 'utf8');
  return overlayPath;
}

/**
 * Build the no-repair mutation overlay FROM THE ACTUAL F04 MIGRATION FILE,
 * bypassing ONLY its duplicate-repair machinery (migration Steps 1+2, one
 * logical clean-then-verify phase):
 *   · Step-1 loser filters (`WHERE rn > 1` ×2) become `WHERE FALSE`, so the
 *     repair DELETEs remove nothing;
 *   · the Step-2 fail-loudly guard (`IF v_topic_groups > 0 …`) becomes
 *     `IF FALSE`, so it cannot pre-empt the guarded outcome.
 * Steps 3 (partial unique indexes) and 4 (RPC) remain verbatim. Written
 * outside the repo; never committed; deleted by cleanup. With legacy
 * duplicates pre-seeded, the mutated migration must fail at CREATE UNIQUE
 * INDEX `club_discussion_reactions_topic_user_unique` (duplicates remain) —
 * or, failing that, the survivor contract must fail.
 */
function buildNoRepairMutationOverlay(tempDir) {
  const src = readFileSync(join(REPO_ROOT, 'supabase', 'migrations', F04_MIGRATION), 'utf8');
  const loserFilter = 'WHERE rn > 1';
  const failLoudlyGuard = 'IF v_topic_groups > 0 OR v_reply_groups > 0 THEN';
  const loserCount = src.split(loserFilter).length - 1;
  const guardCount = src.split(failLoudlyGuard).length - 1;
  if (loserCount !== 2 || guardCount !== 1) {
    throw new InfraError(
      `mutation overlay refused: expected 2 repair loser filters + 1 fail-loudly guard in real F04 migration, found ${loserCount} + ${guardCount}`,
    );
  }
  const mutated = src
    .replaceAll(loserFilter, 'WHERE FALSE -- MUTATION(no-repair): Step-1 repair bypassed for L01-A RED proof (runtime temp copy)')
    .replaceAll(failLoudlyGuard, 'IF FALSE THEN -- MUTATION(no-repair): Step-2 fail-loudly guard bypassed for L01-A RED proof');
  const overlayPath = join(tempDir, 'f04_no_repair_mutation_overlay.sql');
  writeFileSync(overlayPath, mutated, 'utf8');
  return overlayPath;
}

async function main() {
  const argv = process.argv.slice(2);
  const suites = [];
  if (argv.includes('b02')) suites.push('b02');
  if (argv.includes('f04')) suites.push('f04');
  if (suites.length === 0) suites.push('b02', 'f04');
  const mutationArg = argv.includes('--mutation') ? argv[argv.indexOf('--mutation') + 1] : null;
  const noLockMutation = mutationArg === 'no-lock'; // B02 RED proof
  const noRepairMutation = mutationArg === 'no-repair'; // F04 migration-boundary RED proof

  assertDockerAvailable();
  ensurePinnedImage();

  const suffix = randomBytes(4).toString('hex');
  const container = `clubs-l4-pg-${process.pid}-${suffix}`;
  const user = `clubs_l4_u${suffix}`;
  const password = randomBytes(16).toString('hex');
  const dbB02 = `clubs_l4_b02_${suffix}`;
  const dbF04 = `clubs_l4_f04_${suffix}`;
  const dbMut = `clubs_l4_mut_${suffix}`;
  const dbF04Mut = `clubs_l4_f04mut_${suffix}`;

  console.log(`[runner] starting disposable ${PINNED_IMAGE} container '${container}'`);
  const runRes = docker([
    'run', '-d',
    '--name', container,
    '-e', `POSTGRES_USER=${user}`,
    '-e', `POSTGRES_PASSWORD=${password}`,
    '-e', `POSTGRES_DB=${dbB02}`,
    '-p', '127.0.0.1::5432',
    '-v', `${REPO_ROOT}:/repo:ro`,
    PINNED_IMAGE,
    'postgres', '-c', 'fsync=off', '-c', 'full_page_writes=off', '-c', 'synchronous_commit=off',
  ], { encoding: 'utf8' });
  if (runRes.status !== 0) {
    throw new InfraError(`docker run failed:\n${runRes.stdout ?? ''}\n${runRes.stderr ?? ''}`);
  }
  CURRENT = { container, user };

  let tempDir = null;
  let contractFailures = 0;

  try {
    const portInspect = docker(
      ['inspect', '--format', '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}', container],
      { encoding: 'utf8' },
    );
    if (portInspect.status !== 0) throw new InfraError(`could not resolve mapped port:\n${portInspect.stderr ?? ''}`);
    const port = Number.parseInt(portInspect.stdout.trim(), 10);
    if (!Number.isInteger(port)) throw new InfraError(`unparsable mapped port '${portInspect.stdout}'`);
    console.log(`[runner] loopback mapping 127.0.0.1:${port} -> container 5432`);

    const urlFor = (database) => buildUrl({ port, user, password, database });

    await waitForReady(urlFor(dbB02), 'disposable PostgreSQL 17');
    await applyPlatformAndChain(dbB02);

    if (suites.includes('b02')) {
      const code = await runNodeScript(
        join(HERE, 'contracts', 'b02_creation_cap.test.mjs'),
        { CLUBS_L4_DATABASE_URL: urlFor(dbB02) },
        'suite b02: creation-cap concurrency contract',
      );
      if (code !== 0) contractFailures += 1;
      else console.log('[runner] suite b02 PASS');

      if (code === 0 && noLockMutation) {
        console.log('[runner] ── RED-proof: --mutation no-lock ──');
        tempDir = mkdtempSync(join(tmpdir(), 'clubs-l4-mutation-'));
        const overlayPath = buildNoLockMutationOverlay(tempDir);
        await createExtraDatabase(dbB02, dbMut);
        await applyPlatformAndChain(dbMut);

        // The overlay lives OUTSIDE the read-only repo mount on purpose
        // (it must never enter the repository); pipe it to psql via stdin.
        const overlaySql = readFileSync(overlayPath, 'utf8');
        {
          const res = spawnSync('docker',
            [...psqlArgs(dbMut), '-f', '-'],
            { encoding: 'utf8', input: overlaySql, windowsHide: true },
          );
          if (res.status !== 0) {
            throw new InfraError(`failed to apply mutation overlay:\n${res.stdout ?? ''}\n${res.stderr ?? ''}`);
          }
          console.log('[runner] applied runtime no-lock mutation overlay (temp copy of real B02 minus advisory lock)');
        }

        const mutCode = await runNodeScript(
          join(HERE, 'contracts', 'b02_creation_cap.test.mjs'),
          { CLUBS_L4_DATABASE_URL: urlFor(dbMut), CLUBS_L4_EXPECT_CAP: '5' },
          'suite b02 MUTATED (no-lock): contract expected to go RED',
        );
        if (mutCode === 1) {
          console.log('[runner] RED PROOF PASS: contract correctly FAILED without the advisory lock (serialization regression detectable)');
        } else {
          console.error('[runner] RED PROOF FAIL: contract did NOT fail under no-lock mutation — harness insensitive to the guarded regression');
          contractFailures += 1;
        }
      }
    }

    if (suites.includes('f04')) {
      console.log('[runner] ── F04 regression anchor (migration-boundary repair architecture) ──');
      await createExtraDatabase(dbB02, dbF04);
      psqlFile(dbF04, F04_FIXTURE, 'f04_fixture.sql (fixture/bootstrap)');
      psqlFile(dbF04, F04_PRE_SEED, 'f04_pre_migration_duplicate_seed.sql (legacy duplicates BEFORE migration)');
      psqlFile(dbF04, `/repo/supabase/migrations/${F04_MIGRATION}`, `ACTUAL F04 migration ${F04_MIGRATION} (unchanged)`);
      psqlFile(dbF04, F04_REPAIR_CONTRACT, 'f04_migration_repair_contract.sql (migration-repair assertions)');
      psqlFile(dbF04, F04_CONTRACT_TESTS, 'f04_contract_tests.sql (remaining post-migration contracts CASE 1–13)');
      const concCode = await runNodeScript(
        F04_CONCURRENCY_SCRIPT,
        { DATABASE_URL: urlFor(dbF04) },
        'f04_concurrency.mjs cases A–D (existing file, unchanged)',
      );
      if (concCode !== 0) contractFailures += 1;
      else console.log('[runner] F04 anchor PASS (fixture + pre-seed + actual migration + repair contract + CASE 1–13 + concurrency A–D)');

      if (concCode === 0 && noRepairMutation) {
        console.log('[runner] ── RED-proof: --mutation no-repair ──');
        tempDir = mkdtempSync(join(tmpdir(), 'clubs-l4-mutation-'));
        const overlayPath = buildNoRepairMutationOverlay(tempDir);
        await createExtraDatabase(dbB02, dbF04Mut);
        psqlFile(dbF04Mut, F04_FIXTURE, 'mutated-db fixture bootstrap');
        psqlFile(dbF04Mut, F04_PRE_SEED, 'mutated-db pre-migration duplicate seed');

        // The overlay lives OUTSIDE the read-only repo mount on purpose
        // (it must never enter the repository); pipe it to psql via stdin.
        const overlaySql = readFileSync(overlayPath, 'utf8');
        const mutRes = spawnSync('docker',
          [...psqlArgs(dbF04Mut), '-f', '-'],
          { encoding: 'utf8', input: overlaySql, windowsHide: true },
        );
        const mutOutput = `${mutRes.stdout ?? ''}\n${mutRes.stderr ?? ''}`;

        if (mutRes.status !== 0) {
          // Primary expected RED: mutated migration fails at CREATE UNIQUE INDEX
          // because the bypassed repair left duplicate rows in place.
          if (/club_discussion_reactions_topic_user_unique/.test(mutOutput)) {
            console.log('[runner] RED PROOF PASS: no-repair mutation made the MIGRATION itself fail at CREATE UNIQUE INDEX club_discussion_reactions_topic_user_unique (repair step is load-bearing; duplicate rows remained)');
            const idx = mutOutput.indexOf('ERROR');
            if (idx >= 0) console.log(`[runner]   ${mutOutput.slice(idx, idx + 200).split('\n')[0].trim()}`);
          } else {
            console.error('[runner] RED PROOF INCONCLUSIVE: mutated migration failed, but not on the guarded unique index:\n' + mutOutput);
            contractFailures += 1;
          }
        } else {
          // Alternate acceptable RED: migration somehow succeeded → survivor
          // contract must fail against the un-repaired duplicates.
          console.log('[runner] mutated migration unexpectedly applied; falling through to survivor-contract RED check');
          const contractRes = spawnSync('docker',
            [...psqlArgs(dbF04Mut), '-f', F04_REPAIR_CONTRACT],
            { encoding: 'utf8', windowsHide: true },
          );
          if (contractRes.status === 1) {
            console.log('[runner] RED PROOF PASS: survivor contract correctly FAILED against un-repaired duplicates');
          } else {
            console.error(`[runner] RED PROOF FAIL: contract did NOT fail under no-repair mutation (psql exit ${contractRes.status}) — harness insensitive to the guarded regression`);
            contractFailures += 1;
          }
        }
      }
    }
  } finally {
    console.log('[runner] tearing down disposable environment');
    if (CURRENT?.container) {
      docker(['rm', '-f', '-v', CURRENT.container]);
      console.log(`[runner] removed container ${CURRENT.container}`);
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      console.log('[runner] removed mutation temp artifacts');
    }
  }

  if (contractFailures > 0) {
    console.error(`[runner] L01-A result: FAIL (${contractFailures} suite(s) failed)`);
    process.exit(1);
  }
  console.log(`[runner] L01-A result: PASS (${suites.join(' + ')})`);
}

main().catch((e) => {
  if (e instanceof InfraError) {
    console.error(`[runner] INFRASTRUCTURE FAILURE: ${e.message}`);
    process.exit(2);
  }
  console.error('[runner] UNEXPECTED FAILURE:', e);
  process.exit(2);
});
