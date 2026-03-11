# Developer Implementation Checklist

**Use this checklist when implementing database migrations and features.**

---

## Pre-Implementation Review

- [ ] Read `docs/SCHEMA_REFERENCE_GUIDE.md` (quick reference)
- [ ] Review `docs/BEFORE_AFTER_COMPARISON.md` (understand what changed)
- [ ] Check `docs/CONSISTENCY_VERIFICATION_REPORT.md` (verification status)

---

## Listings Table Implementation

- [ ] Use column name: `owner_id` (NOT `user_id`)
- [ ] Use status enum: `'active', 'on_hold', 'lent_out', 'inactive'`
- [ ] Add status explanation comments in migration
- [ ] Include REQUIRED city field for intra-city filtering
- [ ] Create index: `idx_listings_city_status`
- [ ] Create index: `idx_listings_location_gist` (PostGIS)
- [ ] Implement RLS policy: Only view active listings in user's city
- [ ] Implement RLS policy: Only owner can update/delete

---

## Credit System Implementation

- [ ] Create `credit_events` table (append-only)
- [ ] Create `user_credit_balances` as TABLE (NOT materialized view)
- [ ] Create trigger: `trigger_update_credit_balance`
- [ ] Create function: `update_credit_balance()`
- [ ] Verify trigger fires on INSERT to credit_events
- [ ] Test real-time balance updates (no refresh lag)
- [ ] Implement RLS policy: Users only see their own balance

---

## Venues Table Implementation

- [ ] Use venue_type enum: `'cafe', 'library', 'bookstore', 'community_center'`
- [ ] Do NOT use: 'coworking', 'other'
- [ ] Include location field: `GEOGRAPHY(POINT)` (PostGIS)
- [ ] Create index: `idx_venues_location_gist`
- [ ] Create index: `idx_venues_city`
- [ ] Test proximity queries (within 5km)

---

## Edge Functions Implementation

### Critical Priority (Implement First)
- [ ] `create-payment-order` - Razorpay integration
- [ ] `verify-payment` - Webhook handler with HMAC verification
- [ ] `book-shipment` - Porter/Dunzo API calls
- [x] `complete-transaction` - Atomic credit transfer — Deployed 2026-02-18
- [x] `transfer-credits` - Manual credit operations — Deployed 2026-02-18

### High Priority (Implement Second)
- [ ] `wishlist-notify` - Listing match notifications
- [ ] `check-membership-limits` - Club tier enforcement
- [ ] `send-notification` - FCM push notifications

### Medium Priority (Implement Third)
- [ ] `refund-deposit` - Razorpay refund processing
- [ ] `moderate-content` - Auto-moderation

---

## RLS Policy Implementation

### Listings
- [ ] Users can view active listings in their city only
- [ ] Only owner can update/delete their listings
- [ ] Test with different user cities

### Transactions
- [ ] Only lender and borrower can view transaction details
- [ ] Test with non-participant user (should see nothing)

### Credit Events
- [ ] Users can only view their own credit history
- [ ] Inserts only via Edge Functions (not direct client access)

### Book Clubs
- [ ] Only club members can view club details
- [ ] Only admin can update club settings

---

## Testing Checklist

- [ ] Verify all enum values match documentation
- [ ] Test RLS policies with different user roles
- [ ] Test credit balance updates (real-time)
- [ ] Test listing status transitions
- [ ] Test venue proximity queries
- [ ] Test Edge Function invocations
- [ ] Verify no hardcoded credentials in migrations

---

## Documentation Checklist

- [ ] Add migration comments explaining enum values
- [ ] Document RLS policy intent in migration
- [ ] Add comments for non-obvious column names (owner_id)
- [ ] Reference SCHEMA_REFERENCE_GUIDE.md in code comments

---

## Code Review Checklist

- [ ] Verify column names match documentation
- [ ] Verify enum values match documentation
- [ ] Verify RLS policies are implemented
- [ ] Verify triggers are created correctly
- [ ] Verify indexes are created for performance
- [ ] Verify no breaking changes to existing migrations

---

## Deployment Checklist

- [ ] Run migrations in order (001, 002, 003, etc.)
- [ ] Verify all tables created successfully
- [ ] Verify all triggers created successfully
- [ ] Verify all RLS policies enabled
- [ ] Test critical paths in staging environment
- [ ] Verify Edge Functions deployed
- [ ] Monitor for errors in first 24 hours

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `SCHEMA_REFERENCE_GUIDE.md` | Quick enum/column reference |
| `DATABASE.md` | Full schema documentation |
| `architecture_react_expo.md` | Complete SQL schemas |
| `EDGE_FUNCTIONS_IMPLEMENTATION_LIST.md` | Edge Function specs |
| `BEFORE_AFTER_COMPARISON.md` | What changed and why |

---

**Last Updated:** 2025-02-17  
**Status:** Ready for implementation ✅

