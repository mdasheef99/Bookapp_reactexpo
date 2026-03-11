# BookTalks Mobile - Changelog

**Last Updated:** 2024-02-14

---

## [Unreleased] - 2024-02-14

### Documentation Refactoring

**Major Changes:**
- Split comprehensive documentation into 9 focused files for better organization
- Created `docs/archive/` folder with timestamped backups of original documentation
- Created `docs/MIGRATION_MAP.md` to track content relocation

**New Documentation Structure:**
- `README.md` - Project overview and quick start
- `ARCHITECTURE.md` - System architecture and design patterns
- `DATABASE.md` - Complete database schema
- `EDGE_FUNCTIONS.md` - Edge Function specifications
- `API_REFERENCE.md` - Frontend developer guide for Supabase usage
- `THIRD_PARTY_INTEGRATIONS.md` - Third-party API integration details
- `DEPLOYMENT.md` - Environment setup and deployment guide
- `MIGRATION_GUIDE.md` - Database migrations and SQL scripts
- `CHANGELOG.md` - Version history and changes (this file)

**Archived Files:**
- `architecture_react_expo_2024-02-14.md` (1629 lines)
- `booktalks_mobile_spec_2024-02-14.md` (985 lines)
- `EDGE_FUNCTIONS_IMPLEMENTATION_LIST_2024-02-14.md`

---

## [MVP Scope] - 2024-01-XX

### Core Differentiators Updated

**Changed:**
- Replaced "Atmospheric UI" with "Intra-City Focus" as core differentiator
- Atmospheric theme deferred to Phase 2
- Intra-city delivery is now a core MVP differentiator

**Rationale:**
- Focus on faster, sustainable delivery within same city
- Reduce complexity for 8-week MVP timeline

---

### Membership Tiers Restructured

**Breaking Changes:**

| Tier | Old Limits | New Limits |
|------|-----------|------------|
| Free | 1 club membership, 0 creates | Unlimited memberships, 0 creates |
| Pro ($2.99/month) | 3 memberships, 1 create | Unlimited memberships, 5 creates |
| Pro+ ($4.99/month) | Unlimited memberships, 3 creates | Unlimited memberships, 15 creates |

**New Features:**
- Club member eligibility now depends on a user's `membership_tier` satisfying the club `access_level`
- Moderator role requires Pro/Pro+ subscription
- Admin role requires Pro/Pro+ subscription
- 30-day grace period for downgrades with warnings on Day 7, 14, 21, 29
- User can choose which clubs to keep during downgrade
- Fallback to chronology (oldest created = kept) if user doesn't choose
- Archived clubs can be un-archived within 180 days
- After 180 days, members can request admin takeover (requires Pro/Pro+ upgrade)

**Impact:**
- More generous Free tier to encourage adoption
- Higher club creation limits for paid tiers to support power users
- Graceful downgrade handling to prevent data loss

---

### Terminology Change: "Lead" → "Admin"

**Breaking Changes:**
- All references to "Club Lead" replaced with "Club Admin"
- Database field `book_clubs.lead_id` renamed to `book_clubs.admin_id`
- Role enum updated: `'lead'` → `'admin'`

**Migration Required:**
- Migration 004: `004_rename_lead_to_admin.sql`
- Manual migration script: `manual_migration_lead_to_admin.sql` (at project root)

**Impact:**
- Frontend must update all UI references
- Edge Functions must use `admin_id` instead of `lead_id`
- No data loss; all existing clubs retain their leadership structure

---

### Intra-City Delivery Scope

**New Constraints:**
- All exchanges limited to same city (Mumbai→Mumbai, Bangalore→Bangalore)
- No inter-city shipping in MVP
- Metropolitan areas treated as single cities (e.g., Mumbai includes Navi Mumbai, Thane)

**Benefits:**
- Faster delivery (same-day/next-day)
- Lower costs (₹40-80 vs ₹100-200 for inter-city)
- Sustainable logistics (reduced carbon footprint)

**Database Changes:**
- `listings.city` field now required (NOT NULL)
- City-based index added for filtering
- Listings only visible to users in same city

**UI Changes:**
- Address entry required when creating first listing OR making first borrow request
- Removed distance filters (5km, 10km, 25km, 50km+)
- Added city-based matching in browse/discovery

---

### Delivery Service Integration

**Changed:**
- Replaced Shiprocket with Porter and Dunzo for intra-city delivery
- Delivery cost paid directly to Porter/Dunzo (NOT via Razorpay)
- Deposit (₹100-500) paid via Razorpay (refundable)

**New Features:**
- Real-time tracking links for Porter/Dunzo deliveries
- Delivery service selector (Porter vs Dunzo)
- Meetup option: Lender marks "Handed Over" after in-person exchange

**Database Changes:**
- `transactions.delivery_type` CHECK constraint updated: `('porter', 'dunzo', 'meetup')`
- `transactions.delivery_service` field added: Stores which service was chosen
- `transactions.tracking_url` field added: Real-time tracking link

**Edge Functions:**
- `book-shipment` function updated to support Porter and Dunzo APIs
- Webhook handlers for Porter and Dunzo delivery events

---

### Club Meeting Types

**New Feature:**
- **Online-Only:** Virtual meetings, no venue required
- **Venue-Based:** Physical venue mandatory (selected from verified list)
- **Hybrid:** Mix of online and venue-based meetings

**Database Changes:**
- `book_clubs.meeting_type` field added: `('online_only', 'venue_based', 'hybrid')`

**UI Changes:**
- Meeting type selector in club creation/edit form
- Venue selection dropdown (filtered by city) for venue-based/hybrid clubs
- Conversion option: Admins can change meeting type anytime

---

### Venue System

**Venue List Population Strategy:**
1. **Admin-seeded venues:** 20-30 popular venues per major city (Phase 1)
2. **Venue owner registration:** Subject to admin verification (Phase 1)
3. **User-suggested venues:** Requires owner verification (Phase 2)

**Venue Selection:**
- Filtered by user's city
- Search by name, type, neighborhood
- Missing venue: Start as online-only club, convert later OR request venue addition

---

### Design System

**MVP Approach:**
- Single theme based on "Daylight" palette
- Semantic color tokens for easy Phase 2 expansion
- Tailwind config with consistent color naming

**Deferred to Phase 2:**
- Full Atmospheric Theme Engine (time-sensitive design)
- Multiple theme variants (Dawn, Daylight, Dusk, Night)
- Automatic theme switching based on time of day

---

## Migration Notes

### Database Migrations

**Total Migrations:** 5
1. **001_users_credits_schema.sql** - Users & Credits (Event-Sourced)
2. **002_exchange_schema.sql** - P2P Exchange
3. **003_venues_clubs_schema.sql** - Venues & Clubs
4. **004_rename_lead_to_admin.sql** - Terminology Update (Lead → Admin)
5. **005_chat_moderation_schema.sql** - Chat & Moderation

**Running Migrations:**
```
supabase db push
```

**Rollback:**
Each migration includes rollback SQL in comments.

---

## Related Documentation

- **[README.md](./README.md)** - Project overview
- **[MIGRATION_MAP.md](./MIGRATION_MAP.md)** - Content relocation guide
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Database migration instructions
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture
- **[DATABASE.md](./DATABASE.md)** - Database schema

