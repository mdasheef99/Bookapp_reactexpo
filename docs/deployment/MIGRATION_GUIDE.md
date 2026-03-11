# BookTalks Mobile - Database Migration Guide

> Historical note (2026-03-06): this guide does **not** reflect the current live Supabase
> migration history. Use `docs/audits/LIVE_SCHEMA_RECONCILIATION_2026-03-06.md` and
> `supabase/migrations/LIVE_MIGRATION_HISTORY_2026-03-06.md` as the repo-side source of truth.
>
> The sections below describe an older planned migration structure. They are useful for background
> context only and should not be treated as the canonical live migration sequence.

**Last Updated:** 2024-02-14

---

## 1. Overview

BookTalks uses Supabase migrations to manage database schema changes. All migration files are located in `supabase/migrations/` directory.

**Current live reality (verified 2026-03-06):**
- Live Supabase has **13 applied migrations**.
- Only 2 migration SQL files were safely recoverable locally and are now versioned to match live history.
- The first 11 historical migration SQL files are still missing locally and have **not** been reconstructed yet.

**⚠️ IMPORTANT:** Do not use the 5-migration list below as the canonical live history. It is an older planning snapshot.

---

## 2. Migration Strategy

### Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- Project linked to Supabase (`supabase link --project-ref <project-id>`)
- Database credentials configured

---

### Running Migrations

**Execute All Migrations:**
```
supabase db push
```

In a fully backfilled repo, this would run the local migration files in order. For the current canonical live sequence, use the live migration history artifact referenced above.

**Execute Single Migration:**
```
supabase migration up --file <migration-file>
```

**Verify Migrations:**
Check Supabase dashboard → Database → Tables to confirm all tables created.

---

### Rollback Strategy

**Rollback Last Migration:**
```
supabase migration down
```

**Manual Rollback:**
Each migration includes rollback SQL in comments. Execute manually if needed.

---

## 3. Migration Details

### Migration 001: Users & Credits

**Purpose:** Core user management and event-sourced credit system

**Tables Created:**
- user_profiles (extends auth.users)
- credit_events (append-only event log)
- user_credit_balances (materialized view)
- referrals
- books (catalog)
- user_books (personal library)
- reading_notes

**Key Features:**
- Event sourcing for credits (immutable audit trail)
- Database trigger to update credit balances automatically
- Referral tracking system
- Full-text search on book titles (GIN index)

**Dependencies:** None (first migration)

---

### Migration 002: P2P Exchange

**Purpose:** Book lending and borrowing system

**Tables Created:**
- listings (books available for lending)
- transactions (exchange transactions)
- transaction_events (event-sourced transaction history)
- user_addresses (delivery addresses)
- transaction_ratings (user ratings)

**Key Features:**
- PostGIS extension for geospatial queries
- City-based listing filtering (intra-city only)
- Transaction state machine (requested → completed)
- Automatic trust score calculation via trigger

**Dependencies:** Migration 001 (requires user_profiles, books, user_books)

---

### Migration 003: Venues & Clubs

**Purpose:** Physical venues and book clubs

**Tables Created:**
- venues (cafes, libraries, bookstores)
- book_clubs (reading clubs)
- club_members (membership and roles)
- club_reading_milestones (chapter progress)
- club_polls (voting system)
- club_poll_votes

**Key Features:**
- PostGIS for venue location storage
- Club membership with roles (member, moderator, admin)
- Reading milestone tracking
- Polling system for club decisions

**Dependencies:** Migration 001 (requires user_profiles, books)

---

### Migration 004: Terminology Update (Lead → Admin)

**Purpose:** Rename "Lead" to "Admin" for consistency

**⚠️ CRITICAL:** This is a breaking change that affects existing data.

**Changes:**
1. Rename `book_clubs.lead_id` to `book_clubs.admin_id`
2. Update `club_members.role` enum: 'lead' → 'admin'
3. Update CHECK constraint on `club_members.role`

**Manual Execution:**
A standalone SQL script `manual_migration_lead_to_admin.sql` is provided at project root for manual execution.

**Impact:**
- All existing clubs retain their leadership structure
- No data loss
- Frontend must update all references from "Lead" to "Admin"
- Edge Functions must use `admin_id` instead of `lead_id`

