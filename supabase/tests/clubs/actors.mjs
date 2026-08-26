/**
 * CLUB-WU-L01 · clubs L4 actor support
 *
 * L01-A scope: only the ADMIN/CREATOR (Pro) actor that the B02
 * concurrency contract needs. The exported surface is intentionally
 * actor-shaped so later L01 slices can add more actor kinds without a
 * redesign: every helper takes an explicit `Client` and works through
 * REAL repository objects only (auth.users shim row, user_profiles,
 * public.create_club). No production data is referenced; all ids are
 * generated UUIDs.
 *
 * L01-B extends with ADMIN, MODERATOR, ACTIVE MEMBER, OUTSIDER,
 * CROSS-CLUB MEMBER helpers. All helpers preserve L01-A behavior.
 */
import { randomUUID } from 'node:crypto';

const ACTOR_GUC = 'request.jwt.claim.sub';

/**
 * Set the acting auth user on a connection using the agreed
 * parameterized GUC shim (same contract as Supabase GoTrue / F04).
 * @param {import('pg').PoolClient | import('pg').Client} client
 * @param {string} userId
 */
export async function actAs(client, userId) {
  await client.query('SELECT set_config($1, $2, false)', [ACTOR_GUC, userId]);
}

/**
 * Ensure an actor exists with the requested membership tier.
 * L01-A uses tier 'pro' only.
 *
 * @param {import('pg').PoolClient | import('pg').Client} client observer/admin connection
 * @param {{ tier?: string, displayName?: string, city?: string }} [opts]
 * @returns {Promise<{ userId: string, tier: string }>}
 */
export async function ensureActor(client, opts = {}) {
  const userId = randomUUID();
  const tier = opts.tier ?? 'pro';
  const displayName = opts.displayName ?? `L4 Actor ${userId.slice(0, 8)}`;
  const city = opts.city ?? 'Testville';

  await client.query('INSERT INTO auth.users (id) VALUES ($1)', [userId]);

  // user_profiles requires display_name + city NOT NULL (migration 001);
  // membership_tier drives get_user_membership_tier() (migration 013).
  await client.query(
    `INSERT INTO user_profiles (user_id, display_name, city, email, membership_tier)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, displayName, city, `${userId}@clubs-l4.invalid`, tier],
  );

  return { userId, tier };
}

/**
 * Create qualifying clubs THROUGH THE REAL create_club RPC path so they
 * count exactly the way production counts toward the admin cap.
 *
 * @param {import('pg').PoolClient | import('pg').Client} client connection acting as the actor
 * @param {string} actorUserId
 * @param {number} count
 * @param {{ namePrefix?: string }} [opts]
 * @returns {Promise<string[]>} created club ids in creation order
 */
export async function createQualifyingClubs(client, actorUserId, count, opts = {}) {
  const prefix = opts.namePrefix ?? 'L4 Cap Fixture Club';
  const clubIds = [];
  for (let i = 0; i < count; i += 1) {
    const res = await client.query(
      `SELECT (public.create_club(
         $1::text,   -- p_name
         $2::text,   -- p_description
         NULL::text, -- p_cover_url
         'public',   -- p_club_type
         'all',      -- p_access_level
         NULL::text, -- p_meeting_type
         $3::uuid,   -- p_admin_id
         NULL::uuid, -- p_current_book_id
         NULL::int,  -- p_max_members
         NULL::uuid  -- p_author_id
       )).id AS club_id`,
      [`${prefix} ${i + 1}`, 'B02 cap fixture club', actorUserId],
    );
    clubIds.push(res.rows[0].club_id);
  }
  return clubIds;
}

/**
 * Count active, non-archived clubs owned/administered by the actor —
 * the exact population the B02 entitlement trigger counts.
 *
 * @param {import('pg').PoolClient | import('pg').Client} client
 * @param {string} actorUserId
 */
export async function countQualifyingClubs(client, actorUserId) {
  const res = await client.query(
    `SELECT count(*)::int AS n
       FROM public.book_clubs
      WHERE admin_id = $1
        AND COALESCE(is_archived, FALSE) = FALSE`,
    [actorUserId],
  );
  return res.rows[0].n;
}

/**
 * Ensure an active club membership for `userId` in `clubId`.
 * Direct INSERT to bypass RLS; validates against enforce_club_member_entitlement.
 * Caller must ensure tier satisfies access_level.
 */
export async function ensureClubMember(client, clubId, userId, role = 'member', status = 'active') {
  await client.query(
    `INSERT INTO public.club_members (club_id, user_id, role, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (club_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status`,
    [clubId, userId, role, status],
  );
}
