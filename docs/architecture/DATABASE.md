# BookTalks Mobile - Database Schema

> **Status note (2026-03-06):** The live Supabase database is the canonical source of truth for BookTalks Mobile.
> Use `docs/audits/LIVE_SCHEMA_RECONCILIATION_2026-03-06.md` for the verified live schema snapshot and
> `supabase/migrations/LIVE_MIGRATION_HISTORY_2026-03-06.md` for canonical migration history. This file is a
> curated design/reference document; if it conflicts with the live DB, follow the live-derived docs.

**Database:** PostgreSQL v15+ with PostGIS extension  
**Last Updated:** 2026-03-06 (live-schema reconciliation note added)

---

## 1. Schema Overview

BookTalks uses PostgreSQL with the following key design patterns:

**Event Sourcing for Credits:**
- `credit_events` table is append-only (immutable audit trail)
- `user_credit_balances` is a materialized view updated via database triggers
- All credit operations are atomic and traceable

**Row-Level Security (RLS):**
- All public tables enforce RLS policies
- Users can only access data they're authorized to view
- City-based filtering for listings (intra-city only)

**PostGIS Extension:**
- Geospatial queries for proximity calculations
- Venue location storage and search
- Distance-based sorting for listings

---

## 2. Core Tables

### user_profiles

Extends Supabase `auth.users` with application-specific data.

**Key Fields:**
- `user_id` - Foreign key to auth.users (unique)
- `display_name` - User's display name
- `city` - User's city (REQUIRED for intra-city matching)
- `membership_tier` - 'free', 'pro', 'pro_plus'
- `trust_score` - Aggregate rating from transactions (0.00-5.00)
- `referral_code` - Unique code for referrals

**Membership Tiers:**
- Free: Unlimited joins, 0 club creates
- Pro: Unlimited joins, 5 club creates
- Pro+: Unlimited joins, 15 club creates

**Indexes:**
- `idx_profiles_city` - Fast city-based filtering
- `idx_profiles_referral` - Referral code lookups

---

### credit_events (Event-Sourced)

Append-only table tracking all credit operations.

**Event Types:**
- `signup_bonus` - Initial credits on registration
- `lend_completed` - Credits earned from lending
- `borrow_spent` - Credits spent on borrowing (negative amount)
- `referral_bonus` - Credits from successful referrals
- `admin_adjustment` - Manual adjustments by admin
- `hold_placed` - Credits locked during transaction request
- `hold_released` - Credits unlocked (transaction completed/cancelled)

**Key Fields:**
- `user_id` - User who earned/spent credits
- `event_type` - Type of credit operation
- `amount` - Credit amount (positive or negative)
- `transaction_id` - Related transaction (if applicable)
- `hold_release_reason` - Why hold was released (if applicable)
- `metadata` - Additional context (JSONB)
- `idempotency_key` - **Unique key** to prevent duplicate credit operations (e.g., `'complete_hold_release_<txn_id>'`)

**Indexes:**
- `idx_credit_events_user` - User's credit history (DESC order)
- `idx_credit_events_transaction` - Transaction-related events
- `credit_events_idempotency_key_key` - UNIQUE index on idempotency_key

**Database Trigger:**
- `trigger_update_credit_balance` - Automatically updates `user_credit_balances` on INSERT

**RLS Security (Locked Down):**
- **INSERT:** `WITH CHECK (false)` — No direct client inserts allowed. Credit events are ONLY created by SECURITY DEFINER functions (`grant_signup_bonus()`, `place_hold()`, `release_hold()`, `request_transaction()`, `decline_transaction()`, `complete_transaction()`, `cancel_transaction()`).
- **UPDATE:** `USING (false)` — Append-only, no modifications.
- **DELETE:** `USING (false)` — Append-only, no deletions.
- **SELECT:** Users can only view their own credit events.

---

### user_credit_balances

Regular table storing current credit balances (updated in real-time via database trigger).

**Key Fields:**
- `user_id` - Primary key
- `available` - Credits available for spending
- `held` - Credits locked in pending transactions
- `lifetime_earned` - Total credits earned (all time)
- `lifetime_spent` - Total credits spent (all time)

