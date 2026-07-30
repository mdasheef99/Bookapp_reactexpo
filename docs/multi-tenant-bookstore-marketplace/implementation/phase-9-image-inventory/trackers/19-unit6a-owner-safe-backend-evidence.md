# Unit 6A Owner-Safe Backend Evidence

**Status:** `live_verified_merge_ready`
**Date:** 2026-07-30

## Frozen finding receipt

| ID | Finding | Verdict | Resolution |
| --- | --- | --- | --- |
| F1 | Closed-session queue timestamp fence | valid/high | persisted status plus candidate retention only |
| F2 | Unit 7 close-summary reads hard-coded to zero | valid/high | bounded read-only outcomes; no Unit 7 mutation |
| F3 | malformed RPC response mapped as request error | valid/high | response-contract failure maps to `P9_INTERNAL_ERROR` |
| F4 | response DTO bounds/enums incomplete | valid/high | strict catalogue schemas |
| F5 | numeric `ownerUx.ts` size | rejected | not independently blocking |
| F6 | SQL mixed-script bypass | valid/high | direct RPC rejects mixed script |
| F7 | nondeterministic concurrency harness | valid/high | advisory barriers and diagnostics |

## Test receipt

- Unit 6A Jest: PASS, 3 suites, 173/173 tests.
- Unit 6A PGlite: PASS, 32/32 tests.
- Relevant ingestion/variant Jest: PASS, 5 suites, 50/50 tests.
- Disposable PostgreSQL 18.4 loaded M01-M29; mixed-script probe returned `false`; deterministic concurrency passed three consecutive runs.
- Scoped TypeScript: PASS. Repository-wide TypeScript timed out without diagnostics and is not claimed as passing.
- Phase 9 continuity: PASS, 195 definitions, zero duplicates/missing, 58 Markdown files, 43 required phase files.

Before the live-application continuation, M29 was local and unapplied. No deployment, provider call, Unit 6B, or Unit 7 work occurred.

## Live-application continuation (2026-07-30)

- Exact project re-verified: `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`, `ACTIVE_HEALTHY`).
- Exact unchanged M29 (`SHA-256 E01D0555DD171C406A33B1FB6761E0490815172E6A7BD9F0DA25A2E369B86C26`) applied once as live migration `20260730162700 marketplace_phase9_owner_safe_contracts`.
- The original `INVALID_ARGUMENT` was `PAYLOAD_SERIALIZATION`: a shell-output intermediary truncated the 68,197-byte SQL body to 40,092 characters. The corrected approved call reconstructed the full ASCII artifact from bounded base64 reads and returned `success: true`.
- Post-apply readback confirms all eight public RPCs are postgres-owned `SECURITY DEFINER` functions with empty `search_path`, authenticated-only execution, and no anon/PUBLIC execution; internal helpers are non-callable by anon/authenticated/PUBLIC; affected private relations retain RLS and deny authenticated base-table SELECT.
- The initial MCP-only live RPC attempt was blocked because `execute_sql`
  returned `INVALID_ARGUMENT` for direct invocation. No fixture was created by
  that attempt; the later authenticated client smoke below supersedes this
  transport limitation.

## Authenticated smoke continuation and retained audit evidence (2026-07-30)

- The repository `.env` URL and public key plus the process service-role key were
  verified as compatible with project `ahntbtktjjmvfosgkmgn`; the unrelated
  process-level `SUPABASE_URL`/anonymous key were not used for the corrected run.
- The first client attempt established the retained synthetic namespace but
  stopped on a fixture-only `phase9_input_validation_state_coherence`
  violation. The corrected input supplied the required media and hash fields;
  M29 was unchanged.
- Password email login is disabled. Admin-generated one-time links were
  exchanged through the project publishable client to obtain ordinary
  authenticated sessions. Service-role authority was limited to fixture
  setup, inspection, and cleanup.
- PASS, 21/21 bounded receipts: initiating Owner; all six Owner-safe reads and
  private-base-table denial; same-store noninitiating Owner, cross-store Owner,
  staff, and manager denial; random and foreign candidate non-enumeration; DTO
  privacy; valid review/version increment; stale candidate and metadata
  revisions; exact review replay; changed-request/same-key rejection;
  readiness; nonterminal Close rejection; terminal Close; exact Close replay;
  new-key-after-close rejection; and Unit 7 noninterference.
- Post-smoke readback proves zero memberships, sessions, inputs, candidates,
  jobs, smoke media, idempotency rows, review-scope rows, temporary Auth users,
  inventory, listings, public store profiles, holds, carts/cart items, order
  requests/items, clarifications, photo requests, support notes, refunds,
  settlements, reconciliation cases, and commerce observations.
- `retained_immutable_synthetic_audit_evidence`: two marketplace events and
  their minimum referential store/Auth anchors remain under explicit user
  authorization. Retention is required by approved append-only constraints and
  is not operational residue. The store is closed/non-selling with no public
  profile or membership; the Auth user is banned.
- No append-only trigger was disabled or bypassed. No M29 change, migration,
  deployment, Unit 6B, or Unit 7 work occurred.

## Next authorized action

Closure review: `UNIT6A_CLOSURE_APPROVED`. F1-F7 are resolved or correctly
rejected. Authenticated live verification and the approved retained-evidence
cleanup policy pass. Unit 6A is merge-ready; the next action is the bounded
evidence commit, feature-branch push, and fast-forward merge/push of `main`.
No deployment, Unit 6B, or Unit 7 work is authorized.
