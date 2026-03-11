# BookTalks Mobile - Complete Feature Specification

## 1. Project Vision & Philosophy

BookTalks is a revolutionary peer-to-peer (P2P) book sharing ecosystem designed specifically for the Indian market. Unlike traditional library apps, **BookTalks treats books as a shared community resource that "circulates" rather than returns**. The fundamental philosophy is that a book read is a book that should move forward to the next reader, creating an ever-flowing stream of literature through the community.

### Core Differentiators
1. **Circulation Over Return**: Books move forward in the community, not back to original owners
2. **Credit Economy**: Democratic 1-credit-per-book system regardless of book value
3. **Intra-City Focus**: Hyperlocal book exchanges within the same city for faster, sustainable delivery
4. **Venue Integration**: Physical spaces as community anchors
5. **Event-Sourced Integrity**: Immutable audit trails prevent fraud

---

## 2. User Roles & Account Types

### 2.1 Standard Users
**Free Tier:**
- Unlimited Book Club memberships (can join any number of clubs)
- Can participate fully in all club activities (chat, vote, RSVP, etc.)
- Can be promoted to Moderator role in clubs
- Cannot create clubs
- Unlimited library features
- Standard transaction limits
- Standard support

**Pro Tier ($2.99/month):**
- Unlimited Book Club memberships
- Can create up to 5 book clubs
- Can be promoted to Admin role
- Priority support
- Early access to new features

**Pro+ Tier ($4.99/month):**
- Unlimited Book Club memberships
- Can create up to 15 book clubs
- Can be promoted to Admin role
- Premium badge on profile
- Exclusive author events access
- Priority customer support

**Membership Downgrade Policy:**
- 30-day grace period when downgrading (Pro→Free or Pro+→Pro)
- Warnings sent on Day 7, 14, 21, and 29
- User can choose which clubs to keep within their new tier limit
- If no selection made, oldest created clubs are retained (by creation date)
- Excess clubs are archived on Day 30
- Archived clubs can be un-archived within 180 days if user upgrades
- After 180 days, club members can request admin takeover (requires Pro/Pro+ upgrade)

### 2.2 Venue Owners
- Can register and manage venue profiles
- Receive `BT-VEN-XXX-XXXXX` unique codes
- Dashboard for club associations
- Metrics on foot traffic from BookTalks

### 2.3 Verified Authors
- Manual ID verification required
- Badge on profile and book listings
- Can host AMAs in clubs
- Author program features (Phase 2)

### 2.4 Administrators
- Full access to admin panel
- Venue verification queue
- Dispute resolution tools
- Content moderation dashboard

---

## 3. Core Feature Areas (8-Week MVP)

### 3.1 Personal Books Library (Week 1-2)

#### Book Cataloging
**Google Books API Integration:**
- Search by Title, Author, ISBN-10, ISBN-13
- Automatic metadata fetch:
  - Title, Authors (array)
  - Description, Page Count
  - Categories, Publisher, Published Date
  - High-resolution cover images
  
**Manual Entry Fallback:**
- For books not in Google's database
- Required fields: Title, Author
- Optional: Custom cover upload

**Library Management:**
- **Reading Status Pipeline:**
  - `Want to Read` → Wishlist that triggers notifications
  - `Reading` → Set progress milestones, share with clubs
  - `Completed` → Unlock review/lending capabilities
  
- **Ownership States:**
  - `Owned` - In your possession, private or lendable
  - `Lent Out` - Currently with another user
  - `Borrowed` - In your possession via exchange
  - `Wishlist` - Virtual entry for notifications

- **Condition Tracking:**
  - 5-point scale: New, Like New, Good, Acceptable, Poor
  - Photo documentation for exchange verification
  
- **Ratings & Reviews:**
  - 1-5 star rating system
  - Text review (max 500 characters)
  - Privacy toggle: Public/Private
  - Reviews tied to completion status