**Balance Calculation:**
- Available = Earned - Spent - Held
- Total = Available + Held

**Update Logic:**
- Automatically updated by `update_credit_balance()` trigger function on INSERT to `credit_events`
- Ensures balance integrity (available >= 0, held >= 0)
- Real-time updates (no refresh lag) — critical for user experience

**Why Table + Trigger vs. Materialized View:**
- Materialized views require periodic REFRESH (introduces lag)
- Table + trigger provides real-time updates (immediate balance reflection)
- Users see credit changes instantly after transactions complete

---

### books

Catalog of all books in the system (populated from Google Books API and manual library entry fallback).

**Key Fields:**
- `google_books_id` - Unique identifier from Google Books when available; nullable for manual entries
- `title` - Book title (`NOT NULL` in live schema)
- `authors` - Array of author names; nullable in live schema
- `cover_url` - Book cover image URL
- `isbn_10`, `isbn_13` - ISBN identifiers
- `description` - Book description
- `categories` - Array of genres/categories

**Indexes:**
- `idx_books_google_id` - Fast lookups by Google Books ID
- `idx_books_title_search` - Full-text search on title (GIN index)

---

### user_books

User's personal library (owned books, wishlist, reading status).

**Key Fields:**
- `user_id` - Book owner
- `book_id` - Reference to books table
- `reading_status` - 'want_to_read', 'reading', 'completed'
- `ownership` - 'owned', 'wishlist', 'borrowed', 'lent_out'
- `condition` - 'new', 'like_new', 'good', 'acceptable', 'poor'
- `available_for_lending` - Boolean flag
- `rating` - User's rating (1-5)
- `review` - User's review text
- `review_is_public` - Whether review is visible to others

**Indexes:**
- `idx_user_books_user` - User's library (DESC order)
- `idx_user_books_status` - Filter by reading status
- `idx_user_books_wishlist` - Fast wishlist queries

**Unique Constraint:** (user_id, book_id) - One entry per user per book

**Operational Notes:**
- App-side canonical wishlist state is `user_books.ownership = 'wishlist'`.
- Live RLS still restricts direct `user_books` reads to `auth.uid() = user_id`, so public review browsing cannot rely on direct client-side `user_books` queries.
- `20260312120000_019_book_public_reviews_contract.sql` defines `get_public_book_reviews(p_book_id UUID)` for safe public review reads, and that RPC is now deployed live in the database.

---

### listings

Books available for lending (P2P exchange).

**Key Fields:**
- `owner_id` - Lender (book owner) — FK → `user_profiles(user_id)` (changed from auth.users 2026-02-18)
- `book_id` - Book being lent — FK → `books(id)`
- `user_book_id` - Source user_book — FK → `user_books(id)`
- `city` - Lender's city (REQUIRED for intra-city matching)
- `condition` - Book condition
- `photos` - Required: 2-4 photos of the book (`TEXT[] NOT NULL`, CHECK constraint enforces min 2, max 4)
- `delivery_options` - Available delivery methods (`TEXT[] NOT NULL`)
- `status` - 'active', 'paused', 'reserved', 'completed' — tracks listing availability lifecycle
- `notes` - Additional notes from lender
- `exclusive_type` - **Author-only:** 'signed_edition', 'early_release', 'manuscript_preview' (NULL for regular listings)
- `exclusive_until` - **Author-only:** Exclusive to author club members until this timestamp (NULL = no time limit or not exclusive)
- `signed_copy_count` - **Author-only:** Number of signed copies available (DEFAULT 0)

