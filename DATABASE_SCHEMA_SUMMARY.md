# BookConnect Database Schema Summary

## ⚠️ **MCP CONNECTION ISSUE - CRITICAL**

**The Supabase MCP is currently connected to the WRONG database project!**

### 🔴 **Currently Connected (WRONG):**
- **Project Name**: BookConnect
- **Project ID**: `qsldppxjmrplbmukqorj`
- **Region**: `ap-southeast-1` (Singapore)
- **PostgreSQL Version**: 15.8.1.100
- **Database Host**: `db.qsldppxjmrplbmukqorj.supabase.co`

### ✅ **Should Be Connected (CORRECT):**
- **Project Name**: `Bookconnect_reactexpo`
- **Project ID**: `ahntbtktjjmvfosgkmgn`
- **Region**: `ap-southeast-2` (Australia)
- **PostgreSQL Version**: 17
- **Database Host**: `db.ahntbtktjjmvfosgkmgn.supabase.co`

---

## 📊 **Current Tables by Module** (48 total)

### **Auth & User Management (4 tables)**
- `auth.users` - Supabase auth users
- `user_profiles` - User profile info, account types, membership tiers
- `user_addresses` - Delivery/shipping addresses
- `user_push_tokens` - Device push notification tokens (Expo)

### **Books & Library (5 tables)**
- `books` - Google Books metadata + pricing
- `user_books` - User's book library with reading status
- `user_wishlist` - Wishlist entries
- `reading_notes` - Personal reading notes
- `book_reviews_public` - Public book reviews

### **P2P Exchange System (7 tables)**
- `listings` - Peer-to-peer book listings (with PostGIS location)
- `transactions` - Exchange transactions (lender/borrower)
- `transaction_events` - Event-sourced transaction logs
- `transaction_ratings` - User ratings after transactions
- `credit_events` - P2P credit activity (event-sourced)
- `user_credit_balances` - Derived P2P credit balances
- `referrals` - Referral tracking

### **Venues (1 table)**
- `venues` - Physical locations (cafes, libraries, bookstores) with PostGIS

### **Book Clubs (17 tables)**
- `book_clubs` - Club definitions (public/approval/invite-only)
- `club_members` - Club membership with roles
- `club_join_applications` - Application-based clubs
- `club_join_questions` - Custom questions for club applications
- `club_venues` - Club ↔ Venue associations
- `book_nominations` - Club book voting
- `book_votes` - Individual votes on nominations
- `club_messages` - Chat messages with spoiler tags
- `message_reactions` - Message emoji reactions
- `club_events` - Club meetups (online/offline)
- `event_rsvps` - Event attendance (going/maybe/not_going)
- `reading_schedules` - Milestone-based reading plans
- `member_reading_progress` - Chapter completion tracking
- `club_member_actions` - Moderation (warn/mute/ban)
- `club_complaints` - Platform-level complaint reports
- `club_discussion_threads` - Discussion thread structure
- `club_discussion_thread_posts` - Thread post content

### **Notifications (3 tables)**
- `notification_events` - Event-sourced notification triggers
- `notification_deliveries` - Delivery ledger (in-app/push with status)
- `notification_preferences` - User notification settings

---

## 🏗️ **Database Features**
- **PostGIS Extensions**: Geolocation support (listings, venues, nearby discovery)
- **Event Sourcing**: credit_events, transaction_events, notification_events (append-only)
- **Triggers**: Auto-update trust scores, member counts, vote counts
- **RLS Policies**: Row-level security on most tables
- **Indexes**: Strategic indexes on frequently queried columns

---

## 📋 **Evidence of Correct Project**

The correct Supabase project (`ahntbtktjjmvfosgkmgn`) is documented in:

1. **docs/multi-tenant-bookstore-marketplace/README.md** (line 93)
   - "Live project: `Bookconnect_reactexpo`"
   - "Project ref: `ahntbtktjjmvfosgkmgn`"

2. **docs/multi-tenant-bookstore-marketplace/implementation/PHASE-0-codebase-db-audit.md** (line 101)
   - "Supabase project: `Bookconnect_reactexpo`, ref `ahntbtktjjmvfosgkmgn`, region `ap-southeast-2`, Postgres 17"

3. **docs/audits/LIVE_SCHEMA_RECONCILIATION_2026-03-06.md** (line 3)
   - "Canonical source: live Supabase project `ahntbtktjjmvfosgkmgn`"

4. **docs/audits/CLUBS_WORK_SESSION_HANDOFF_2026-05-23.md** (line 11)
   - "Project id/ref: `ahntbtktjjmvfosgkmgn`"
   - "Project name seen earlier: `Bookconnect_reactexpo`"

5. **docs/audits/CLUBS_WORK_SESSION_HANDOFF_2026-06-04.md** (line 97)
   - "Read-only checks were run on 2026-06-05 against Supabase project `Bookconnect_reactexpo` (`ahntbtktjjmvfosgkmgn`)"

## ⚠️ **Important Notes**
- **Bookstore Marketplace**: NOT implemented yet (separate from P2P exchange)
- **Correct PostgreSQL**: Version 17 (not 15)
- **MCP Configuration Location**: `C:\Users\user\.augment\plugins\` or `C:\Users\user\.augment\env\`
- **Action Required**: Change MCP connection from `qsldppxjmrplbmukqorj` → `ahntbtktjjmvfosgkmgn`
