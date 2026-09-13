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
 *   node supabase/tests/clubs/clubsL4Runner.mjs [b02|f04|wave2|rls|downgrade|tc03|tc04|all] [--mutation no-lock|no-repair|tc04-mut1-no-recovery|tc04-mut2-single-fallback|tc04-mut3-vote-grant|tc04-mut4-nomination-grant|tc04-mut5-club-update]
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
const STORAGE_SUBSTRATE_FILE = '/repo/supabase/tests/clubs/fixtures/clubs_l4_storage_substrate.sql';
const B01_MIGRATION_FILE = '20260822233000_clubs_b01_banner_storage_lockdown.sql';

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

/** L01-B wave2 extras (applied after B02 chain on wave2 DB) */
const WAVE2_EXTRA_MIGRATIONS = [
  '20260310170000_014_clubs_events_schema_policy_alignment.sql',
  '20260529154500_club_moderation_author_lifecycle_rpc.sql',
  '20260822230000_clubs_wave2_attribution_guards_expiry.sql',
];
const WAVE2_MIGRATION = '20260822230000_clubs_wave2_attribution_guards_expiry.sql';

/** WU-TC01 downgrade chain extras (applied after the B02 chain on the downgrade DB):
 *  REC-2 archived_at reconstruction, then the downgrade/grace migration (PRE-FIX).
 *  The forward bug-fix migration is applied by the runner BETWEEN the RED and
 *  GREEN contract phases (migration-boundary RED→GREEN design). */
const DOWNGRADE_EXTRA_MIGRATIONS = [
  '20260529160000_clubs_book_clubs_archived_at_reconstruction.sql',
  '20260529170000_club_downgrade_grace_period.sql',
];
const DOWNGRADE_FIX_MIGRATION = '20260830090435_clubs_fix_downgrade_grace_archived_club_ids_ambiguity.sql';

/** WU-TC03 admin-transfer chain extras (applied after the B02 chain on the tc03 DB).
 *  The request/accept RPCs + transfer-request table come from the moderation/
 *  author-lifecycle migration; the repo-only direct RPC migration
 *  20260527104248 is intentionally NOT applied (live-absent, unused by the
 *  active request/accept path). The forward fix migration is applied by the
 *  runner BETWEEN the RED and GREEN contract phases (migration-boundary
 *  RED→GREEN design). */
const TC03_BASE_MIGRATION = '20260529154500_club_moderation_author_lifecycle_rpc.sql';
const TC03_FIX_MIGRATION = '20260830153413_clubs_tc03_admin_transfer_accept_revalidation.sql';

/** WU-TC04 book-workflow chain extras (applied after the B02 chain on the tc04 DB).
 *  Minimal faithful dependencies for the book-workflow write boundary:
 *  012 workflow contract (nominate/vote/finalize + INSERT policies),
 *  finalize manager-auth + status overview + early-selection RPCs,
 *  harden RPC EXECUTE grants, REC-2 archived_at (GREEN-4B archive fields),
 *  enterprise notification foundation + event routing (notification_events
 *  substrate for the nomination-notification count proof).
 *  The full 20260606142000 complete-notifications file is intentionally NOT
 *  applied: it creates triggers on listings/club_events/reading_schedules/
 *  downgrade tables absent from this minimal chain. Only its faithful
 *  book-nomination excerpt (route_book_nomination_notification function +
 *  trigger, verbatim) is applied inline by applyTc04Chain below.
 *  The forward TC04 fix migration is applied by the runner BETWEEN the RED
 *  and GREEN contract phases (migration-boundary RED→GREEN design). */
const TC04_EXTRA_MIGRATIONS = [
  '20260309143000_012_club_book_workflow_contract.sql',
  '20260311113000_014_club_book_finalize_manager_authorization.sql',
  '20260311143000_015_club_current_book_status_contract.sql',
  '20260507120000_016_set_current_book_from_nomination.sql',
  '20260529160000_clubs_book_clubs_archived_at_reconstruction.sql',
  '20260606103405_enterprise_notifications.sql',
];
const TC04_FIX_MIGRATION = '20260912200746_clubs_tc04_book_workflow_write_boundary.sql';

/** L01-C RLS chain: ordered dependency including chat RLS + B01.
 *  Minimal for RLS contracts: includes 009 (club_messages/messages RLS) which
 *  B02 chain omitted. 006/007/008 not required for club_messages/storage RLS
 *  and would pull exchange tables (002) not needed here.
 */
