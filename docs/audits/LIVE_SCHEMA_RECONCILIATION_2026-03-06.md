# Live Schema Reconciliation - 2026-03-06

Canonical source: live Supabase project `ahntbtktjjmvfosgkmgn`.

## Verified from the live database

- **Applied migrations:** 13
- **App-facing public tables:** 31 (`spatial_ref_sys` excluded)
- **App-relevant public SECURITY DEFINER routines:** 14
- **Public RLS policies:** 94
- **Storage policies:** 12
- **Storage buckets:** `listing-photos`, `profile-avatars`, `club-banners`

## Live migration sequence

1. `20251228083154_001_initial_schema`
2. `20251228114030_002_p2p_exchange_system`
3. `20251228114057_003_venues_and_clubs`
4. `20251228114118_004_chat_and_moderation`
5. `20251228114143_005_add_missing_user_profile_fields`
6. `20251228114353_006_rls_policies_core_tables`
7. `20251228114414_007_rls_policies_exchange_system`
8. `20251228114444_008_rls_policies_venues_clubs`
9. `20251228114516_009_rls_policies_chat_moderation`
10. `20251231141336_add_all_google_books_fields`
11. `20251231142005_add_price_to_books`
12. `20260101105319_create_user_wishlist`
13. `20260212150120_create_reading_notes`

## Highest-risk drift confirmed

### 1. Local migration history drift

- Live DB has 13 applied migrations.
- Repo previously had only 2 checked-in migration SQL files in `supabase/migrations/`.
- Older docs still describe a 5-migration plan that is no longer canonical.

### 2. Table naming drift

| Live database | Older docs / assumptions |
|---|---|
| `event_rsvps` | `club_event_rsvps`, `club_event_attendees` |
| `member_reading_progress` | `member_progress`, `club_reading_milestones` |
| `user_wishlist` | `wishlists` |

### 3. Live table set vs outdated docs

The live DB includes these app tables that older status docs under-report or omit:

- `book_nominations`
- `club_complaints`
- `club_join_applications`
- `club_join_questions`
- `club_member_actions`
- `club_venues`
- `event_rsvps`
- `member_reading_progress`
- `reading_schedules`
- `user_push_tokens`

The `docs/audits/PROJECT_STATUS_2026-02-17.md` table inventory also lists non-live tables such as:

- `club_event_attendees`
- `reading_challenges`
- `challenge_participants`
- `club_discussions`
- `discussion_replies`
- `venue_reviews`
- `wishlists`
- `notifications`
- `reports`
- `membership_tiers`
- `app_config`

### 4. Column naming drift in live clubs/chat schema

| Live database | Older docs |
|---|---|
| `club_events.start_time` | `club_events.starts_at` |
| `club_events.meeting_link` | `club_events.meeting_url` |
| `club_messages.chapter_tag` | `club_messages.chapter_reference` |
| `club_messages.has_spoiler` | `club_messages.is_spoiler` |

### 5. Constraint / enum drift

- `club_members.status` is live as `active | muted | banned`
- `club_members.role` is live as `member | moderator | admin`
- `book_clubs.club_type` is live as `public | approval | invite_only | author_club`
- `club_events.event_type` is live as `online | offline | ama | virtual_signing`

### 6. Foreign-key drift that must be preserved

Verified live FK targets:

- `listings.owner_id -> user_profiles.user_id`
- `transactions.lender_id -> user_profiles.user_id`
- `transactions.borrower_id -> user_profiles.user_id`
- `reading_notes.user_id -> auth.users.id`
- `user_wishlist.user_id -> auth.users.id`
- `book_clubs.author_id -> user_profiles.id`

This means the project status audit is only partially correct: **some** user-referencing FKs moved to `user_profiles(user_id)`, but not all of them.

### 7. Routine count drift

Older docs describe fewer deployed DB functions than currently exist. Verified live routines:

- `grant_signup_bonus`
- `place_hold`
- `release_hold`
- `request_transaction`
- `approve_transaction`
- `decline_transaction`
- `cancel_transaction`
- `complete_transaction`
- `transition_transaction_status`
- `transfer_credits`
- `update_credit_balance`
- `update_member_count`
- `update_vote_count`
- `update_trust_score`

## Codebase alignment status

### Already aligned to live DB

- `src/features/exchange/services/transactionsService.ts` matches live transaction statuses and delivery types.
- `src/features/exchange/services/listingsService.ts` matches live listing statuses and conditions.
- `src/features/credits/services/creditService.ts` matches live `credit_events` enums.
- `src/hooks/useWishlist.ts` correctly used `user_wishlist` at the time of this 2026-03-06 reconciliation. As of the 2026-03-12 Library remediation, app-side wishlist handling has been standardized on `user_books.ownership = 'wishlist'`; the live `user_wishlist` table still exists.

### Recently aligned before this reconciliation

- `src/features/clubs/services/clubsService.ts` was updated to match live clubs schema, including `club_members.status = active | muted | banned` and the live club creation limits flow.

### No additional non-OTP runtime code changes were required in this reconciliation pass

Current drift is primarily in:

- missing local migration/source-of-truth artifacts
- outdated migration/docs references
- a legacy manual migration script that is not part of live history