#### Book Detail View
- Full metadata display
- ISBN barcode (for Phase 2 scanning)
- Status/ownership quick actions
- Lending availability toggle
- View all user reviews (public only)

#### Book Notes & Annotations
**Philosophy:**
- Private, book-specific notes to deepen retention
- "Write to think" approach with structured tagging

**Tagging System (The 4 Pillars):**
1. **Quote** (Teal): Verbatim passages, favorite lines
2. **Reflect** (Purple): Personal thoughts, reactions, connections
3. **Distill** (Amber): Summaries, core concepts, main ideas
4. **Apply** (Green): Action items, behavioral changes, experiments

**Features:**
- Quick-add from Book Detail screen
- Dedicated "My Notes" view per book with filtering
- Rich text capture with context-aware prompts
- Private by default (Row-Level Security)

**Advanced Capabilities (Phase 1.5):**
- **Rich Formatting**: Support for **bold**, *italic*, headers, and lists to structure thoughts.
- **Text Extraction (OCR)**: Camera integration to scan physical pages and extract text directly into notes.
- **Reading Session Linkage**: Notes tied not just to the book, but to specific "reading sessions" (e.g., "Chapter 5 Session - Jan 15") for chronological context.

---

### 3.2 P2P Exchange System (Week 3-4)

#### The Circulation Model Philosophy
Traditional libraries loan books that must return. **BookTalks implements forward-only circulation:**
- User A lists "Atomic Habits"
- User B borrows it, becomes the new owner
- User B can read and eventually list it for User C
- The book continues its journey indefinitely

**Exception:** Users can request specific books back through the platform, but this is a new transaction (not automatic return).

#### Intra-City Delivery Scope
**BookTalks operates on a hyperlocal model:**
- All book exchanges are **intra-city only** (within the same city)
- No inter-city shipping supported in MVP
- Examples: Mumbai→Mumbai, Bangalore→Bangalore, Delhi→Delhi
- Metropolitan areas treated as single cities (e.g., Mumbai includes Navi Mumbai, Thane)

**Benefits:**
- Faster delivery (same-day or next-day)
- Lower delivery costs (₹40-80 vs ₹100-200 for inter-city)
- Sustainable logistics (reduced carbon footprint)
- Stronger local community building

**Address Entry:**
- Users enter delivery address when creating first listing OR making first borrow request
- Address not mandatory during signup (better onboarding UX)
- City determined by: GPS location + manual selection + static profile city
- Users can update address anytime in profile settings

#### Listing Creation Flow
**Eligibility:**
- Book must be marked `Owned` with status `Completed`
- Minimum 2 verification photos required
- Condition assessment mandatory
- User must have valid delivery address in profile

**Photo Requirements:**
- Photo 1: Front cover (clear, well-lit)
- Photo 2: Spine + edges (to show wear)
- Optional: Interior pages, annotations

**Metadata:**
- Condition notes (text, max 200 chars)
- Delivery options: `shipping_only`, `meet_in_person`, `both`
- Geolocation: Automatically tagged with city (`GEOGRAPHY(POINT)`)
- City field: Extracted from user's profile address

#### Transaction State Machine

**Database Structure:**
- `transactions` table: Current state snapshot
- `transaction_events` table: Immutable event log

**States & Transitions:**
1. **REQUESTED**
   - Borrower submits request with optional message
   - System executes `hold_placed` credit event (-1 from available → +1 to held)
   - Lender receives push notification
   - 48-hour acceptance window starts

2. **APPROVED / DECLINED**
   - Lender reviews borrower profile (trust score, ratings)
   - If approved → State: `APPROVED`, notification to borrower
   - If declined → `hold_released` with reason `transaction_declined`
   - If 48 hours elapsed → Auto-decline, `hold_released` with `transaction_expired`

3. **PAYMENT_PENDING**
   - Borrower pays refundable deposit via Razorpay:
     - Deposit amount: ₹100-500 (based on book condition and estimated value)
     - Held in escrow until delivery confirmation
   - Edge Function: `create-payment-order`
   - Razorpay webhook verifies payment → Event: `payment_completed`
   - **Note:** Delivery cost is paid separately (see step 4)

