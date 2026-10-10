#!/usr/bin/env node
/**
 * CLUB-WU-F04 — concurrency probe for set_club_discussion_reaction (PRODUCT-12).
 * HOW TO RUN (disposable Postgres 17 ONLY — never the shared Supabase project):
 *   psql "$DATABASE_URL" -f supabase/tests/f04_fixture.sql
 *   psql "$DATABASE_URL" -f supabase/migrations/20260824100000_clubs_f04_reaction_single_reaction_invariant.sql
 *   DATABASE_URL=postgres://user:pass@host:5432/db node supabase/tests/f04_concurrency.mjs
 * Cases: A) empty target + concurrent sets, different emojis -> 1 row;
 *        B) existing reaction + concurrent replacements -> 1 row;
 *        C) same actor / different topics concurrently -> 2 rows;
 *        D) different actors / same topic concurrently -> 2 rows.
 * Exit 0 = pass; exit 1 = any failure or any 23505 reaching a caller.
 * Cleanup removes only rows this run created (tracked ids).
 */
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

// max=4: two dedicated transaction clients + spare connections so verification
// queries (pool.query) never starve while both tx clients are held open.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const failures = [];
const state = { userIds: [], topicIds: [], reactionIds: [] };
const settle = (p) => p.then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }));
const check = (cond, msg) => { if (!cond) failures.push(msg); };
async function asActor(client, userId, fn) {
    await client.query('BEGIN');
    try {
        // set_config(...,true) instead of interpolated SET LOCAL: portable and injection-safe.
        await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
        const out = await fn();
        await client.query('COMMIT');
        return out;
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
    }
}

async function setReaction(client, topicId, emoji) {
    const sql = 'SELECT * FROM public.set_club_discussion_reaction($1::uuid, NULL::uuid, $2::text)';
    const res = await client.query(sql, [topicId, emoji]);
    for (const row of res.rows) state.reactionIds.push(row.id);
    return res;
}

const survivorOf = async (topicId, userId) => (await pool.query(
    'SELECT count(*)::int AS n, min(emoji) AS emoji FROM club_discussion_reactions WHERE topic_id = $1 AND user_id = $2',
    [topicId, userId],
)).rows[0];

async function runPair(label, work1, work2, verify) {
    const [r1, r2] = await Promise.all([settle(work1()), settle(work2())]);
    check(![r1.e?.code, r2.e?.code].includes('23505'), `${label}: 23505 unique violation reached a caller`);
    check(r1.ok && r2.ok, `${label}: a caller failed (${r1.e?.code ?? 'ok'}, ${r2.e?.code ?? 'ok'})`);
    await verify(r1.ok && r2.ok);
}
async function cleanup() {
    if (state.reactionIds.length) await pool.query('DELETE FROM club_discussion_reactions WHERE id = ANY($1::uuid[])', [state.reactionIds]);
    if (state.topicIds.length) await pool.query('DELETE FROM club_discussion_topics WHERE id = ANY($1::uuid[])', [state.topicIds]);
    if (state.userIds.length) await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [state.userIds]);
}
async function main() {
    const [c1, c2] = await Promise.all([pool.connect(), pool.connect()]); // two independent clients
    try {
        const [actorA, actorB] = [randomUUID(), randomUUID()];
        const [t1, t2, t3] = [randomUUID(), randomUUID(), randomUUID()];
        state.userIds.push(actorA, actorB);
        state.topicIds.push(t1, t2, t3);
        await pool.query('INSERT INTO auth.users (id) VALUES ($1), ($2)', [actorA, actorB]);
        await pool.query('INSERT INTO club_discussion_topics (id, title) VALUES ($1, $4), ($2, $4), ($3, $4)', [t1, t2, t3, 'F04 concurrency probe']);
        // A) empty target: actorA sets ❤️ and 🔥 concurrently -> exactly 1 row, emoji ∈ offered set.
        await runPair('A',
            () => asActor(c1, actorA, () => setReaction(c1, t1, '❤️')),
            () => asActor(c2, actorA, () => setReaction(c2, t1, '🔥')),
            async (callersOk) => {
                const s = await survivorOf(t1, actorA);
                check(callersOk && s.n === 1, `A: expected 1 surviving row, found ${s.n}`);
                check(s.emoji === '❤️' || s.emoji === '🔥', `A: surviving emoji "${s.emoji}" not among offered set`);
            });

        // B) existing reaction (👍 seeded first): concurrent replacements ❤️/😂 -> exactly 1 row.
        await asActor(c1, actorA, () => setReaction(c1, t1, '👍'));
        await runPair('B',
            () => asActor(c1, actorA, () => setReaction(c1, t1, '❤️')),
            () => asActor(c2, actorA, () => setReaction(c2, t1, '😂')),
            async (callersOk) => {
                const s = await survivorOf(t1, actorA);
                check(callersOk && s.n === 1, `B: expected 1 surviving row, found ${s.n}`);
                check(s.emoji === '❤️' || s.emoji === '😂', `B: surviving emoji "${s.emoji}" not among replacement set`);
            });

        // C) same actor, different topics concurrently (t1, t2) -> 1 row each, both succeed.
        await runPair('C',
            () => asActor(c1, actorB, () => setReaction(c1, t1, '👏')),
            () => asActor(c2, actorB, () => setReaction(c2, t2, '😮')),
            async (callersOk) => {
                const s1 = await survivorOf(t1, actorB);
                const s2 = await survivorOf(t2, actorB);
                check(callersOk && s1.n === 1 && s2.n === 1, `C: expected 1 row per topic, got t1=${s1.n} t2=${s2.n}`);
            });

        // D) different actors, same topic concurrently (t3) -> 1 row each, both succeed.
        await runPair('D',
            () => asActor(c1, actorA, () => setReaction(c1, t3, '🤔')),
            () => asActor(c2, actorB, () => setReaction(c2, t3, '📚')),
            async (callersOk) => {
                const sA = await survivorOf(t3, actorA);
                const sB = await survivorOf(t3, actorB);
                check(callersOk && sA.n === 1 && sB.n === 1, `D: expected 1 row per actor, got A=${sA.n} B=${sB.n}`);
            });

        if (failures.length) { console.error(`FAIL (${failures.length}):\n - ${failures.join('\n - ')}`); process.exitCode = 1; }
        else console.log('PASS: A/B/C/D — replacement invariant held under concurrency, no 23505 reached callers.');
    } finally {
        await cleanup().catch((e) => { console.error('cleanup failed:', e.message); process.exitCode = 1; });
        c1.release(); c2.release();
        await pool.end();
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