const RLS_MIGRATION_SEQUENCE = [
  '20251228083154_001_initial_schema.sql',
  '20251228114057_003_venues_and_clubs.sql',
  '20251228114118_004_chat_and_moderation.sql',
  '20251228114143_005_add_missing_user_profile_fields.sql',
  '20251228114516_009_rls_policies_chat_moderation.sql',
  '20251231141336_add_all_google_books_fields.sql',
  '20251231142005_add_price_to_books.sql',
  '20260307000500_010_clubs_identity_invitations_public_contract.sql',
  '20260308222500_011_fix_club_members_select_policy_recursion.sql',
  '20260310153000_013_clubs_entitlement_enforcement.sql',
  '20260523054932_create_club_rpc.sql',
  '20260822234500_clubs_b02_creation_cap_race_fix.sql',
];

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

/** WU-TC01: B02 base chain + REC-2 archived_at + downgrade/grace migration (pre-fix state). */
async function applyDowngradeChain(database) {
  guardLocalDisposable(database);
  await applyPlatformAndChain(database);
  for (const file of DOWNGRADE_EXTRA_MIGRATIONS) {
    psqlFile(database, `/repo/supabase/migrations/${file}`, `downgrade migration ${file}`);
  }
  console.log('[runner] downgrade chain applied (B02 base + REC-2 archived_at + downgrade/grace PRE-FIX)');
}

/** WU-TC04: B02 base chain + book-workflow + notification substrate (pre-fix state).
 *  TEMPORARY TC04 CHAIN COMPATIBILITY — NOT REPLAY PROOF.
 *  The full 20260606142000 complete-notifications migration cannot replay on
 *  this minimal chain (triggers on listings/club_events/reading_schedules/
 *  downgrade tables absent here). Only its book-nomination excerpt is applied
 *  inline below, VERBATIM from the real file (function +
 *  DROP/CREATE TRIGGER), to provide the live-parity AFTER INSERT trigger the
 *  GREEN-1 notification-count proof requires. Authoritative replay repair is
 *  owned by L01-D / TEST-07 (same category as the wave2 pre-drop above). */