4. **READY_TO_SHIP**
   - Lender marks "Ready to Ship" in app
   - Borrower chooses delivery method:
     - **Option A: Porter/Dunzo Delivery**
       - Borrower selects preferred service (Porter or Dunzo)
       - Edge Function: `book-shipment` calls Porter/Dunzo API
       - Delivery cost (₹40-80 typically) paid directly to delivery app
       - Pickup scheduled from lender's address
       - Tracking link generated
     - **Option B: Meet in Person**
       - No delivery cost
       - Both parties coordinate meetup location/time via in-app chat
       - Lender marks "Handed Over" after meetup

5. **SHIPPED** (Only for Porter/Dunzo deliveries)
   - Courier pickup confirmed
   - Porter/Dunzo webhook → Event: `shipped`
   - Real-time tracking link shared with both parties
   - Estimated delivery time: Same-day or next-day (intra-city)

6. **DELIVERED**
   - **For Porter/Dunzo:** Delivery confirmation webhook → Event: `delivered`
   - **For Meetup:** Borrower confirms receipt in app → Event: `delivered`
   - 24-hour dispute window begins
   - If no dispute filed → Auto-complete after 24 hours

7. **COMPLETED**
   - Edge Function: `complete-transaction` executes:
     ```
     borrower: hold_released + borrow_spent (-1 credit)
     lender: lend_completed (+1 credit)
     ```
   - Book ownership transfers to borrower in `user_books`
   - Both users prompted to rate the transaction

8. **DISPUTED**
   - Either party files complaint (damaged book, non-delivery)
   - Admin review queue
   - Possible outcomes:
     - Refund borrower, no credit transfer
     - Partial refund + credit transfer
     - No action (resolved privately)
   - Event: `dispute_resolved` with admin_id in metadata

#### Browse & Discovery
**Listing Feed:**
- Default: Shows all listings in user's city
- Sort options:
  - Recently listed (newest first)
  - Condition (best to acceptable)
  - Proximity (nearest neighborhood first, using GPS)
- Filters:
  - Condition (New to Poor)
  - Delivery method (Shipping only, Meetup only, Both)
  - Book category/genre

**City-Based Matching:**
- Listings are **only visible to users in the same city**
- City determined from user's profile address
- Users can manually switch city view (e.g., when traveling)
- No inter-city listings shown in MVP

**Wishlist Notifications:**
- When a book from your wishlist is listed in your city
- Edge Function runs on `listings.INSERT` trigger
- Checks for matching `google_books_id` in wishlists + same city
- Sends push notification with listing link

---

### 3.3 Credit Economy (Event-Sourced Architecture)

#### Core Principle
**Credits are never a simple integer.** Every change is recorded as an immutable event in `credit_events` table.

#### Database Schema
```sql
-- Append-only event log
CREATE TABLE credit_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT CHECK (event_type IN (
    'signup_bonus',
    'lend_completed',
    'borrow_spent',
    'referral_bonus',
    'admin_adjustment',
    'hold_placed',
    'hold_released'
  )),
  amount NUMERIC(10,2) NOT NULL,
  transaction_id UUID,  -- NULL for non-transaction events
  hold_release_reason TEXT CHECK (hold_release_reason IN (
    'transaction_completed',
    'transaction_declined',
    'transaction_cancelled',
    'transaction_expired',
    'dispute_resolved'
  )),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Materialized view updated by trigger
CREATE TABLE user_credit_balances (
  user_id UUID PRIMARY KEY,
  available NUMERIC(10,2) CHECK (available >= 0),
  held NUMERIC(10,2) CHECK (held >= 0),
  lifetime_earned NUMERIC(10,2),
  lifetime_spent NUMERIC(10,2),
  updated_at TIMESTAMPTZ
);
```

#### Event Types Explained

