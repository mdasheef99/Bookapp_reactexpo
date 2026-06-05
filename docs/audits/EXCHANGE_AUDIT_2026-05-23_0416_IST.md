# Exchange Audit Report

Date: 2026-05-23 04:16:10 IST
Project: Bookconnect Expo
Live Supabase project: Bookconnect_reactexpo (`ahntbtktjjmvfosgkmgn`)
Scope: Exchange listings, transactions, transaction events, credit flow touchpoints, storage policies, browser smoke checks, and recently applied Exchange hardening migration.

## Executive Summary

The Exchange feature is functionally close, and the first stabilization pass fixed several app-level issues around draft listing creation, ownership-safe listing deletes, default address races, cache invalidation, and wishlist/borrowed books appearing in listing creation.

The remaining risk is mostly database/API hardening rather than UI behavior. The live database has security-definer RPCs that own the transaction and credit state machine, but several of those functions are executable by `anon`, lack a pinned `search_path`, and accept user ids as parameters without consistently checking `auth.uid()`. There is also live schema drift: important RPC definitions exist in the live database but are not fully represented in checked-in migrations, which makes future rebuilds and reviews unreliable.

No migrations were applied as part of this audit document.

## Evidence Reviewed

- Live Supabase metadata for Exchange tables, RLS policies, constraints, indexes, function grants, and storage policies.
- App code paths under `src/features/exchange`.
- Edge functions under `supabase/functions/complete-transaction` and `supabase/functions/transfer-credits`.
- Migration files under `supabase/migrations`.
- Browser smoke checks on `http://localhost:8081/library`, `http://localhost:8081/exchange`, and `http://localhost:8081/exchange/create`.
- Focused Exchange test results from the prior implementation pass: 13 suites and 40 tests passed.

## Findings

### Critical: Core Exchange RPCs allow anonymous execution

The following live functions are `SECURITY DEFINER`, executable by `anon`, and executable by `authenticated`:

- `request_transaction(uuid, uuid, text, text, uuid)`
- `approve_transaction(uuid, uuid)`
- `decline_transaction(uuid, uuid)`
- `cancel_transaction(uuid, uuid)`
- `complete_transaction(uuid, uuid)`
- `transition_transaction_status(uuid, text, uuid)`

Their ACLs include `anon=X` and public-style execute grants. They rely on supplied `p_actor_id` or `p_borrower_id` values for authorization, but do not consistently validate those values against `auth.uid()`.

Impact: an unauthenticated or incorrectly authenticated caller may be able to invoke transaction state-machine functions directly if they know or guess valid UUIDs. The functions still perform participant/status checks, so this is not an unrestricted write-anything path, but the exposure is much broader than intended.

Recommended migration:

- Revoke execute from `PUBLIC` and `anon`.
- Grant execute only to `authenticated` and `service_role`.
- Add `auth.uid()` checks inside client-callable RPCs, especially where actor or borrower ids are passed by the app.
- Pin `search_path` for each `SECURITY DEFINER` function.

### Critical: Credit RPCs expose privileged balance operations

The following credit functions are also callable by `anon`:

- `grant_signup_bonus(uuid)`
- `place_hold(uuid, uuid, numeric)`
- `release_hold(uuid, uuid, text)`
- `transfer_credits(uuid, uuid, integer, text, uuid)`
- `update_credit_balance()`

`transfer_credits` has `search_path=public`, but still has `anon` execute. `grant_signup_bonus`, `place_hold`, `release_hold`, and `update_credit_balance` do not have a pinned `search_path`.

The most important app-level touchpoint is `app/(auth)/setup-profile.tsx`, which directly calls `grant_signup_bonus` with the current user id. The live function is idempotent by user id, but it does not verify `auth.uid() = p_user_id`.

Impact: credit creation and credit hold/release behavior should be tightly controlled because the Exchange economy depends on it. Anonymous grants here are not appropriate.

Recommended migration:

- Revoke execute from `PUBLIC` and `anon` for all credit RPCs.
- For `grant_signup_bonus`, require `auth.uid() = p_user_id`.
- Consider allowing only `authenticated` for `grant_signup_bonus` and only service/RPC-internal usage for hold/release/transfer functions.
- Do not expose trigger function `update_credit_balance()` as directly executable.

### High: Transaction event audit log is directly insertable by participants

Live `transaction_events` policies include:

- `Participants can create transaction events` for `INSERT`
- `Participants can view transaction events` for `SELECT`
- `Participants can view their transaction events` for `SELECT`

The app code search did not find direct client inserts into `transaction_events`; events are written by RPCs and migrations. That means the direct participant insert policy appears unnecessary.

Impact: users should not be able to fabricate audit trail events directly. The canonical source should be transaction RPCs or service-side code.

Recommended migration:

- Drop `Participants can create transaction events`.
- Keep one participant read policy.
- Ensure all event writes happen inside trusted transaction RPCs.

### High: Live-only RPC definitions create migration drift

The live database contains important Exchange and credit RPC definitions that are not fully represented in the migration history currently in the repository. The checked-in migrations define the original tables, newer dispute/rating functions, and the recent hardening patch, but the central transaction/credit functions appear to exist as live state.

Impact: a fresh environment rebuilt from migrations may not match production. This also makes code review harder because live behavior is not fully visible in source control.

Recommended migration work:

- Export current live definitions for the transaction and credit RPCs.
- Reconcile them into checked-in migrations.
- Add follow-up hardening changes in a separate cleanup migration so behavior changes are reviewable.

### Medium: Duplicate RLS policies make the live schema harder to reason about

Live duplicate policy names/behaviors were found:

- `user_addresses`: older `Users can add/update/delete addresses` policies overlap with newer `Users can create/update/delete their own addresses`.
- `transaction_events`: two participant `SELECT` policies overlap.

Impact: not currently a functional bug, but it increases audit noise and future migration risk.

Recommended migration:

- Drop the older duplicate `user_addresses` policies.
- Drop one duplicate `transaction_events` `SELECT` policy.

### Medium: `set_default_user_address` is safer functionally, but still too broadly executable

The live `set_default_user_address(uuid, uuid)` function is `SECURITY INVOKER`, has `search_path=public`, and validates `auth.uid() = p_user_id`. That part is good. However, it still shows `anon` execute.

Impact: the `auth.uid()` check should block anonymous calls in practice, but the grant should still be tightened for clarity and defense in depth.

Recommended migration:

- Revoke execute from `PUBLIC` and `anon`.
- Grant execute to `authenticated` and `service_role`.

### Medium: Storage policies are mostly sound, but one bucket has overlapping broad policies

Buckets checked:

- `listing-photos`: public bucket, 5 MB limit, JPEG/PNG/WebP only.
- `profile-avatars`: public bucket, 5 MB limit, JPEG/PNG/WebP only.
- `club-banners`: public bucket, 5 MB limit, JPEG/PNG/WebP only.

`listing-photos` and `profile-avatars` use owner-folder policies for insert/update/delete and public read. That matches the current app upload paths.

`club-banners` has both broad authenticated insert/update policies and owner-folder insert/update/delete policies. This is outside Exchange, but it is a nearby storage cleanup item.

Recommended migration:

- Leave `listing-photos` as-is for Exchange.
- Review and simplify `club-banners` policies separately.

### Medium: Edge functions validate callers, but are partly redundant with client RPC calls

`complete-transaction` verifies the JWT, checks `actor_id` equals the authenticated user, then calls `complete_transaction` using the service role.

`transfer-credits` verifies the JWT and checks `admin_id` equals the authenticated user, then calls `transfer_credits` using the service role. It does not verify an admin role or authorization level beyond identity match in the edge function code reviewed.

The current app service also calls `complete_transaction` directly from the client, so the edge function is not the only path.

Recommended cleanup:

- Decide whether transaction completion should go through direct authenticated RPC or the edge function, then remove or document the alternate path.
- If `transfer-credits` remains admin-only, add an explicit admin authorization check before service-role execution.

### Low: UI/browser smoke check passed for the recently changed flows

Browser observations:

- `/library` rendered book data.
- `/exchange` rendered the Exchange browse view, city filtering, delivery filter, and empty state without Exchange-specific console errors.
- `/exchange/create` showed owned books only; a wishlist book observed in the library did not appear in create-listing choices.
- The create-listing submit path was not exercised because that would create live listing/storage data during a migration audit.

### Low: Global TypeScript still has unrelated failures

Focused Exchange tests passed after the implementation changes. Global `tsc --noEmit` still fails due existing Clubs/Supabase test typing issues outside this Exchange audit.

## Current Live DB Snapshot

### Exchange RLS

- `listings`: owner-scoped update/delete, owner insert tied to `user_books`, active listings visible in matching city or to owner.
- `transactions`: insert by borrower, select by participants, direct updates blocked by `No direct transaction updates`.
- `transaction_events`: participant read, plus currently participant insert.
- `transaction_ratings`: participant rating insert for completed opposite-party transactions, scoped read.
- `user_addresses`: scoped read plus duplicate insert/update/delete policy sets.

### Exchange Constraints and Indexes

- `listings_photos_check`: requires 2 to 4 photos.
- `transactions_status_check`: includes `cancelled`.
- `transactions_delivery_type_check`: `porter`, `dunzo`, `meetup`.
- `transactions_no_self_lend`: prevents self-lending.
- `transaction_ratings_transaction_id_from_user_id_key`: prevents duplicate rating from the same user for a transaction.
- `user_addresses_one_default_per_user`: unique partial index for one default address per user.

### Recent Applied Migration

`20260522053238_harden_exchange_schema.sql` has been applied to the live project. Verified live effects include:

- `cancelled` added to transaction status constraint.
- Direct transaction updates blocked by policy.
- `set_default_user_address` exists.
- One-default-address partial unique index exists.

## Recommended Cleanup Migration Plan

Phase 1: low-risk grants and policy cleanup

- Revoke `PUBLIC`/`anon` execute from exposed Exchange and credit RPCs.
- Grant intended functions to `authenticated` and `service_role`.
- Drop duplicate `user_addresses` policies.
- Drop duplicate `transaction_events` read policy.
- Drop direct participant insert policy on `transaction_events`.
- Add `search_path=public` to exposed `SECURITY DEFINER` functions.

Phase 2: authorization hardening inside RPC bodies

- Add `auth.uid()` checks to client-callable transaction RPCs.
- Add `auth.uid() = p_user_id` to `grant_signup_bonus`.
- Confirm hold/release/transfer functions are not directly client-callable unless intentionally designed that way.

Phase 3: migration reconciliation

- Export current live RPC definitions into source-controlled migrations.
- Rebuild a fresh branch or local database from migrations and compare schema/function output to live.

Phase 4: product and admin-flow decisions

- Decide whether `complete_transaction` is client RPC or edge-function only.
- Add admin role checks for `transfer-credits` if the edge function remains available.
- Review non-Exchange storage policy overlap for `club-banners`.

## Suggested Next Step

Before applying another migration, create a cleanup migration draft that only tightens grants, removes duplicate policies, pins `search_path`, and avoids RPC body rewrites. Then review a second migration for behavioral authorization changes, especially around `auth.uid()` checks and credit functions.
