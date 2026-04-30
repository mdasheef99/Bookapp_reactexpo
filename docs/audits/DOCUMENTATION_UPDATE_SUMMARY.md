# BookTalks Documentation Update Summary

**Date:** 2024-01-XX
**Last Updated:** 2024-02-14
**Purpose:** Comprehensive documentation update to reflect intra-city delivery scope, membership tier restructuring, terminology changes, and Phase 2 deferrals.

**⚠️ NOTE:** This file documents historical changes. For current documentation, see the new 9-file structure in `docs/` directory. See [MIGRATION_MAP.md](./MIGRATION_MAP.md) for content relocation guide.

---

## 1. Changes Made to Original Documentation

### 1.1 Core Differentiators
**Change:** Replaced "Atmospheric UI" with "Intra-City Focus"
- **Old:** "Atmospheric UI: Time-sensitive design that adapts to reading context"
- **New:** "Intra-City Focus: Hyperlocal book exchanges within the same city for faster, sustainable delivery"
- **Rationale:** Atmospheric theme deferred to Phase 2; intra-city delivery is a core MVP differentiator
- **Current Location:** [README.md](./README.md#core-differentiators)

### 1.2 Membership Tiers
**Major Restructuring:**

| Tier | Old Limits | New Limits |
|------|-----------|------------|
| Free | 1 club membership, 0 creates | Unlimited memberships, 0 creates |
| Pro | 3 memberships, 1 create | Unlimited memberships, 5 creates |
| Pro+ | Unlimited memberships, 3 creates | Unlimited memberships, 15 creates |

**New Features Added:**
- Free tier users can be promoted to Moderator (but not Admin)
- Admin role requires Pro/Pro+ subscription
- 30-day grace period for downgrades with warnings on Day 7, 14, 21, 29
- User can choose which clubs to keep; fallback to chronology (oldest created = kept)
- Archived clubs can be un-archived within 180 days
- After 180 days, members can request admin takeover (requires Pro/Pro+ upgrade)
- **Current Location:** [README.md](./README.md#membership-tiers)

### 1.3 P2P Exchange System
**Intra-City Delivery Scope Added:**
- All exchanges limited to same city (Mumbai→Mumbai, Bangalore→Bangalore)
- No inter-city shipping in MVP
- Metropolitan areas treated as single cities (e.g., Mumbai includes Navi Mumbai, Thane)
- Benefits: Faster delivery (same-day/next-day), lower costs (₹40-80), sustainable logistics
- Address entry required when creating first listing OR making first borrow request
- **Current Location:** [ARCHITECTURE.md](./ARCHITECTURE.md#transaction-flow)

**Transaction State Machine Updated:**
- **Payment:** Deposit (₹100-500) paid via Razorpay; delivery cost paid directly to Porter/Dunzo
- **Delivery Options:** Porter, Dunzo, or meet in person
- **Tracking:** Real-time tracking links for Porter/Dunzo deliveries
- **Meetup:** Lender marks "Handed Over" after in-person exchange
- **Current Location:** [ARCHITECTURE.md](./ARCHITECTURE.md#transaction-flow), [DATABASE.md](./DATABASE.md#transactions-table)

**Browse & Discovery Updated:**
- Removed distance filters (5km, 10km, 25km, 50km+)
- Added city-based matching: Listings only visible to users in same city
- Sort by: Recently listed, Condition, Proximity (neighborhood-level)
- Filters: Condition, Delivery method, Book category/genre
- **Current Location:** [DATABASE.md](./DATABASE.md#listings-table)

### 1.4 Book Clubs & Community
**Club Meeting Types Added:**
- **Online-Only:** Virtual meetings, no venue required
- **Venue-Based:** Physical venue mandatory (selected from verified list)
- **Hybrid:** Mix of online and venue-based meetings
- **Conversion:** Admins can change meeting type anytime; all members notified
- **Current Location:** [DATABASE.md](./DATABASE.md#book-clubs-table)

**Terminology Change: "Lead" → "Admin":**
- All references to "Club Lead" replaced with "Club Admin"
- Admin role requires Pro/Pro+ subscription
- **Moderator role requires Pro/Pro+ subscription** (corrected from earlier draft that listed Free tier eligibility)
- Updated permissions table with new "Transfer admin role" permission
- **Current Location:** [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md#migration-004), [CHANGELOG.md](./CHANGELOG.md#terminology-change), [CLUBS_ENTITLEMENT_IMPLEMENTATION_ANALYSIS_2026-03-10.md](../features/CLUBS_ENTITLEMENT_IMPLEMENTATION_ANALYSIS_2026-03-10.md)

**Membership Tier Limits Table Updated:**
- Free: Unlimited joins (clubs with `access_level = all` only), 0 creates, cannot hold Moderator/Admin roles
- Pro: Unlimited joins (clubs with `access_level = all` or `pro`), 5 creates, may hold Moderator/Admin roles
- Pro+: Unlimited joins (all access levels), 15 creates, may hold Moderator/Admin roles
- **Current Location:** [README.md](./README.md#membership-tiers)

### 1.5 Venues System
**Venue List Population Strategy Added:**
- **Hybrid Approach:**
  1. Admin-seeded venues: 20-30 popular venues per major city (Phase 1)
  2. Venue owner registration: Subject to admin verification (Phase 1)
  3. User-suggested venues: Requires owner verification (Phase 2)
- **Venue Selection:** Filtered by user's city; search by name, type, neighborhood
- **Missing Venue:** Start as online-only club, convert later OR request venue addition
- **Current Location:** [DATABASE.md](./DATABASE.md#venues-table)

### 1.6 Design System
**Atmospheric Theme Deferred to Phase 2:**
- Replaced full Atmospheric Design System section with MVP approach
- Single theme based on "Daylight" palette for MVP
- Semantic color tokens for easy Phase 2 expansion
- Tailwind config with consistent color naming
- Full Atmospheric Theme implementation moved to Phase 2 section
- **Current Location:** [ARCHITECTURE.md](./ARCHITECTURE.md#design-system)

---

## 2. Database Schema Updates

### 2.1 Core Tables

**user_profiles table:**
- Added comment: "Free: unlimited joins, 0 creates; Pro: unlimited joins, 5 creates; Pro+: unlimited joins, 15 creates"
- **Current Location:** [DATABASE.md](./DATABASE.md#user-profiles-table)

**listings table:**
- Changed `city TEXT` to `city TEXT NOT NULL` with comment: "REQUIRED: For intra-city matching"
- Added comment to index: "CRITICAL: Used for intra-city filtering"
- **Current Location:** [DATABASE.md](./DATABASE.md#listings-table)

**transactions table:**
- Updated `delivery_type` CHECK constraint: `('porter', 'dunzo', 'meetup')`
- Added `delivery_service TEXT` field: Stores which service was chosen ('porter' or 'dunzo')
- Added `tracking_url TEXT` field: Real-time tracking link
- Updated comments:
  - `shipping_cost`: "Paid directly to Porter/Dunzo (not via Razorpay)"
  - `deposit_amount`: "Refundable deposit (₹100-500) paid via Razorpay"
  - `awb_number`: "Tracking number from Porter/Dunzo"
- **Current Location:** [DATABASE.md](./DATABASE.md#transactions-table)

**book_clubs table:**
- Added `meeting_type TEXT CHECK (meeting_type IN ('online_only', 'venue_based', 'hybrid'))` field
- Renamed `lead_id` to `admin_id` with comment: "RENAMED from lead_id"
- Added `archived_at TIMESTAMPTZ` field: "Track when club was archived"
- **Current Location:** [DATABASE.md](./DATABASE.md#book-clubs-table)

**club_members table:**
- Changed role CHECK constraint: `('member', 'moderator', 'admin')` (was `'lead'`)
- Added comment: "CHANGED: 'lead' → 'admin'"
- **Current Location:** [DATABASE.md](./DATABASE.md#club-members-table)

### 2.2 Migration 004: Lead → Admin Rename
**New Migration Added:**
```sql
-- Rename column in book_clubs
ALTER TABLE book_clubs RENAME COLUMN lead_id TO admin_id;

-- Update role enum in club_members
UPDATE club_members SET role = 'admin' WHERE role = 'lead';

-- Update CHECK constraint
ALTER TABLE club_members DROP CONSTRAINT club_members_role_check;
ALTER TABLE club_members ADD CONSTRAINT club_members_role_check
  CHECK (role IN ('member', 'moderator', 'admin'));
```

**Rollback Script Included:**
- Complete rollback instructions for reverting changes if needed

**Impact Notes:**
- Frontend must update all references from "Lead" to "Admin"
- Edge Functions must use `admin_id` instead of `lead_id`
- **Current Location:** [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md#migration-004)

### 2.3 Design System
**Atmospheric Theme Deferred:**
- Replaced full Atmospheric Theme Engine section with MVP approach
- Single theme configuration with semantic tokens
- Component usage pattern with semantic color names
- Note added: "See Appendix A for full Atmospheric Theme implementation (Phase 2)"
- **Current Location:** [ARCHITECTURE.md](./ARCHITECTURE.md#design-system)

### 2.4 Edge Functions
**Payment Order Creation Updated:**
- Removed shipping cost calculation (paid separately to Porter/Dunzo)
- Deposit calculation based on book condition (₹100-500)
- Updated Razorpay order notes to include `type: 'refundable_deposit'`
- Clarified: "Delivery cost is paid separately to Porter/Dunzo, not via Razorpay"
- **Current Location:** [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md#create-payment-order)

---

## 3. Database Migration Scripts

### Migration 004: Lead → Admin Rename
**File:** `supabase/migrations/004_rename_lead_to_admin.sql`

**Changes:**
1. Rename `book_clubs.lead_id` → `book_clubs.admin_id`
2. Update `club_members.role` enum: `'lead'` → `'admin'`
3. Update CHECK constraint on `club_members.role`

**Rollback:** Included in migration file

**Testing Required:**
- Verify all existing clubs retain admin assignments
- Test RLS policies with new column name
- Verify Edge Functions work with `admin_id`

**Current Location:** [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md#migration-004)

---

## 4. Cascading Changes and Implications

### 4.1 Frontend Changes Required
**Terminology Updates:**
- Replace all "Club Lead" with "Club Admin" in UI
- Update role badges and labels
- Update permissions descriptions

**API Changes:**
- Update all queries using `lead_id` to `admin_id`
- Update club creation/update forms to use `admin_id`
- Update role assignment logic

**New Features to Implement:**
- Club meeting type selector (online-only, venue-based, hybrid)
- Venue selection dropdown (filtered by city)
- Delivery service selector (Porter vs Dunzo)
- Downgrade grace period UI (warnings, club selection)
- Un-archival functionality (within 180 days)

### 4.2 Backend Changes Required
**Edge Functions:**
- `create-payment-order`: Already updated (deposit only)
- `book-shipment`: **NEW FUNCTION NEEDED** for Porter/Dunzo API integration
- `complete-transaction`: Verify deposit refund logic
- `check-membership-limits`: **NEW FUNCTION NEEDED** for tier enforcement

**Scheduled Jobs:**
- Downgrade grace period checker (runs daily)
- Warning notifications (Day 7, 14, 21, 29)
- Auto-archival on Day 30
- Un-archival expiration checker (180 days)

**RLS Policies:**
- Update policies referencing `lead_id` to use `admin_id`
- Add city-based filtering for listings
- Add tier-based restrictions for club creation

### 4.3 Third-Party Integrations
**Porter API Integration:**
- Endpoint: `https://api.porter.in/v1/orders`
- Authentication: API key
- Features: Create order, track shipment, get delivery cost estimate
- **Current Location:** [THIRD_PARTY_INTEGRATIONS.md](./THIRD_PARTY_INTEGRATIONS.md#porter)

**Dunzo API Integration:**
- Endpoint: `https://apis.dunzo.in/api/v1/`
- Authentication: API key
- Features: Create task, track delivery, get cost estimate
- **Current Location:** [THIRD_PARTY_INTEGRATIONS.md](./THIRD_PARTY_INTEGRATIONS.md#dunzo)

**Razorpay:**
- No changes needed (already integrated for deposits)
- Ensure refund logic works correctly
- **Current Location:** [THIRD_PARTY_INTEGRATIONS.md](./THIRD_PARTY_INTEGRATIONS.md#razorpay)

---

## 5. Questions and Ambiguities Discovered

### 5.1 Resolved Questions
All questions from the initial clarification phase have been resolved:
1. ✅ Porter vs Dunzo: Both supported, user choice
2. ✅ Intra-city confirmed (not inter-city)
3. ✅ Address entry: When creating first listing or borrow request
4. ✅ Venue association: Mandatory for venue-based clubs
5. ✅ Club conversion: Bidirectional (online ↔ venue-based)
6. ✅ Downgrade grace period: 30 days with warnings
7. ✅ Club archival: User choice or chronology
8. ✅ Un-archival: 180 days, then admin takeover
9. ✅ Payment: Deposit via Razorpay, delivery via Porter/Dunzo
10. ✅ Admin migration: Separate Migration 004 file
11. ✅ Venue list: Hybrid (admin seeds + owner registration)
12. ✅ Free tier: Can be Moderator, not Admin

### 5.2 Implementation Details Needed
**Porter/Dunzo Integration:**
- API documentation review required
- Error handling for failed deliveries
- Webhook setup for delivery status updates
- Cost estimation logic (before user confirms)

**City Matching Logic:**
- Define metropolitan area groupings (e.g., NCR, Mumbai Metro)
- GPS vs manual city selection priority
- City change notification to users

**Venue Verification:**
- Admin panel for venue approval
- Verification checklist and criteria
- Rejection reason templates

---

## 6. Testing Recommendations

### 6.1 Database Migration Testing
1. Test Migration 004 on staging database
2. Verify rollback script works correctly
3. Test with existing data (clubs with leads)
4. Verify RLS policies work with new column names

### 6.2 Feature Testing
**Membership Tiers:**
- Test downgrade flow (Pro→Free, Pro+→Pro)
- Verify grace period warnings
- Test club archival and un-archival
- Test admin succession after 180 days

**Intra-City Delivery:**
- Test city-based listing filtering
- Test Porter/Dunzo API integration
- Test meetup flow
- Test deposit payment and refund

**Club Meeting Types:**
- Test club type conversion
- Test venue selection
- Test member notifications on conversion

---

## 7. Next Steps

### 7.1 Immediate Actions
1. ✅ Review and approve this summary document
2. ⏳ Create Migration 004 SQL file
3. ⏳ Update frontend components with new terminology
4. ⏳ Implement Porter/Dunzo API integration
5. ⏳ Create downgrade grace period Edge Function
6. ⏳ Update RLS policies for city-based filtering

### 7.2 Phase 1 Completion
- Implement all MVP features with updated specifications
- Test intra-city delivery flow end-to-end
- Verify membership tier limits enforcement
- Complete venue list seeding for major cities

### 7.3 Phase 2 Planning
- Atmospheric Theme Engine implementation
- Inter-city delivery expansion
- Advanced club categorization
- Enhanced venue features

---

## 8. Document Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2024-01-XX | 1.0 | Initial comprehensive update | AI Assistant |

---

**End of Summary**