**signup_bonus (+1.0)**
- Triggered on profile setup completion
- One-time only
- Incentivizes onboarding

**lend_completed (+1.0)**
- When transaction reaches `COMPLETED` state
- Rewards sharing behavior
- Encourages more listings

**borrow_spent (-1.0)**
- Accompanies `lend_completed` for borrower
- Released from `held` state
- Actual deduction from lifetime balance

**referral_bonus (+0.5)**
- Triggered when referred user completes first exchange
- Tracked in `referrals` table
- Status: `pending` → `completed`

**admin_adjustment (±X)**
- Manual intervention by admin
- Reasons: Fraud reversal, goodwill credit
- Logged with admin_id in metadata

**hold_placed (-1.0 from available, +1.0 to held)**
- On transaction `REQUESTED`
- Ensures user can't double-spend
- Multiple simultaneous requests allowed (if balance permits)

**hold_released**
- From `held` back to `available` (declined/expired)
- From `held` to spent (completed)
- Must specify `hold_release_reason`

#### Integrity Checks
- **Balance Calculation**: `available = SUM(earned events) - SUM(spent events) - SUM(held)`
- **Negative Balance Prevention**: CHECK constraint at database level
- **Audit Trail**: Any discrepancy flags admin review

#### Referral System Deep-Dive
**Flow:**
1. User A generates unique `referral_code` (e.g., `JOHN2024` - customizable)
2. User A shares code
3. User B signs up with code → Entry in `referrals` table (status: `pending`)
4. User B completes first exchange (either lend or borrow)
5. Trigger checks `referrals` for User B's `user_id`
6. If found → Insert `referral_bonus` event for User A
7. Update `referrals.status` to `completed`, set `credited_at` timestamp

---

### 3.4 Book Clubs & Community (Week 5-6)

#### Club Access Types

**Public Clubs:**
- Anyone can join instantly
- No approval required
- Visible in global browse

**Approval-Required Clubs:**
- Join application with custom questions
- Moderator/Admin reviews within 48 hours
- Decline must include brief reason

**Invite-Only Clubs:**
- Hidden from browse
- Only visible via direct invite link
- Admin manually invites members

#### Club Meeting Types

**Online-Only Clubs:**
- All meetings conducted virtually (Zoom, Google Meet, etc.)
- No physical venue association required
- Members can be from anywhere in the city
- Can convert to venue-based or hybrid later

**Venue-Based Clubs:**
- Meetings held at a specific physical venue (cafe, library, bookstore, etc.)
- Venue association mandatory (selected from verified venue list)
- Venue details displayed on club profile
- Members typically prefer proximity to venue
- Can convert back to online-only if needed

**Hybrid Clubs:**
- Combination of online and venue-based meetings
- Optional venue association
- Flexibility for members who can't attend in person
- Event-by-event basis (some online, some at venue)

**Club Type Conversion:**
- Admins can change meeting type anytime in club settings
- All members notified of conversion via push notification
- No restrictions or approval required for MVP
- Members can leave if new format doesn't suit them

#### Membership Tier Limits
| Tier | Max Memberships | Can Create Clubs | Max Clubs Created |
|------|----------------|------------------|-------------------|
| Free | Unlimited | No | 0 |
| Pro | Unlimited | Yes | 5 |
| Pro+ | Unlimited | Yes | 15 |

**Club Archiving:**
- Archived clubs don't count toward creation limit
- Searchable as "inactive" in user's profile
- Can be un-archived within 180 days if user upgrades
- After 180 days, members can request admin takeover (requires Pro/Pro+ upgrade)

#### Club Structure

**Roles:**
- **Admin**: Creator/owner, full control (requires Pro/Pro+ tier)
- **Moderator**: Assigned by Admin, moderation tools (Free tier users can be Moderators)
- **Member**: Standard participation (available to all tiers)

