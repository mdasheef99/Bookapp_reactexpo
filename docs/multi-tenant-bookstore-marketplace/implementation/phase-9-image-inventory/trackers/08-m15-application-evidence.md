# Phase 9 M15 Application Evidence

**Date:** 2026-07-28
**Project:** `ahntbtktjjmvfosgkmgn`
**Status:** `live_security_correction_required`

## Application

Correction commit `1168655` was merged to `main`. The checked-in M15 file was
verified as 60,915 bytes, SHA-256
`21c298e77e1008f2fd0fd50b33ede9ec1f74479779cf53679f5bb638dc69d9f4`,
and Git blob `573c11dbe073c31b2729874a011e11413e6969d1`. The complete
file was submitted in one MCP migration operation and applied as
`20260727222159 marketplace_phase9_metadata_foundation`.

## Verification

M15 is present exactly once and M09 remains absent. Live readback confirmed all
columns, constraints, foreign keys, indexes, the immutable snapshot trigger,
eleven private helpers, eight invoker wrappers, fixed search paths, and zero
anon/authenticated table or RPC authority. Corrected claim fencing, local
zero-provider/cost completion, primary/secondary predecessor rules, follower
lineage, aggregate cost, storage/reuse enforcement, uncertain-outcome handling,
and absence of dynamic SQL, inventory, quantity, or publication effects passed.

Focused M15 static tests passed 7/7, focused metadata PGlite passed 10/10, and
the discrepancy-triggered full Phase 9 PGlite suite passed 77/77.

## Security stop

The final direct-grant gate failed. Supabase default privileges created all three
new tables with
`{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`. M15 revoked
PUBLIC, anon, and authenticated, but did not first revoke `service_role`; its
later SELECT grant therefore did not narrow the inherited ACL. RPC-only mutation
and read-only direct service authority are not verified.

No direct grant mutation or M16 was authorized. No persistent test data, Storage
object, provider credential/call, Gemini deployment/call, inventory, quantity,
publication, or other migration mutation occurred.

## Next gate

Separately authorize a forward-only migration that revokes all direct
service-role privileges on the three M15 tables, restores SELECT only, adds
live-default-privilege regression evidence, receives focused independent review,
and is applied and verified before Unit 5B. M09 and Units 5B/5C remain untouched.

## Forward-correction handoff

M16 is now created, locally effective-privilege verified, and independently
approved, but not applied. It covers the three M15 tables and the contractually
RPC-only M14 `vision_provider_attempts` table. Historical M15 application
evidence above is unchanged; the live defect remains until separately authorized
M16 application/readback. See [M16 evidence](./09-m16-acl-correction-evidence.md).