async function applyTc04Chain(database) {
  guardLocalDisposable(database);
  await applyPlatformAndChain(database);
  for (const file of TC04_EXTRA_MIGRATIONS) {
    psqlFile(database, `/repo/supabase/migrations/${file}`, `tc04 migration ${file}`);
  }
  // Faithful book-RPC EXECUTE hardening excerpt (verbatim lines 17-32 of
  // 20260523035706). The full file cannot replay here (it touches discussion/
  // event helper functions absent from this minimal chain); only the book
  // nomination/current-book RPC section is needed for the TC04 EXECUTE ACL.
  psqlSql(
    database,
    `REVOKE EXECUTE ON FUNCTION public.nominate_club_book(uuid, uuid, text, text, text[], text, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cast_club_book_vote(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_club_book_vote(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finalize_club_book_nomination(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_club_current_book_from_nomination(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_club_current_book_status_overview(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_club_current_book_reading_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nominate_club_book(uuid, uuid, text, text, text[], text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cast_club_book_vote(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_club_book_vote(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_club_book_nomination(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_club_current_book_from_nomination(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_club_current_book_status_overview(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_club_current_book_reading_status(uuid, text) TO authenticated, service_role;`,
    'TEMPORARY tc04 chain-compat: faithful book-RPC EXECUTE excerpt (full harden file touches absent discussion/event helpers — L01-D/TEST-07 owns replay repair)',
  );
  // Faithful notification-substrate excerpts (verbatim from real files).
  // Full 20260606103516 routing cannot replay here (route_transaction_*
  // reference public.transactions from absent exchange migration 002);
  // full 20260606142000 complete file cannot replay (triggers on
  // listings/club_events/reading_schedules/downgrade tables absent here).
  // Only the three live-parity objects the GREEN-1 notification-count proof
  // needs are restored verbatim: notification_active_club_members (complete
  // lines 3-13), create_notification_event + enqueue_notification_delivery
  // (routing lines 3-128), route_book_nomination_notification + trigger
  // (complete lines 189-254).
  psqlSql(
    database,
    `CREATE OR REPLACE FUNCTION public.notification_active_club_members(p_club_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT cm.user_id FROM public.club_members cm WHERE cm.club_id = p_club_id AND cm.status IN ('active', 'muted');
$function$;
CREATE OR REPLACE FUNCTION public.create_notification_event(p_event_type text, p_entity_type text, p_entity_id uuid, p_actor_user_id uuid, p_source text, p_idempotency_key text, p_severity text DEFAULT 'info', p_requires_action boolean DEFAULT false, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS public.notification_events LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE event_record public.notification_events;
BEGIN
  INSERT INTO public.notification_events (event_type, entity_type, entity_id, actor_user_id, source, severity, requires_action, payload, idempotency_key)
  VALUES (p_event_type, p_entity_type, p_entity_id, p_actor_user_id, p_source, p_severity, p_requires_action, COALESCE(p_payload, '{}'::jsonb), p_idempotency_key)
  ON CONFLICT (idempotency_key) DO NOTHING RETURNING * INTO event_record;
  IF event_record.id IS NULL THEN SELECT * INTO event_record FROM public.notification_events WHERE idempotency_key = p_idempotency_key; END IF;
  RETURN event_record;
END;
$function$;
CREATE OR REPLACE FUNCTION public.enqueue_notification_delivery(p_event_id uuid, p_recipient_user_id uuid, p_category text, p_channels text[], p_title text, p_body text, p_deep_link text DEFAULT NULL, p_preference_key text DEFAULT NULL, p_mandatory boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE channel_value text; inserted_count integer := 0; preference_enabled boolean;
BEGIN
  IF p_recipient_user_id IS NULL THEN RETURN 0; END IF;
  FOREACH channel_value IN ARRAY p_channels LOOP
    IF channel_value NOT IN ('in_app', 'push') THEN CONTINUE; END IF;
    SELECT enabled INTO preference_enabled FROM public.notification_preferences WHERE user_id = p_recipient_user_id AND preference_key = COALESCE(p_preference_key, p_category) AND channel = channel_value;
    IF NOT p_mandatory AND COALESCE(preference_enabled, true) IS NOT TRUE THEN CONTINUE; END IF;
    INSERT INTO public.notification_deliveries (event_id, recipient_user_id, category, channel, title, body, deep_link, status)
    VALUES (p_event_id, p_recipient_user_id, p_category, channel_value, p_title, p_body, p_deep_link, 'pending')
    ON CONFLICT (event_id, recipient_user_id, channel) DO NOTHING;
    IF FOUND THEN inserted_count := inserted_count + 1; END IF;
  END LOOP;
  RETURN inserted_count;
END;
$function$;`,
    'TEMPORARY tc04 chain-compat: faithful notification substrate excerpt (routing/complete transaction+listing triggers omitted — L01-D/TEST-07 owns replay repair)',
  );
  // Live-parity table grants (Supabase defaults): ordinary client roles need
  // table privileges so RLS policies evaluate; the TC04 fix revokes exactly
  // the write paths under test. Applied here (not only in-test) so MUTATED
  // DBs (GREEN-only, no RED setup) share the identical privilege baseline —
  // otherwise denials would pass trivially for lack of grants and MUT-3/4/5
  // would be meaningless.
  psqlSql(
    database,
    `GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_clubs, public.book_nominations, public.book_votes, public.books, public.club_members, public.user_profiles TO anon, authenticated, service_role;`,
    'TEMPORARY tc04 chain-compat: live-parity table grants (Supabase defaults the fix revokes selectively)',
  );
  psqlSql(
    database,
    `CREATE OR REPLACE FUNCTION public.route_book_nomination_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  event_record public.notification_events;
  nominated_book public.books%ROWTYPE;
  recipient record;
BEGIN
  IF TG_OP <> 'INSERT' OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO nominated_book FROM public.books WHERE id = NEW.book_id;
  event_record := public.create_notification_event(
    'club.book_nominated', 'book_nomination', NEW.id, NEW.nominated_by,
    'book_nominations', 'book_nomination:' || NEW.id::text || ':created',
    'info', false,
    jsonb_build_object('club_id', NEW.club_id, 'nomination_id', NEW.id, 'book_id', NEW.book_id, 'title', nominated_book.title, 'voting_ends_at', NEW.voting_ends_at)
  );
  FOR recipient IN SELECT acm.user_id FROM public.notification_active_club_members(NEW.club_id) acm WHERE acm.user_id IS DISTINCT FROM NEW.nominated_by
  LOOP
    PERFORM public.enqueue_notification_delivery(event_record.id, recipient.user_id, 'clubs', ARRAY['in_app','push'], 'New club book nomination', 'A new book was nominated for your club.', '/(tabs)/clubs/' || NEW.club_id::text || '/nominate', 'clubs', false);
  END LOOP;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS route_book_nomination_notification ON public.book_nominations;
CREATE TRIGGER route_book_nomination_notification AFTER INSERT ON public.book_nominations FOR EACH ROW EXECUTE FUNCTION public.route_book_nomination_notification();`,
    'TEMPORARY tc04 chain-compat: faithful book-nomination notification excerpt (complete-file triggers on absent tables omitted — L01-D/TEST-07 owns replay repair)',
  );
  console.log('[runner] tc04 chain applied (B02 base + book workflow + notification substrate PRE-FIX)');
}