**Role Requirements:**
- **Admin role:** Requires active Pro or Pro+ subscription
- **Moderator role:** Available to Free, Pro, and Pro+ users
- **Member role:** Available to all users
- **Admin succession:** If Admin downgrades to Free, they must transfer admin role to a Pro/Pro+ member or upgrade within grace period

**Role Permissions:**
| Permission | Member | Moderator | Admin |
|------------|--------|-----------|-------|
| Send messages | ✓ | ✓ | ✓ |
| React to messages | ✓ | ✓ | ✓ |
| Nominate books | ✓ | ✓ | ✓ |
| Vote on books | ✓ | ✓ | ✓ |
| Delete messages | - | ✓ (others only) | ✓ |
| Mute members | - | ✓ | ✓ |
| Ban members | - | - | ✓ |
| Edit club details | - | - | ✓ |
| Change meeting type | - | - | ✓ |
| Promote to Moderator | - | - | ✓ |
| Transfer admin role | - | - | ✓ |

#### Current Book & Voting
- Admin sets "Current Book" for the club
- Members can nominate next book
- Voting period set by Admin (e.g., 7 days)
- Winner becomes new Current Book
- Automatic notification to all members

#### Real-Time Chat (Supabase Realtime)

**Technical Implementation:**
- `club_messages` table with Realtime subscription
- Subscriptions filtered by `club_id` via RLS

**Message Features:**
- **Spoiler Tags**: `||spoiler text||` syntax
  - Rendered as blurred/hidden until tap
  - Parser regex: `/\|\|(.*?)\|\|/g`
  
- **Chapter References**: `@ch5` or `@chapter 5`
  - Auto-links to chapter milestone
  - Clickable to filter messages by chapter
  
- **Reactions**: Emoji reactions (max 5 unique per message)
  - Stored in `message_reactions` table
  - Real-time update on reaction changes

**Message Moderation:**
- Moderators can delete messages (soft delete with reason)
- Deleted messages show as "[Message removed by moderator]"
- Original authors retain visibility with warning

#### Reading Schedules & Progress

**Schedule Creation (Admin/Moderator only):**
```json
{
  "book_id": "uuid",
  "milestones": [
    {"chapter": 1, "due_date": "2024-01-15", "title": "Introduction"},
    {"chapter": 5, "due_date": "2024-01-22", "title": "Midpoint"},
    {"chapter": 10, "due_date": "2024-01-29", "title": "Finale"}
  ]
}
```

**Member Progress Tracking:**
- Members update "chapters completed" counter
- Progress bar visible in club detail
- Behind/On Track/Ahead indicators
- Leaderboard (optional per club)

#### Club Events
**Event Types:**
- **Online**: Zoom/Google Meet links
- **Offline**: Venue-based with address

**RSVP System:**
- Going / Maybe / Not Going
- Max attendees limit (for venues)
- Waitlist if full
- Automated reminders 24 hours before

---

### 3.5 Venues System (Week 5-6)

#### Venue List Population Strategy

**Hybrid Approach:**
1. **Admin-Seeded Venues (Phase 1):**
   - Admins manually add 20-30 popular venues per major city
   - Focus on established cafes, libraries, bookstores, coworking spaces
   - Pre-verified and curated for quality
   - Examples: Atta Galatta (Bangalore), Kitab Khana (Mumbai), Oxford Bookstore (Delhi)

2. **Venue Owner Registration (Phase 1):**
   - Venue owners can register via `partners.booktalks.in`
   - Subject to admin verification before appearing in club selection
   - Generates unique `venue_code` upon approval

3. **User-Suggested Venues (Phase 2):**
   - Club admins can suggest venues not in the system
   - Requires venue owner verification before activation
   - Temporary "Pending Venue" status until verified

**Venue Selection for Clubs:**
- When creating venue-based club, admin selects from verified venue list
- Venues filtered by user's city
- Search by name, type, or neighborhood
- If preferred venue not listed, user can:
  - Start as online-only club, convert later
  - Request venue addition (admin review required)