**Rollback:**
Rollback script included in migration file comments.

**Dependencies:** Migration 003 (requires book_clubs, club_members)

---

### Migration 005: Chat & Moderation

**Purpose:** Real-time chat and club events

**Tables Created:**
- club_messages (chat messages)
- message_reactions (emoji reactions)
- club_events (offline/online events)
- club_event_rsvps (event attendance)
- moderation_actions (content moderation)

**Key Features:**
- Real-time chat with Supabase Realtime
- Spoiler tag support
- Chapter-specific messages
- Event RSVP system
- Moderation action logging

**Dependencies:** Migration 003 (requires book_clubs, club_members, venues)

---

## 4. Row-Level Security (RLS)

All tables enforce RLS policies. Key policies:

**user_profiles:**
- Users can read all profiles
- Users can only update their own profile

**listings:**
- Users can view active listings in their city only
- Users can only update/delete their own listings

**transactions:**
- Only lender and borrower can view transaction details

**credit_events:**
- Users can only view their own credit history

**book_clubs:**
- Only club members can view club details

**club_messages:**
- Only club members can view/send messages
- Real-time subscriptions filtered by club membership

**RLS Policy Creation:**
RLS policies are created in each migration file after table creation.

---

## 5. Database Triggers

### update_credit_balance()

**Trigger:** AFTER INSERT ON credit_events

**Purpose:** Automatically updates user_credit_balances when credit events are inserted

**Logic:**
- signup_bonus, lend_completed, referral_bonus: Increase available credits
- borrow_spent: Increase lifetime_spent
- hold_placed: Move credits from available to held
- hold_released: Move credits from held to available (or deduct if transaction completed)
- admin_adjustment: Adjust available credits

---

### update_trust_score()

**Trigger:** AFTER INSERT OR UPDATE ON transaction_ratings

**Purpose:** Automatically updates user's trust score when rated

**Logic:**
Calculate average rating from all transaction_ratings for user and update user_profiles.trust_score

---

## 6. PostGIS Extension

**Purpose:** Geospatial queries for venue locations and proximity calculations

**Enabled In:** Migration 002

**Usage:**
- Store venue locations as GEOGRAPHY(POINT)
- Query venues within radius using ST_DWithin()
- Calculate distance between addresses using ST_Distance()

**Example Query:**
Find venues within 5km of user location:
```
SELECT * FROM venues
WHERE ST_DWithin(location, ST_MakePoint(lng, lat)::geography, 5000)
```

---

## 7. Migration Checklist

**Before Running Migrations:**
- [ ] Supabase CLI installed and linked
- [ ] Database credentials configured
- [ ] All migration files created in `supabase/migrations/`
- [ ] Backup existing database (if applicable)

**After Running Migrations:**
- [ ] Verify all tables created in Supabase dashboard
- [ ] Test RLS policies (try accessing data as different users)
- [ ] Verify triggers working (insert credit event, check balance update)
- [ ] Test PostGIS queries (venue proximity search)
- [ ] Seed database with test data (optional)

---

## 8. Troubleshooting

**Migration Failed:**
- Check error message in terminal
- Verify migration file syntax (SQL errors)
- Check dependencies (ensure previous migrations ran successfully)
- Rollback and retry

**RLS Policy Violation:**
- Verify user is authenticated
- Check RLS policy conditions
- Test with Supabase service role key (bypasses RLS)

**Trigger Not Firing:**
- Verify trigger created successfully
- Check trigger function logic
- Test with manual INSERT

---

## 9. Manual Migration Script

**File:** `manual_migration_lead_to_admin.sql` (located at project root)

**Purpose:** Standalone script for Migration 004 (Lead → Admin terminology update)

**Execution:**
1. Open Supabase dashboard → SQL Editor
2. Copy contents of `manual_migration_lead_to_admin.sql`
3. Paste and execute
4. Verify changes in Tables view

**Rollback:**
Rollback script included in file comments.

---

## Related Documentation

- **[DATABASE.md](./DATABASE.md)** - Complete database schema
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide
- **[EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md)** - Edge Functions using database