async function applyRlsChain(database) {
  guardLocalDisposable(database);
  psqlFile(database, BOOTSTRAP_FILE, 'platform bootstrap');
  for (const file of RLS_MIGRATION_SEQUENCE) {
    if (file === '20251228114118_004_chat_and_moderation.sql') {
      psqlFile(database, BRIDGE_FILE, 'FLAGGED replay bridge (live-verified untracked historical DDL)');
    }
    psqlFile(database, `/repo/supabase/migrations/${file}`, `migration ${file}`);
  }
  psqlFile(database, STORAGE_SUBSTRATE_FILE, 'SUPABASE PLATFORM TEST SUBSTRATE (storage.objects compatibility)');
  psqlFile(database, `/repo/supabase/migrations/${B01_MIGRATION_FILE}`, `ACTUAL B01 migration ${B01_MIGRATION_FILE}`);
  console.log('[runner] RLS chain applied (RLS policies + storage substrate + B01)');
}

async function applyWave2Extension(database) {
  guardLocalDisposable(database);
  for (const file of WAVE2_EXTRA_MIGRATIONS) {
    // Pre-drop for issue_club_member_action to allow CREATE OR REPLACE to remove DEFAULT (see 20260822230000 hint).
    // ─────────────────────────────────────────────────────────────────────
    // TEMPORARY L01 TEST COMPATIBILITY
    // NOT REPLAY PROOF
    // NOT TEST-07 CLOSURE
    //
    // Why this pre-drop exists: the prior migration
    // 20260529154500 defines issue_club_member_action with
    // `p_duration_hours integer DEFAULT NULL`; the wave2 migration
    // 20260822230000 re-CREATEs it WITHOUT that default. PostgreSQL
    // refuses `CREATE OR REPLACE` that removes an existing parameter
    // default, so a clean replay of repository history would FAIL at
    // the wave2 step. This pre-drop is a temporary contract-substrate
    // workaround ONLY. The authoritative replay break is logged as a
    // known repository migration replay failure owned by L01-D / TEST-07.
    // ─────────────────────────────────────────────────────────────────────
    if (file === '20260822230000_clubs_wave2_attribution_guards_expiry.sql') {
      psqlSql(database,
        'DROP FUNCTION IF EXISTS public.issue_club_member_action(uuid, uuid, text, text, integer);',
        'pre-drop issue_club_member_action for wave2 DEFAULT removal (live-known replay break — L01-D/TEST-07 owns authoritative fix)');
    }
    psqlFile(database, `/repo/supabase/migrations/${file}`, `wave2 migration ${file}`);
  }
  console.log('[runner] wave2 extension applied (B03/B04 triggers + HIER guards + expiry)');
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

/**
 * WU-TC04 mutation overlays, each derived FROM THE ACTUAL TC04 MIGRATION
 * FILE with exactly one load-bearing guard removed. Written outside the
 * repo; never committed; deleted by cleanup. Each overlay is applied to a
 * FRESH disposable DB (base TC04 chain + mutated fix), then the GREEN
 * contract is run EXPECTING failure — proving GREEN is sensitive to the
 * exact regression it guards. No gratuitous matrix.
 */
function tc04MutationOverlay(tempDir, kind) {
  const src = readFileSync(join(REPO_ROOT, 'supabase', 'migrations', TC04_FIX_MIGRATION), 'utf8');
  let mutated = src;
  let tag = '';
  if (kind === 'tc04-mut1-no-recovery') {
    // MUT-1: remove nomination conflict recovery → concurrency GREEN must fail with 23505.
    // Replace targeted ON CONFLICT DO NOTHING with a plain INSERT (no conflict clause).
    const needle = 'ON CONFLICT (club_id, book_id, status) DO NOTHING';
    if (!src.includes(needle)) throw new InfraError('MUT-1 overlay refused: conflict target not found in real TC04 migration');
    mutated = src.replaceAll(needle, '-- MUTATION(mut1): conflict recovery removed (plain INSERT, runtime temp copy)');
    tag = 'tc04_mut1_no_recovery_overlay.sql';
  } else if (kind === 'tc04-mut2-single-fallback') {
    // MUT-2: replace bounded-loop recovery with insufficient single attempt.
    // After a conflicted INSERT (zero rows), RETURN NULL immediately instead
    // of looping to re-evaluate. Normal 2-caller race then yields A=id,
    // B=NULL (deterministic GREEN-1 failure); the disappearance edge would
    // likewise NULL. Proves the retry loop is load-bearing for both the
    // ordinary duplicate race and the ACTIVE→SELECTED disappearance.
    const needle = 'IF created_nomination.id IS NOT NULL THEN';
    if (!src.includes(needle)) throw new InfraError('MUT-2 overlay refused: recovery return not found in real TC04 migration');
    mutated = src.replaceAll(
      `${needle}\n      RETURN created_nomination;\n    END IF;`,
      `${needle}\n      RETURN created_nomination;\n    END IF;\n    RETURN NULL::public.book_nominations; -- MUTATION(mut2): no recovery loop, NULL on conflict (runtime temp copy)`,
    );
    tag = 'tc04_mut2_single_fallback_overlay.sql';
  } else if (kind === 'tc04-mut3-vote-grant') {
    // MUT-3: restore vote INSERT grant/policy → direct-vote denial GREEN fails.
    const needle = 'REVOKE INSERT ON public.book_votes FROM PUBLIC, anon, authenticated;';
    if (!src.includes(needle)) throw new InfraError('MUT-3 overlay refused: vote REVOKE not found in real TC04 migration');
    mutated = src.replaceAll(needle, '-- MUTATION(mut3): vote INSERT revoke removed (runtime temp copy)');
    const needle2 = 'DROP POLICY IF EXISTS "Members can vote" ON public.book_votes;';
    if (!src.includes(needle2)) throw new InfraError('MUT-3 overlay refused: vote policy drop not found');
    mutated = mutated.replaceAll(needle2, '-- MUTATION(mut3): vote INSERT policy retained (runtime temp copy)');
    tag = 'tc04_mut3_vote_grant_overlay.sql';
  } else if (kind === 'tc04-mut4-nomination-grant') {
    // MUT-4: restore nomination INSERT grant/policy → direct-nomination denial GREEN fails.
    const needle = 'REVOKE INSERT ON public.book_nominations FROM PUBLIC, anon, authenticated;';
    if (!src.includes(needle)) throw new InfraError('MUT-4 overlay refused: nomination REVOKE not found in real TC04 migration');
    mutated = src.replaceAll(needle, '-- MUTATION(mut4): nomination INSERT revoke removed (runtime temp copy)');
    const needle2 = 'DROP POLICY IF EXISTS "Members can nominate books" ON public.book_nominations;';
    if (!src.includes(needle2)) throw new InfraError('MUT-4 overlay refused: nomination policy drop not found');
    mutated = mutated.replaceAll(needle2, '-- MUTATION(mut4): nomination INSERT policy retained (runtime temp copy)');
    tag = 'tc04_mut4_nomination_grant_overlay.sql';
  } else if (kind === 'tc04-mut5-club-update') {
    // MUT-5: restore table-wide book_clubs UPDATE → current_book_id denial GREEN fails.
    const needle = 'REVOKE UPDATE ON public.book_clubs FROM PUBLIC, anon, authenticated;';
    if (!src.includes(needle)) throw new InfraError('MUT-5 overlay refused: club UPDATE revoke not found in real TC04 migration');
    mutated = src.replaceAll(needle, '-- MUTATION(mut5): club table-wide UPDATE revoke removed (runtime temp copy)');
    tag = 'tc04_mut5_club_update_overlay.sql';
  } else {
    throw new InfraError(`unknown TC04 mutation kind '${kind}'`);
  }
  if (mutated === src) throw new InfraError(`mutation overlay produced no change for kind '${kind}'`);
  const overlayPath = join(tempDir, tag);
  writeFileSync(overlayPath, mutated, 'utf8');
  return overlayPath;
}

async function applyTc04MutationOverlay(database, overlayPath, label) {
  const overlaySql = readFileSync(overlayPath, 'utf8');
  const res = spawnSync('docker', [...psqlArgs(database), '-f', '-'], {
    encoding: 'utf8',
    input: overlaySql,
    windowsHide: true,
  });
  if (res.status !== 0) {
    throw new InfraError(`failed to apply TC04 mutation overlay ${label}:\n${res.stdout ?? ''}\n${res.stderr ?? ''}`);
  }
  console.log(`[runner] applied runtime TC04 mutation overlay ${label} (temp copy of real fix minus one guard)`);
}

async function main() {
  const argv = process.argv.slice(2);
  const suites = [];
  if (argv.includes('b02')) suites.push('b02');
  if (argv.includes('f04')) suites.push('f04');
  if (argv.includes('wave2') || argv.includes('wave2_attribution') || argv.includes('wave2_invitation') || argv.includes('wave2_moderation') || argv.includes('wave2:all')) suites.push('wave2');
  if (argv.includes('rls') || argv.includes('b01') || argv.includes('l01c')) suites.push('rls');
  if (argv.includes('downgrade') || argv.includes('tc01')) suites.push('downgrade');
  if (argv.includes('tc03') || argv.includes('admin-transfer')) suites.push('tc03');
  if (argv.includes('tc04') || argv.includes('book-workflow') || argv.includes('book_workflow')) suites.push('tc04');
  if (suites.length === 0) suites.push('b02', 'f04', 'wave2', 'rls', 'downgrade', 'tc03');
  const mutationArg = argv.includes('--mutation') ? argv[argv.indexOf('--mutation') + 1] : null;
  const noLockMutation = mutationArg === 'no-lock'; // B02 RED proof
  const noRepairMutation = mutationArg === 'no-repair'; // F04 migration-boundary RED proof
  const tc04Mutation = mutationArg && mutationArg.startsWith('tc04-') ? mutationArg : null; // TC04 sensitivity

  assertDockerAvailable();
  ensurePinnedImage();

  const suffix = randomBytes(4).toString('hex');
  const container = `clubs-l4-pg-${process.pid}-${suffix}`;
  const user = `clubs_l4_u${suffix}`;
  const password = randomBytes(16).toString('hex');
  const dbB02 = `clubs_l4_b02_${suffix}`;
  const dbF04 = `clubs_l4_f04_${suffix}`;
  const dbWave2 = `clubs_l4_wave2_${suffix}`;
  const dbRls = `clubs_l4_rls_${suffix}`;
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

    if (suites.includes('wave2')) {
      console.log('[runner] ── WAVE2 backend contracts (B03/B04/B05/HIER) ──');
      await createExtraDatabase(dbB02, dbWave2);
      await applyPlatformAndChain(dbWave2);
      await applyWave2Extension(dbWave2);
      const wave2Scripts = [
        [join(HERE, 'contracts', 'wave2_attribution.test.mjs'), 'wave2 attribution (B03+B04)'],
        [join(HERE, 'contracts', 'wave2_invitation_expiry.test.mjs'), 'wave2 invitation expiry (B05)'],
        [join(HERE, 'contracts', 'wave2_moderation.test.mjs'), 'wave2 moderation (HIER-02/HIER-03)'],
      ];
      for (const [scriptPath, label] of wave2Scripts) {
        const code = await runNodeScript(scriptPath, { CLUBS_L4_DATABASE_URL: urlFor(dbWave2) }, `suite ${label}`);
        if (code !== 0) contractFailures += 1;
        else console.log(`[runner] suite ${label} PASS`);
      }
    }

    if (suites.includes('downgrade')) {
      console.log('[runner] ── WU-TC01 downgrade/grace contract (RED pre-fix → forward fix → GREEN) ──');
      const dbDowngrade = `clubs_l4_downgrade_${suffix}`;
      await createExtraDatabase(dbB02, dbDowngrade);
      await applyDowngradeChain(dbDowngrade);

      // RED control on the PRE-FIX chain: 42702 on repeat-before-deadline,
      // expired remediation, and batch; persisted-state rollback proofs.
      const redCode = await runNodeScript(
        join(HERE, 'contracts', 'downgrade_grace.test.mjs'),
        { CLUBS_L4_DATABASE_URL: urlFor(dbDowngrade), CLUBS_L4_DOWNGRADE_PHASE: 'red' },
        'suite downgrade RED control (pre-fix 42702 + rollback proofs)',
      );
      if (redCode !== 0) contractFailures += 1;
      else console.log('[runner] suite downgrade RED control PASS (42702 reproduced, rollback proven)');

      if (redCode === 0) {
        // Apply the ACTUAL forward fix migration to the SAME database/state,
        // then run the GREEN lifecycle (same fixtures, fixed function).
        psqlFile(dbDowngrade, `/repo/supabase/migrations/${DOWNGRADE_FIX_MIGRATION}`, `ACTUAL forward fix ${DOWNGRADE_FIX_MIGRATION}`);
        const greenCode = await runNodeScript(
          join(HERE, 'contracts', 'downgrade_grace.test.mjs'),
          { CLUBS_L4_DATABASE_URL: urlFor(dbDowngrade), CLUBS_L4_DOWNGRADE_PHASE: 'green' },
          'suite downgrade GREEN lifecycle (post-fix)',
        );
        if (greenCode !== 0) contractFailures += 1;
        else console.log('[runner] suite downgrade GREEN lifecycle PASS');
      }
    }

    if (suites.includes('tc03')) {
      console.log('[runner] ── WU-TC03 admin-transfer contract (RED pre-fix → forward fix → GREEN) ──');
      const dbTc03 = `clubs_l4_tc03_${suffix}`;
      await createExtraDatabase(dbB02, dbTc03);
      await applyPlatformAndChain(dbTc03);
      psqlFile(dbTc03, `/repo/supabase/migrations/${TC03_BASE_MIGRATION}`, `TC03 base migration ${TC03_BASE_MIGRATION} (pre-fix state)`);
      // ─────────────────────────────────────────────────────────────────────
      // TEMPORARY TC03 CHAIN COMPATIBILITY — NOT REPLAY PROOF.
      // The B02 chain carries book_clubs.author_id/meeting_type but NOT the
      // author_club CHECK values; those come from the untracked REC-1
      // reconciliation (20260213000000), which cannot replay on this chain
      // (it renames lead_id, absent here). The LIVE project has author_club
      // support (proven in the WU-TC03 context gate: live request RPC author
      // branch + live clubs), so this step restores LIVE PARITY for the
      // author-club contract tests. Authoritative replay repair is owned by
      // L01-D / TEST-07 (same category as the wave2 pre-drop above).
      // ─────────────────────────────────────────────────────────────────────
      psqlSql(
        dbTc03,
        `ALTER TABLE public.book_clubs DROP CONSTRAINT IF EXISTS book_clubs_club_type_check;
         ALTER TABLE public.book_clubs ADD CONSTRAINT book_clubs_club_type_check
           CHECK (club_type IN ('public', 'approval', 'invite_only', 'author_club'));
         ALTER TABLE public.book_clubs DROP CONSTRAINT IF EXISTS book_clubs_author_club_check;
         ALTER TABLE public.book_clubs ADD CONSTRAINT book_clubs_author_club_check
           CHECK ((club_type = 'author_club' AND author_id IS NOT NULL) OR (club_type <> 'author_club' AND author_id IS NULL));`,
        'TEMPORARY tc03 chain-compat: author_club CHECK live-parity substrate (REC-1 gap — L01-D/TEST-07 owns replay repair)',
      );

      // RED control on the PRE-FIX chain: valid request works, valid accept
      // hits the single-admin invariant, persisted state provably untouched.
      const redCode = await runNodeScript(
        join(HERE, 'contracts', 'admin_transfer.test.mjs'),
        { CLUBS_L4_DATABASE_URL: urlFor(dbTc03), CLUBS_L4_TC03_PHASE: 'red' },
        'suite tc03 RED control (pre-fix invariant failure + rollback proof)',
      );
      if (redCode !== 0) contractFailures += 1;
      else console.log('[runner] suite tc03 RED control PASS (invariant failure reproduced, rollback proven)');

      if (redCode === 0) {
        // Apply the ACTUAL forward fix migration to the SAME database/state,
        // then run the GREEN contract matrix (same fixtures, fixed function).
        psqlFile(dbTc03, `/repo/supabase/migrations/${TC03_FIX_MIGRATION}`, `ACTUAL forward fix ${TC03_FIX_MIGRATION}`);
        const greenCode = await runNodeScript(
          join(HERE, 'contracts', 'admin_transfer.test.mjs'),
          { CLUBS_L4_DATABASE_URL: urlFor(dbTc03), CLUBS_L4_TC03_PHASE: 'green' },
          'suite tc03 GREEN contract matrix (post-fix)',
        );
        if (greenCode !== 0) contractFailures += 1;
        else console.log('[runner] suite tc03 GREEN contract matrix PASS');
      }
    }

    if (suites.includes('tc04')) {
      console.log('[runner] ── WU-TC04 book-workflow contract (RED pre-fix → forward fix → GREEN) ──');
      const dbTc04 = `clubs_l4_tc04_${suffix}`;
      await createExtraDatabase(dbB02, dbTc04);
      await applyTc04Chain(dbTc04);

      const redCode = await runNodeScript(
        join(HERE, 'contracts', 'book_workflow.test.mjs'),
        { CLUBS_L4_DATABASE_URL: urlFor(dbTc04), CLUBS_L4_TC04_PHASE: 'red' },
        'suite tc04 RED control (pre-fix 23505 + three bypasses)',
      );
      if (redCode !== 0) contractFailures += 1;
      else console.log('[runner] suite tc04 RED control PASS (all four defects reproduced)');

      if (redCode === 0) {
        psqlFile(dbTc04, `/repo/supabase/migrations/${TC04_FIX_MIGRATION}`, `ACTUAL forward fix ${TC04_FIX_MIGRATION}`);
        const greenCode = await runNodeScript(
          join(HERE, 'contracts', 'book_workflow.test.mjs'),
          { CLUBS_L4_DATABASE_URL: urlFor(dbTc04), CLUBS_L4_TC04_PHASE: 'green' },
          'suite tc04 GREEN contract matrix (post-fix)',
        );
        if (greenCode !== 0) contractFailures += 1;
        else console.log('[runner] suite tc04 GREEN contract matrix PASS');

        if (greenCode === 0 && tc04Mutation) {
          console.log(`[runner] ── RED-proof: --mutation ${tc04Mutation} ──`);
          tempDir = mkdtempSync(join(tmpdir(), 'clubs-l4-mutation-'));
          const overlayPath = tc04MutationOverlay(tempDir, tc04Mutation);
          const dbMutName = `clubs_l4_tc04mut_${suffix}`;
          await createExtraDatabase(dbB02, dbMutName);
          await applyTc04Chain(dbMutName);
          await applyTc04MutationOverlay(dbMutName, overlayPath, tc04Mutation);
          const mutCode = await runNodeScript(
            join(HERE, 'contracts', 'book_workflow.test.mjs'),
            { CLUBS_L4_DATABASE_URL: urlFor(dbMutName), CLUBS_L4_TC04_PHASE: 'green' },
            `suite tc04 MUTATED (${tc04Mutation}): GREEN expected to go RED`,
          );
          if (mutCode === 1) {
            console.log(`[runner] RED PROOF PASS: GREEN correctly FAILED under ${tc04Mutation} (guard is load-bearing)`);
          } else {
            console.error(`[runner] RED PROOF FAIL: GREEN did NOT fail under ${tc04Mutation} — harness insensitive to the guarded regression`);
            contractFailures += 1;
          }
        }
      }
    }

    if (suites.includes('rls')) {
      console.log('[runner] ── L01-C RLS contracts (B01 Storage + representative Clubs) ──');
      await createExtraDatabase(dbB02, dbRls);
      await applyRlsChain(dbRls);
      const rlsScripts = [
        [join(HERE, 'contracts', 'b01_storage_rls.test.mjs'), 'B01 Storage RLS (club-banners)'],
        [join(HERE, 'contracts', 'representative_clubs_rls.test.mjs'), 'representative Clubs RLS (club_messages active vs muted)'],
      ];
      for (const [scriptPath, label] of rlsScripts) {
        const code = await runNodeScript(scriptPath, { CLUBS_L4_DATABASE_URL: urlFor(dbRls) }, `suite ${label}`);
        if (code !== 0) contractFailures += 1;
        else console.log(`[runner] suite ${label} PASS`);
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
    console.error(`[runner] L01 result: FAIL (${contractFailures} suite(s) failed)`);
    process.exit(1);
  }
  console.log(`[runner] L01 result: PASS (${suites.join(' + ')})`);
}

main().catch((e) => {
  if (e instanceof InfraError) {
    console.error(`[runner] INFRASTRUCTURE FAILURE: ${e.message}`);
    process.exit(2);
  }
  console.error('[runner] UNEXPECTED FAILURE:', e);
  process.exit(2);
});