#### Venue Registration
**Application Process:**
1. Venue owner fills form on `partners.booktalks.in`
2. Submits to Supabase (auto-creates `pending` venue)
3. Admin reviews in admin panel
4. Approval → Generates `venue_code`: `BT-VEN-[CITY_CODE]-[5_DIGITS]`
   - Example: `BT-VEN-BLR-00042`

**Verification Criteria:**
- Valid business registration (optional for cafes/libraries)
- Physical address (Google Maps verification)
- Minimum amenities: Seating, WiFi, Reading-friendly environment
- Photos of space (minimum 3 photos)
- Operating hours and contact information

#### Venue Profile Structure
```sql
CREATE TABLE venues (
  id UUID PRIMARY KEY,
  venue_code TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  venue_type TEXT,  -- 'cafe', 'library', 'coworking', 'bookstore'
  cover_url TEXT,
  photos TEXT[],
  address_line1 TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  location GEOGRAPHY(POINT),  -- For radius searches
  operating_hours JSONB,  -- {"monday": {"open": "09:00", "close": "21:00"}, ...}
  amenities TEXT[],  -- ['wifi', 'parking', 'food', 'quiet_zones']
  max_capacity INTEGER,
  booking_required BOOLEAN,
  owner_user_id UUID,
  verification_status TEXT,  -- 'pending', 'approved', 'rejected'
  is_exchange_partner BOOLEAN,  -- Physical book dropbox
  created_at TIMESTAMPTZ
);
```

#### Club-Venue Association
- Clubs can associate with multiple venues
- One `is_primary` flag for default location
- Venue detail pages show "Clubs meeting here"
- Clubs can book venue for events (if `booking_required`)

#### Exchange Partner Program (Phase 1.5)
- Selected verified venues can host physical "BookTalks Dropboxes"
- Users drop off books → Venue scans QR → Auto-lists
- Venue receives foot traffic commission

---

### 3.6 Moderation & Safety (Week 7-8)

#### Club Moderation Tools

**Warning System:**
- Moderator issues warning to member
- Logged in `club_member_actions`
- Member receives notification with reason
- 3 warnings in 30 days → Automatic 7-day mute

**Mute:**
- Duration: 24 hours, 7 days, 30 days, or permanent
- Muted users can read but not send messages
- Visible "Muted until [date]" badge on profile

**Ban:**
- Permanent removal from club
- Cannot rejoin (even with new application)
- All messages soft-deleted
- Optional: Report to platform admin for cross-club ban

#### Platform-Level Moderation

**Complaint System:**
```sql
CREATE TABLE club_complaints (
  id UUID PRIMARY KEY,
  club_id UUID,
  reporter_id UUID,
  reported_user_id UUID,
  message_id UUID,  -- NULL if not message-specific
  reason TEXT,  -- 'spam', 'harassment', 'spoilers', 'other'
  status TEXT,  -- 'pending', 'reviewing', 'resolved', 'dismissed'
  resolved_by UUID,  -- admin_id
  resolution_action TEXT,  -- 'warned', 'muted', 'banned', 'no_action'
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);
```

**Admin Review Queue:**
- Prioritized by severity (auto-flagged keywords)
- Can view full message history context
- Actions: Warn, Mute (platform-wide), Ban (platform-wide), Dismiss
- All actions logged with admin ID

#### Content Filters
**Automated:**
- Profanity filter (customizable per club)
- Spoiler leak detection (ML-based, Phase 2)
- Spam link detection

**Manual:**
- User reports
- Moderator review tools

---

### 3.7 Design System (Week 7-8)

**Note:** The Atmospheric Design System (time-based theme switching) has been **deferred to Phase 2** to focus on core MVP features.

#### MVP Design Approach
For the 8-week MVP, BookTalks will use a **single, consistent design theme** based on the "Daylight" color palette:

**Color Palette:**
- Primary Background: `#F8FAFC` (Pale Slate)
- Card Background: `#FFFFFF` (Pure White)
- Text Primary: `#0F172A` (Slate 900)
- Accent: `#6366F1` (Indigo 500)