> **Note:** `deposit_amount` is NOT stored on listings. Deposits are calculated per-transaction based on book condition and stored on the `transactions` table. See [transactions](#transactions) section.

**Status Enum Explanation:**
- `'active'` - Listing is available for borrowing requests
- `'paused'` - Listing is temporarily unavailable without being removed
- `'reserved'` - Listing is tied to an in-flight request/transaction
- `'completed'` - Listing lifecycle is closed/completed

**Indexes:**
- `idx_listings_city_status` - CRITICAL for intra-city filtering
- `idx_listings_book` - Find all listings for a book

**RLS Policy:** Users can only view active listings in their city

---

### transactions

P2P book exchange transactions.

**Key Fields:**
- `listing_id` - Listing being borrowed — FK → `listings(id)`
- `lender_id` - Book owner — FK → `user_profiles(user_id)` (changed from auth.users 2026-02-18)
- `borrower_id` - Person borrowing — FK → `user_profiles(user_id)` (changed from auth.users 2026-02-18)
- `status` - Transaction state (see state machine below)
- `delivery_type` - 'porter', 'dunzo', 'meetup'
- `delivery_service` - Which service was chosen ('porter' or 'dunzo')
- `tracking_url` - Real-time tracking link
- `deposit_amount` - Refundable deposit (₹100-500) paid via Razorpay. Calculated per-transaction based on book condition at time of request — NOT stored on listing
- `shipping_cost` - Delivery cost (paid directly to Porter/Dunzo, NOT via Razorpay)
- `razorpay_order_id` - Payment order ID
- `razorpay_payment_id` - Payment confirmation ID
- `is_signed_copy` - **Author feature:** Whether this transaction is for a signed copy (DEFAULT false)

**State Machine:**
```
REQUESTED → APPROVED → PAYMENT_PENDING → READY_TO_SHIP → SHIPPED → DELIVERED → COMPLETED
                ↘                ↘                ↘
            CANCELLED        CANCELLED        CANCELLED
              (before          (payment         (mutual agreement
               payment)        timeout/          before shipping)
                               failure)
```

Also: REQUESTED → DECLINED (lender rejects)

**Cancellation Transitions:**
- `approved → cancelled` — Before payment is initiated (either party can cancel)
- `payment_pending → cancelled` — Payment timeout or payment failure
- `ready_to_ship → cancelled` — Mutual agreement before shipping begins

**On Cancellation:** Credit hold is released back to borrower via `hold_released` credit event with `hold_release_reason = 'transaction_cancelled'`.

**Indexes:**
- `idx_transactions_lender` - Lender's transactions
- `idx_transactions_borrower` - Borrower's transactions
- `idx_transactions_status` - Filter by status

**Constraints:**
- `transactions_no_self_lend CHECK (lender_id <> borrower_id)` — Prevents self-lending
- `transactions_status_check` — Validates status enum
- `transactions_delivery_type_check CHECK (delivery_type IN ('porter', 'dunzo', 'meetup'))` — Validates delivery type

**Database Functions (SECURITY DEFINER):**

*Credit Operations:*
- `grant_signup_bonus(user_id)` — Idempotent: grants 1 signup credit. Key: `'signup_bonus_<user_id>'`. Safe to call multiple times.
- `place_hold(user_id, transaction_id, amount DEFAULT 1)` — Locks balance `FOR UPDATE`, validates available >= amount, inserts `hold_placed` event. Key: `'hold_placed_<txn_id>'`.
- `release_hold(transaction_id, actor_id, reason)` — Finds the original `hold_placed` event, inserts `hold_released` with reason. Key: `'hold_released_<reason>_<txn_id>'`. Reason must be one of: `transaction_completed`, `transaction_declined`, `transaction_cancelled`, `transaction_expired`, `dispute_resolved`.

*Transaction Lifecycle:*
- `request_transaction(listing_id, borrower_id, delivery_type, message?, shipping_address_id?)` — Atomic: validate listing (must be `active`) → validate borrower credits → create transaction → place hold → record `transaction_events` → set listing to `reserved`. Returns the created transaction.
- `approve_transaction(transaction_id, actor_id)` — Lender-only: `requested` → `approved`. Records `transaction_events`.
- `decline_transaction(transaction_id, actor_id)` — Lender-only: `requested` → `declined`. Releases held credit back to borrower. Resets listing to `active`. Records `transaction_events`.
- `transition_transaction_status(transaction_id, new_status, actor_id)` — Enforces valid state machine transitions with role-based checks (lender-only: approve/decline/ship; borrower-only: payment_pending/delivery confirm). Uses `FOR UPDATE` row locking.
- `complete_transaction(transaction_id, actor_id)` — Atomically: release hold → debit borrower → credit lender → set status 'completed'. Uses idempotency keys.
- `cancel_transaction(transaction_id, actor_id)` — Atomically: release hold (back to available) → set status 'cancelled'. Uses idempotency keys.

**RLS Policy:** Only lender and borrower can view transaction details

---

### book_clubs

Reading clubs for book discussions. Includes regular clubs and **Author Clubs** (created by verified authors).

**Key Fields:**
- `admin_id` - Club creator/admin (renamed from lead_id)
- `name` - Club name
- `description` - Club description
- `club_type` - 'public', 'approval', 'invite_only', **'author_club'** — determines join mechanism
- `access_level` - 'all', 'pro', 'pro_plus' — minimum membership tier to join
- `meeting_type` - 'online_only', 'venue_based', 'hybrid' — club meeting format
- `author_id` - References verified author (`user_profiles.id`). **Required for `author_club` type, NULL for all others** (enforced by CHECK constraint)
- `current_book_id` - Current book being read
- `max_members` - Maximum member count (NULL = unlimited)
- `is_archived` - Whether club is archived
- `member_count` - Auto-updated by trigger

**Author Club Features:**
- Only users with `is_verified_author = true` can create `author_club` type clubs
- Author clubs appear in a dedicated "Author Clubs" discovery section
- Author clubs support AMA events (`club_events.event_type = 'ama'`) and virtual signing events (`'virtual_signing'`)
- Authors can create exclusive listings visible only to their club members (via `listings.exclusive_type`)

**Indexes:**
- `idx_clubs_type` - Filter by club type
- `idx_clubs_active` - Non-archived clubs
- `idx_clubs_author` - Author's clubs (partial index on `club_type = 'author_club'`)

**RLS Policy:** Only club members can view club details

---

### club_members

Club membership and roles.

**Key Fields:**
- `club_id` - Club reference
- `user_id` - Member reference
- `role` - 'member', 'moderator', 'admin' (renamed from 'lead')
- `status` - 'active', 'muted', 'banned'
- `joined_at` - Membership start date

**Indexes:**
- `idx_club_members_club` - Club's member list
- `idx_club_members_user` - User's club memberships

**Unique Constraint:** (club_id, user_id) - One membership per user per club

---

### club_messages

Real-time chat messages in clubs.

**Key Fields:**
- `club_id` - Club reference
- `user_id` - Message sender
- `content` - Message text
- `chapter_tag` - Optional chapter or reading marker
- `has_spoiler` - Whether message contains spoilers

**Indexes:**
- `idx_club_messages_club` - Club's message history (DESC order)

**Real-time:** Supabase Realtime subscription enabled

---

### club_event_questions

AMA questions for author events. Readers submit questions, authors answer and optionally pin them.

**Key Fields:**
- `event_id` - References the AMA or virtual_signing event (`club_events.id`)
- `asked_by` - User who asked the question (`auth.users.id`)
- `question_text` - The question content
- `author_answer` - Author's response (NULL until answered)
- `is_pinned` - Whether the author has pinned this question
- `upvote_count` - Community upvotes to surface popular questions
- `status` - 'pending', 'answered', 'rejected'
- `answered_at` - Timestamp when author answered

**Indexes:**
- `idx_event_questions_event` - Questions for an event, sorted by upvotes
- `idx_event_questions_status` - Filter by answer status

**RLS Policies:**
- Club members can view questions for events in their clubs
- Club members can submit questions (with `asked_by = auth.uid()` check)
- Only club admin (author) can answer/pin questions
- Users can delete their own unanswered (pending) questions

---

### venues

Physical locations for meetups (cafes, libraries, bookstores, community centers).

**Key Fields:**
- `name` - Venue name
- `address` - Full address
- `city` - Venue city
- `location` - PostGIS GEOGRAPHY point (lat/long)
- `venue_type` - 'cafe', 'library', 'bookstore', 'community_center' — standardized venue categories for book-sharing context
- `verification_code` - Unique code (BT-VEN-XXXX)
- `is_verified` - Admin verification status

**Venue Type Explanation:**
- `'cafe'` - Coffee shops and cafes (popular informal meetup spots)
- `'library'` - Public libraries and reading rooms
- `'bookstore'` - Bookstores and book retailers
- `'community_center'` - Community centers, schools, cultural centers, and other public gathering spaces

**Indexes:**
- `idx_venues_city` - City-based filtering
- `idx_venues_location` - Geospatial queries (PostGIS)

**PostGIS Query Example:** Find venues within 5km of user location

---

## 3. Row-Level Security (RLS) Policies

All tables enforce RLS policies. Key policies:

**user_profiles:**
- Users can read all profiles
- Users can only update their own profile

**listings:**
- Users can view active listings in their city only
- Users can only update/delete their own listings

**transactions:**
- Only lender and borrower can view transaction details
- State transitions enforced via `transition_transaction_status()` DB function (not direct UPDATE)
- Completion/cancellation via atomic `complete_transaction()` / `cancel_transaction()` functions
- Self-lending prevented by `transactions_no_self_lend` CHECK constraint

**credit_events:**
- Users can only view their own credit history (SELECT policy)
- **INSERT blocked for all clients** (`WITH CHECK (false)`) — only SECURITY DEFINER functions can insert
- **UPDATE and DELETE blocked** — append-only immutable audit trail
- Idempotency enforced via UNIQUE `idempotency_key` column

**book_clubs:**
- Only club members can view club details
- Only admin can update club settings

**club_messages:**
- Only club members can view/send messages
- Real-time subscriptions filtered by club membership

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for complete RLS policy SQL.

---

## 4. Query Coding Standard: Lean Lists, Rich Details

**Established 2026-02-18** — All Supabase client queries MUST follow this pattern.

### FK Architecture

All user-referencing FKs (`owner_id`, `lender_id`, `borrower_id`) point to `user_profiles(user_id)`, NOT `auth.users.id`. This enables direct PostgREST joins to `user_profiles` without traversing `auth.users`.

### Rules

| Query Type | Max Join Depth | Rule |
|-----------|---------------|------|
| **List / Browse** | 1 level | Only join data shown in card UI (e.g., `listings → books`) |
| **Detail View** | 2 levels max | Join related data; fetch profiles in a separate query |
| **Profile data** | 0 (separate) | Always use `profileService.getProfileSummary()` or `getProfileSummaries()` |
| **My items** | 1 level | No profile joins needed — current user already has their own profile |

### Examples

```typescript
// ✅ GOOD — List query (lean)
supabase.from('listings').select('*, book:books(id, title, authors, cover_url)')

// ✅ GOOD — Detail query (rich, profile separate)
const listing = await supabase.from('listings')
    .select('*, book:books(*)').eq('id', id).single();
const owner = await profileService.getProfileSummary(listing.owner_id);

// ❌ BAD — Over-joined list query
supabase.from('listings').select('*, owner:user_profiles!...(...), book:books(...)')

// ❌ BAD — Multi-level nested join
supabase.from('transactions').select('*, listing:listings(*, book:books(*))')
```

### Service Files

| Service | Pattern | Notes |
|---------|---------|-------|
| `profileService.ts` | Dedicated profile fetcher | `getProfileSummary()`, `getProfileSummaries()` (batch) |
| `listingsService.ts` | Lean lists, rich details | `browseListings()` → book only; `getListingDetails()` → book + profile |
| `transactionsService.ts` | Lean lists, rich details | `getMyTransactions()` → no joins; `getTransactionDetails()` → listing+book + batch profiles |
| `booksService.ts` | 1-level join | `getUserLibrary()` → `user_books → books(*)` ✅ |
| `creditService.ts` | No joins | Direct table queries ✅ |

---

## Related Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and data flow
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Database migrations and setup
- **[EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md)** - Server-side database operations
- **[API_REFERENCE.md](./API_REFERENCE.md)** - Querying database from frontend