**Design Principles:**
- Clean, modern interface with high readability
- Consistent spacing and typography
- Semantic color tokens for easy theme expansion in Phase 2
- Accessibility-first approach (WCAG AA compliance)

**Tailwind Configuration:**
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'bg-primary': '#F8FAFC',
        'bg-card': '#FFFFFF',
        'text-primary': '#0F172A',
        'text-secondary': '#64748B',
        'accent': '#6366F1',
        'accent-hover': '#4F46E5',
      },
    },
  },
};
```

**Phase 2 Enhancement:**
- Time-based atmospheric themes (Daylight, Golden Hour, Midnight)
- Automatic theme switching based on time of day
- Manual theme override in user settings
- Smooth transitions between themes
- See `docs/architecture_react_expo.md` Phase 2 Appendix for full implementation details

---

### 3.8 Push Notifications (Week 7-8)

#### Notification Categories

**Transaction Updates:**
- Request received (lender)
- Request approved/declined (borrower)
- Payment successful
- Book shipped (borrower)
- Delivery confirmed
- Rating reminder (24 hours after delivery)

**Club Activity:**
- New message in active club (configurable frequency)
- New book nominated
- Voting period ending (24-hour reminder)
- Event reminder (1 day before)
- Tagged in message (`@username`)

**Wishlist Matches:**
- Book from wishlist listed nearby
- Price drop for listed book (Phase 2)

**System:**
- Credit earned
- Membership tier upgrade
- Scheduled maintenance
- New feature announcements

#### Notification Settings (Per-Category)
- **Off**: No notifications
- **Push Only**: App notifications
- **Email Digest**: Daily summary email
- **Both**: Real-time push + email digest

---

## 4. Admin Panel (Parallel Track)

### 4.1 Dashboard
**Key Metrics:**
- Total users (breakdown by tier)
- Active transactions (by state)
- Total credits in circulation
- Books listed vs. exchanged ratio
- Dispute rate (%)
- Club activity (messages/day)

**Charts:**
- User growth (30-day trend)
- Transaction volume (weekly)
- Credit flow (earned vs. spent)

### 4.2 Venue Management
**Verification Queue:**
- Pending applications list
- Venue details review
- Photo gallery verification
- Google Maps integration check
- Approve/Reject with reason

**Approved Venues:**
- Edit details
- Suspend/Reactivate
- View associated clubs
- Metrics: Events hosted, foot traffic estimate

### 4.3 User Management
**Search & Filter:**
- By email, phone, display name
- By membership tier
- By account status (active, suspended, banned)
- By trust score range

**User Profile View:**
- Full transaction history
- Credit event log
- Club memberships
- Moderation history (warnings, bans)

**Actions:**
- Adjust credits (with reason)
- Upgrade/downgrade tier (manual override)
- Suspend account (1 day, 7 days, 30 days, permanent)
- Ban account (with reason logged)

### 4.4 Dispute Resolution
**Queue:**
- Sorted by severity + age
- Filters by type (book condition, non-delivery, payment)

**Resolution Interface:**
- Full transaction timeline
- Photos submitted by both parties
- Chat/email correspondence
- Resolution options:
  - Full refund to borrower
  - Partial refund + credit transfer
  - No action (mark resolved)
  - Ban user (if fraudulent)

### 4.5 Content Moderation
**Reports Queue:**
- User-reported messages
- Auto-flagged content (profanity, spam)
- Priority flags (harassment keywords)

**Actions:**
- View full context (last 50 messages)
- Warn user
- Mute user (club-level or platform-wide)
- Ban user from club/platform
- Dismiss report

---

## 5. Phase 2 Features (Post-MVP)

### Barcode Scanning
- Use camera to scan ISBN barcodes
- Auto-fills book details from Google Books
- Faster manual entry alternative

### Goodreads Import
- CSV upload from Goodreads export
- Maps to Google Books IDs
- Preserves ratings/reviews (where possible)

### Venue QR Check-In
- QR code at venue entrances
- Check-in unlocks venue-specific achievements
- Tracks attendance for event credit (Phase 2 gamification)

### Club Book Pool
- Internal library for club members
- Books donated to club (not individual-owned)
- Borrowing doesn't require credits
- Return enforced within club

### Author Program
- Verified authors can:
  - Host virtual AMAs
  - Offer signed editions
  - Early access to new books for club members

### Gamification
- Badges: "First Exchange", "Bookworm (50 books read)", "Community Builder (3 clubs)"
- Streaks: Consecutive days with club activity
- Leaderboards: Top lenders, most active clubs

### Hindi Language Support
- Full UI translation
- Hindi book metadata support
- Regional vernacular expansion roadmap

---

## 6. Technical Standards & Integrations

### Payment: Razorpay
- **Supported Methods**: UPI, Cards, Wallets, NetBanking
- **Test Mode**: Enabled for development
- **Webhook Verification**: HMAC signature validation
- **Refund API**: Automated for disputes

### Logistics: Shiprocket
- **Features**: Label generation, tracking, NDR management
- **Webhook Events**: Pickup, in-transit, delivered, RTO
- **Pricing**: Business account, negotiated rates

### Maps: Google Maps API
- **Geocoding**: Address → Lat/Long for venues
- **Distance Matrix**: Calculate proximity for feeds
- **Places API**: Venue search suggestions

### Analytics: Mixpanel
- **Event Tracking**: User actions (search, list, request, message)
- **Funnels**: Onboarding completion, transaction success
- **Cohort Analysis**: Retention by signup source

---

## 7. Privacy & Data Protection

### User Data Collection
**Collected:**
- Phone number (authentication)
- Display name, city (public profile)
- Email (optional, for notifications)
- Location (city-level, for listings)

**Not Collected:**
- Precise GPS coordinates (only city-level)
- Social media accounts
- Reading preferences (beyond library tracking)

### Data Retention
- Active accounts: Indefinite
- Deleted accounts: 30-day grace period, then purge
- Transaction records: 7 years (legal requirement)
- Chat messages: 1 year rolling window

### GDPR/DPDP Compliance
- Right to access data
- Right to delete account
- Right to export data (JSON format)
- Cookie consent (web version)

---

## 8. Accessibility

### Visual
- WCAG AA contrast ratios (minimum)
- Screen reader support (semantic HTML/RN Accessibility)
- Text scaling up to 200%
- Color-blind friendly palettes

### Motor
- Minimum touch target: 44x44 dp
- Keyboard navigation (web version)
- Swipe gestures alternative to buttons

### Cognitive
- Clear, simple language (Grade 8 reading level)
- Confirmation dialogs for destructive actions
- Undo options where possible
- Progress indicators for multi-step flows

---

## 9. Success Metrics (KPIs)

### North Star Metric
**Books Circulated Per Month**
- Measures core value: keeping books in motion

### Supporting Metrics
1. **Monthly Active Users (MAU)**: Target 10k in month 6
2. **Transaction Completion Rate**: Target 85%+
3. **Average Credit Velocity**: How fast credits circulate (target: 7 days)
4. **Club Engagement**: Messages per active club per week (target: 50+)
5. **NPS Score**: Target 50+ (industry benchmark: 30)
6. **Referral Rate**: % of users who invite others (target: 30%)

### Vanity Metrics (Don't Optimize For)
- Total signups (focus on active users instead)
- App downloads (focus on retention)
- Total books in platform (quality over quantity)

---

## Appendix: Glossary

- **Circulation**: The forward movement of books through the community
- **Credit Hold**: Temporary lock on credits during active transaction request
- **Event Sourcing**: Architecture pattern where state is derived from event log
- **Trust Score**: Aggregate rating from all transaction ratings (hidden calculation)
- **Verified Venue**: Business approved by admin with unique BT-VEN code
- **Wishlist Match**: Notification when desired book is listed nearby
