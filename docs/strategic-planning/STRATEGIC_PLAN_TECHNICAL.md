# BookTalks Mobile - Strategic Implementation Plan: Technical Guide

**Version:** 1.0.0  
**Created:** 2026-02-17  
**Last Updated:** 2026-02-18
**Next Review:** 2026-02-24

---

## 📋 Document Navigation

- [← Back to Overview](./STRATEGIC_PLAN_OVERVIEW.md)
- [→ Investor Preparation Guide](./STRATEGIC_PLAN_INVESTOR_PREP.md)

---

## 🎯 Phase 0: Documentation Fixes (Week 1, Days 1-2)

**Goal:** Fix all documentation issues identified in DOCUMENTATION_FIXES_REQUIRED.md  
**Estimated Effort:** 8 hours  
**Dependencies:** None  
**Risk Level:** 🟢 Low

### Tasks

#### 0.1 Fix Broken Anchor Links (~15 links, 4 hours)
- [ ] Fix anchor links in README.md (estimated 5 links)
- [ ] Fix anchor links in ARCHITECTURE.md (estimated 3 links)
- [ ] Fix anchor links in DATABASE.md (estimated 4 links)
- [ ] Fix anchor links in EDGE_FUNCTIONS.md (estimated 3 links)
- [ ] Verify all links work using markdown link checker

**Completion Criteria:**
- All anchor links navigate correctly
- No broken internal references

#### 0.2 Archive Old Files (2 hours)
- [ ] Move old files to `docs/archive/` directory
- [ ] Update any references to archived files
- [ ] Add README in archive explaining why files were moved

**Completion Criteria:**
- Old files moved to archive
- No references to archived files in active documentation

#### 0.3 Create Migration SQL Files (2 hours)
- [ ] Create placeholder files in `supabase/migrations/`
  - `001_users_credits_schema.sql`
  - `002_exchange_schema.sql`
  - `003_venues_clubs_schema.sql`
  - `004_rename_lead_to_admin.sql`
  - `005_chat_moderation_schema.sql`
- [ ] Add file headers with version and description
- [ ] Reference DATABASE.md for schema details

**Completion Criteria:**
- 5 migration files exist in correct directory
- Files have proper headers and comments

---

## 🔐 Phase 1: Foundation & Security (Week 1, Days 3-5)

**Goal:** Fix critical security issues and deploy database schema  
**Estimated Effort:** 24 hours  
**Dependencies:** Phase 0 complete  
**Risk Level:** 🟡 Medium (database deployment)

### 1.1 Security Fixes (8 hours)

#### 1.1.1 Move Credentials to Environment Variables (2 hours)
- [ ] Create `.env` file from `.env.example`
- [ ] Add Supabase URL and anon key to `.env`
- [ ] Update `src/lib/supabase.ts` to use `process.env`
- [ ] Add `.env` to `.gitignore` (verify it's already there)
- [ ] Test that app still connects to Supabase

**Code Change:**
```typescript
// src/lib/supabase.ts
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
```

**Completion Criteria:**
- No hardcoded credentials in codebase
- App connects successfully using environment variables

#### 1.1.2 Configure Session Persistence (3 hours)
- [ ] Install MMKV if not already installed: `npm install react-native-mmkv`
- [ ] Create `src/lib/mmkvStorage.ts` adapter
- [ ] Update `src/lib/supabase.ts` to use MMKV storage
- [ ] Test session persists across app restarts
- [ ] Add encryption to MMKV storage

**Code Change:**
```typescript
// src/lib/supabase.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: mmkvStorage,
    autoRefreshToken: true,
    persistSession: true,
  },
});
```

**Completion Criteria:**
- User stays logged in after app restart
- Session tokens encrypted in storage

#### 1.1.3 Add Error Boundary (2 hours)
- [ ] Create `src/components/ErrorBoundary.tsx`
- [ ] Wrap app in error boundary in `app/_layout.tsx`
- [ ] Add error reporting (console.error for now)
- [ ] Test with intentional error

**Completion Criteria:**
- App shows error screen instead of white screen on crash
- Errors logged for debugging

#### 1.1.4 Add Input Validation (1 hour)
- [ ] Add phone number validation in login screen
- [ ] Add OTP validation (6 digits)
- [ ] Show user-friendly error messages

**Completion Criteria:**
- Invalid phone numbers rejected before API call
- Clear error messages shown to user

---

### 1.2 Database Migrations (16 hours)

#### 1.2.1 Create Users & Credits Schema (4 hours)
- [ ] Write `001_users_credits_schema.sql` based on DATABASE.md
- [ ] Include tables: user_profiles, credit_events, user_credit_balances, books, user_books
- [ ] Add RLS policies for each table
- [ ] Add indexes for performance
- [ ] Add triggers for credit_events → user_credit_balances

**Completion Criteria:**
- Migration runs without errors in Supabase SQL Editor
- RLS policies tested with test users
- Triggers update balances correctly

#### 1.2.2 Create Exchange Schema (4 hours)
- [ ] Write `002_exchange_schema.sql` based on DATABASE.md
- [ ] Include tables: listings, transactions, transaction_events, user_addresses
- [ ] Add RLS policies for each table
- [ ] Add indexes for city-based filtering
- [ ] Add triggers for transaction state machine

**Completion Criteria:**
- Migration runs without errors
- City-based filtering works (PostGIS queries)
- Transaction state machine enforced

#### 1.2.3 Create Venues & Clubs Schema (4 hours)
- [ ] Write `003_venues_clubs_schema.sql` based on DATABASE.md
- [ ] Include tables: venues, book_clubs, club_members, club_books
- [ ] Add RLS policies for each table
- [ ] Add indexes for geospatial queries
- [ ] Add triggers for membership limits

**Completion Criteria:**
- Migration runs without errors
- Membership limits enforced (Free: 0 creates, Pro: 5 creates, Pro+: 15 creates)
- Geospatial queries work

#### 1.2.4 Create Chat & Moderation Schema (3 hours)
- [ ] Write `005_chat_moderation_schema.sql` based on DATABASE.md
- [ ] Include tables: club_messages, message_reactions, club_events, moderation_actions
- [ ] Add RLS policies for each table
- [ ] Add indexes for real-time queries
- [ ] Add triggers for auto-moderation

**Completion Criteria:**
- Migration runs without errors
- Real-time subscriptions work
- Auto-moderation triggers fire correctly

#### 1.2.5 Deploy All Migrations (1 hour)
- [ ] Run migrations in Supabase dashboard (SQL Editor)
- [ ] Verify all tables created
- [ ] Verify all RLS policies active
- [ ] Seed test data (5 users, 20 books)
- [ ] Test RLS policies with different users

**Completion Criteria:**
- All tables exist in Supabase
- RLS policies prevent unauthorized access
- Test data inserted successfully

---

## 📦 Phase 2: Exchange Backend (Weeks 2-3) — 🟡 In Progress

**Goal:** Implement exchange services and Edge Functions
**Estimated Effort:** 40 hours
**Dependencies:** Phase 1 complete (database deployed)
**Risk Level:** 🟡 Medium (payment/delivery API dependencies)
**Progress:** Service layer created (2026-02-18), FK architecture fixed, storage buckets deployed. Edge Functions and TanStack hooks remaining.

### 2.1 Exchange Services (16 hours)

#### 2.1.1 Create Listings Service (6 hours) — 🟡 Partially Complete (2026-02-18)
- [x] Create `src/features/exchange/services/listingsService.ts` (313 lines)
- [x] Implement CRUD operations: createListing, browseListings, getListingDetails, getMyListings, pauseListing, activateListing, deleteListing
- [x] Add city-based filtering
- [x] Add pagination support (limit/offset)
- [x] Create `src/features/auth/services/profileService.ts` (86 lines) — shared profile helper
- [ ] Add TanStack Query hooks in `src/features/exchange/hooks/useListings.ts`

**Note:** Service follows "Lean Lists, Rich Details" coding standard. FK constraints fixed to point to `user_profiles(user_id)`.

**Completion Criteria:**
- ~~User can create listing from library book~~ ✅ Service ready
- ~~Listings filtered by user's city~~ ✅ Service ready
- Pagination works correctly
- **Remaining:** TanStack Query hooks

#### 2.1.2 Create Transactions Service (6 hours) — 🟡 Partially Complete (2026-02-18)
- [x] Create `src/features/exchange/services/transactionsService.ts` (236 lines)
- [x] Implement transaction flow: wraps all 6 RPC calls (requestTransaction, approveTransaction, declineTransaction, cancelTransaction, completeTransaction, transitionStatus)
- [x] Add transaction state machine validation (handled by DB functions)
- [x] Create `src/features/credits/services/creditService.ts` (145 lines) — balance, history, Realtime
- [ ] Add TanStack Query hooks in `src/features/exchange/hooks/useTransactions.ts`

**Note:** Service follows "Lean Lists, Rich Details" coding standard. All state transitions enforced by SECURITY DEFINER DB functions.

**Completion Criteria:**
- ~~Transaction state transitions work correctly~~ ✅ DB functions handle this
- ~~Invalid state transitions rejected~~ ✅ DB functions handle this
- ~~Transaction history queryable~~ ✅ Service ready
- **Remaining:** TanStack Query hooks

#### 2.1.3 Create Addresses Service (4 hours)
- [ ] Create `src/features/exchange/services/addressesService.ts`
- [ ] Implement CRUD operations for user addresses
- [ ] Add geocoding integration (Google Maps API)
- [ ] Add TanStack Query hooks

**Completion Criteria:**
- User can add/edit/delete addresses
- Addresses geocoded to lat/lng
- Default address selectable

---

### 2.2 Edge Functions - Payment (12 hours)

#### 2.2.1 Create Payment Order Function (4 hours)
- [ ] Create `supabase/functions/create-payment-order/index.ts`
- [ ] Install Razorpay SDK: `npm install razorpay`
- [ ] Implement Razorpay order creation
- [ ] Add error handling and logging
- [ ] Test with Razorpay test mode

**Reference:** See EDGE_FUNCTIONS_IMPLEMENTATION_LIST.md for detailed spec

**Completion Criteria:**
- Function creates Razorpay order successfully
- Returns order_id to client
- Logs all requests for debugging

#### 2.2.2 Verify Payment Function (4 hours)
- [ ] Create `supabase/functions/verify-payment/index.ts`
- [ ] Implement Razorpay signature verification
- [ ] Update transaction status on success
- [ ] Handle webhook retries
- [ ] Test with Razorpay webhooks

**Completion Criteria:**
- Signature verification works correctly
- Transaction status updated atomically
- Webhook retries handled

#### 2.2.3 Refund Deposit Function (4 hours)
- [ ] Create `supabase/functions/refund-deposit/index.ts`
- [ ] Implement Razorpay refund API call
- [ ] Update transaction status
- [ ] Log refund events
- [ ] Test refund flow

**Completion Criteria:**
- Refunds processed successfully
- Transaction status updated
- Refund events logged

---

### 2.3 Edge Functions - Delivery (8 hours)

#### 2.3.1 Book Shipment Function (4 hours)
- [ ] Create `supabase/functions/book-shipment/index.ts`
- [ ] Integrate Porter API (or Dunzo as fallback)
- [ ] Calculate delivery cost based on distance
- [ ] Create shipment and return tracking ID
- [ ] Test with Porter sandbox

**Completion Criteria:**
- Shipment created successfully
- Tracking ID returned to client
- Delivery cost calculated correctly

#### 2.3.2 Shipment Webhook Handler (4 hours)
- [ ] Add webhook endpoint to book-shipment function
- [ ] Handle delivery status updates
- [ ] Update transaction status on delivery
- [ ] Send push notification on delivery
- [ ] Test with Porter webhooks

**Completion Criteria:**
- Webhook signature verified
- Transaction status updated on delivery
- Push notification sent

---

### 2.4 Edge Functions - Credits (4 hours)

#### 2.4.1 Complete Transaction Function (2 hours)
- [ ] Create `supabase/functions/complete-transaction/index.ts`
- [ ] Implement atomic credit transfer
- [ ] Create credit_events entries
- [ ] Update user_credit_balances via trigger
- [ ] Test credit transfer

**Completion Criteria:**
- Credits transferred atomically
- Both users' balances updated
- Audit trail in credit_events

#### 2.4.2 Transfer Credits Function (2 hours)
- [ ] Create `supabase/functions/transfer-credits/index.ts`
- [ ] Implement manual credit operations (admin only)
- [ ] Add validation and error handling
- [ ] Log all manual transfers

**Completion Criteria:**
- Admin can manually adjust credits
- All transfers logged
- Balances updated correctly

---

## 🎨 Phase 3: Exchange Frontend (Weeks 3-4)

**Goal:** Build exchange UI and integrate with backend
**Estimated Effort:** 32 hours
**Dependencies:** Phase 2 complete (exchange services deployed)
**Risk Level:** 🟢 Low

### 3.1 Exchange Screens (20 hours)

#### 3.1.1 Browse Listings Screen (6 hours)
- [ ] Replace `app/(tabs)/exchange.tsx` placeholder
- [ ] Implement city-filtered listings grid
- [ ] Add search and filter UI
- [ ] Add pull-to-refresh
- [ ] Add infinite scroll pagination
- [ ] Test with 50+ listings

**Completion Criteria:**
- Listings load and display correctly
- Filters work (genre, condition, distance)
- Pagination works smoothly

#### 3.1.2 Create Listing Screen (4 hours)
- [ ] Create `app/(tabs)/exchange/create.tsx`
- [ ] Add book selection from library
- [ ] Add listing form (price, condition, notes)
- [ ] Add image upload (required: 2-4 photos)
- [ ] Implement optimistic update

**Completion Criteria:**
- User can create listing from library
- Form validation works
- Optimistic update shows listing immediately

#### 3.1.3 Listing Detail Screen (4 hours)
- [ ] Create `app/(tabs)/exchange/[listingId].tsx`
- [ ] Show book details and listing info
- [ ] Add "Request Book" button
- [ ] Show distance from user
- [ ] Add owner profile preview

**Completion Criteria:**
- Listing details display correctly
- Request button works
- Distance calculated correctly

#### 3.1.4 Transaction Flow Screens (6 hours)
- [ ] Create `app/(tabs)/exchange/transaction/[transactionId].tsx`
- [ ] Implement state-based UI (REQUESTED, APPROVED, PAYMENT_PENDING, etc.)
- [ ] Add payment button (Razorpay integration)
- [ ] Add delivery tracking
- [ ] Add "Complete Transaction" button

**Completion Criteria:**
- UI adapts to transaction state
- Payment flow works end-to-end
- Delivery tracking visible

---

### 3.2 Exchange Components (8 hours)

#### 3.2.1 Listing Card Component (2 hours)
- [ ] Create `src/components/exchange/ListingCard.tsx`
- [ ] Show book cover, title, condition, distance
- [ ] Add swipe actions (request, save)
- [ ] Add loading and error states

#### 3.2.2 Transaction Status Component (2 hours)
- [ ] Create `src/components/exchange/TransactionStatus.tsx`
- [ ] Show progress bar for transaction state
- [ ] Add status-specific actions
- [ ] Add estimated delivery time

#### 3.2.3 Payment Modal Component (2 hours)
- [ ] Create `src/components/exchange/PaymentModal.tsx`
- [ ] Integrate Razorpay Checkout
- [ ] Handle payment success/failure
- [ ] Show payment confirmation

#### 3.2.4 Address Picker Component (2 hours)
- [ ] Create `src/components/exchange/AddressPicker.tsx`
- [ ] Show saved addresses
- [ ] Add "Add New Address" button
- [ ] Integrate with Google Maps for geocoding

---

### 3.3 Razorpay Integration (4 hours)

#### 3.3.1 Install Razorpay SDK (1 hour)
- [ ] Install: `npm install react-native-razorpay`
- [ ] Configure for iOS and Android
- [ ] Test basic integration

#### 3.3.2 Implement Payment Flow (3 hours)
- [ ] Create payment service in `src/features/payments/services/paymentService.ts`
- [ ] Implement order creation → checkout → verification flow
- [ ] Add error handling
- [ ] Test with Razorpay test cards

**Completion Criteria:**
- Payment flow works end-to-end
- Success/failure handled correctly
- Test mode works

---

## 👥 Phase 4: Clubs Backend (Weeks 4-5)

**Goal:** Implement clubs services and real-time chat
**Estimated Effort:** 32 hours
**Dependencies:** Phase 1 complete (database deployed)
**Risk Level:** 🟡 Medium (Realtime complexity)

### 4.1 Clubs Services (16 hours)

#### 4.1.1 Create Clubs Service (6 hours)
- [ ] Create `src/features/clubs/services/clubsService.ts`
- [ ] Implement CRUD operations: createClub, getClubs, updateClub, deleteClub
- [ ] Add membership management: joinClub, leaveClub, removeMember
- [ ] Add tier-based limits enforcement
- [ ] Add TanStack Query hooks

**Completion Criteria:**
- User can create club (within tier limits)
- User can join/leave clubs
- Membership limits enforced

#### 4.1.2 Create Messages Service (6 hours)
- [ ] Create `src/features/clubs/services/messagesService.ts`
- [ ] Implement message CRUD: sendMessage, editMessage, deleteMessage
- [ ] Add spoiler tag support
- [ ] Add chapter reference support
- [ ] Add real-time subscription setup

**Completion Criteria:**
- Messages sent and received
- Spoiler tags render correctly
- Real-time updates work

#### 4.1.3 Create Voting Service (4 hours)
- [ ] Create `src/features/clubs/services/votingService.ts`
- [ ] Implement voting operations: createPoll, vote, closePoll
- [ ] Add vote tallying
- [ ] Add TanStack Query hooks

**Completion Criteria:**
- Polls created and voted on
- Votes tallied correctly
- Winner determined automatically

---

### 4.2 Edge Functions - Clubs (8 hours)

#### 4.2.1 Check Membership Limits Function (2 hours)
- [ ] Create `supabase/functions/check-membership-limits/index.ts`
- [ ] Query user tier from user_profiles
- [ ] Check current club count
- [ ] Return allowed/denied

**Completion Criteria:**
- Limits enforced correctly
- Error messages clear

#### 4.2.2 Moderate Content Function (3 hours)
- [ ] Create `supabase/functions/moderate-content/index.ts`
- [ ] Implement basic profanity filter
- [ ] Add spam detection
- [ ] Log moderation actions
- [ ] Test with sample messages

**Completion Criteria:**
- Profanity filtered
- Spam detected
- Actions logged

#### 4.2.3 Wishlist Notify Function (3 hours)
- [ ] Create `supabase/functions/wishlist-notify/index.ts`
- [ ] Match new listings to wishlists
- [ ] Send push notifications
- [ ] Log notifications sent

**Completion Criteria:**
- Matches detected correctly
- Notifications sent
- No duplicate notifications

---

### 4.3 Real-time Setup (8 hours)

#### 4.3.1 Configure Supabase Realtime (2 hours)
- [ ] Enable Realtime on club_messages table
- [ ] Configure RLS policies for Realtime
- [ ] Test subscription with multiple clients

#### 4.3.2 Implement Real-time Hooks (4 hours)
- [ ] Create `src/features/clubs/hooks/useRealtimeMessages.ts`
- [ ] Subscribe to club messages
- [ ] Handle insert/update/delete events
- [ ] Integrate with TanStack Query cache

**Completion Criteria:**
- Messages appear in real-time
- Multiple devices stay in sync
- No duplicate messages

#### 4.3.3 Optimize Real-time Performance (2 hours)
- [ ] Add message batching
- [ ] Add connection status indicator
- [ ] Handle reconnection gracefully
- [ ] Test with poor network conditions

**Completion Criteria:**
- Chat works smoothly with 10+ users
- Reconnection works automatically
- No message loss

---

## 🎨 Phase 5: Clubs Frontend (Weeks 5-6)

**Goal:** Build clubs UI with real-time chat
**Estimated Effort:** 32 hours
**Dependencies:** Phase 4 complete (clubs services deployed)
**Risk Level:** 🟢 Low

### 5.1 Clubs Screens (20 hours)

#### 5.1.1 Browse Clubs Screen (4 hours)
- [ ] Replace `app/(tabs)/clubs.tsx` placeholder
- [ ] Implement clubs grid with filters
- [ ] Add search functionality
- [ ] Show member count and current book
- [ ] Add "Create Club" button

**Completion Criteria:**
- Clubs load and display correctly
- Filters work (genre, size, city)
- Create button navigates correctly

#### 5.1.2 Club Detail Screen (6 hours)
- [ ] Create `app/(tabs)/clubs/[clubId].tsx`
- [ ] Show club info and member list
- [ ] Add "Join Club" button
- [ ] Show current book and voting status
- [ ] Add navigation to chat

**Completion Criteria:**
- Club details display correctly
- Join button works
- Navigation to chat works

#### 5.1.3 Club Chat Screen (8 hours)
- [ ] Create `app/(tabs)/clubs/[clubId]/chat.tsx`
- [ ] Implement message list with real-time updates
- [ ] Add message input with spoiler toggle
- [ ] Add chapter reference picker
- [ ] Add message reactions
- [ ] Implement auto-scroll to bottom

**Completion Criteria:**
- Messages display in real-time
- Spoiler tags work correctly
- Chapter references clickable
- Reactions work

#### 5.1.4 Create Club Screen (2 hours)
- [ ] Create `app/(tabs)/clubs/create.tsx`
- [ ] Add club creation form
- [ ] Add book selection
- [ ] Check membership limits
- [ ] Implement optimistic update

**Completion Criteria:**
- User can create club
- Limits enforced
- Form validation works

---

### 5.2 Clubs Components (8 hours)

#### 5.2.1 Club Card Component (2 hours)
- [ ] Create `src/components/clubs/ClubCard.tsx`
- [ ] Show club name, book, member count
- [ ] Add join button
- [ ] Add loading states

#### 5.2.2 Message Bubble Component (3 hours)
- [ ] Create `src/components/clubs/MessageBubble.tsx`
- [ ] Implement spoiler tag rendering
- [ ] Add chapter reference rendering
- [ ] Add reactions display
- [ ] Add timestamp and read status

#### 5.2.3 Voting Component (3 hours)
- [ ] Create `src/components/clubs/VotingCard.tsx`
- [ ] Show poll options
- [ ] Add vote button
- [ ] Show results after voting
- [ ] Add countdown timer

---

### 5.3 Chat Optimization (4 hours)

#### 5.3.1 Implement Message Pagination (2 hours)
- [ ] Add infinite scroll for old messages
- [ ] Load 50 messages at a time
- [ ] Maintain scroll position on load

#### 5.3.2 Add Typing Indicators (2 hours)
- [ ] Implement typing presence
- [ ] Show "User is typing..." indicator
- [ ] Debounce typing events

**Completion Criteria:**
- Old messages load on scroll
- Typing indicators work
- Performance smooth with 1000+ messages

---

## 🔌 Phase 6: Integrations (Weeks 6-7)

**Goal:** Complete remaining integrations
**Estimated Effort:** 24 hours
**Dependencies:** Phases 2-5 complete
**Risk Level:** 🟢 Low

### 6.1 Push Notifications (8 hours)

#### 6.1.1 Configure Firebase Cloud Messaging (3 hours)
- [ ] Create Firebase project
- [ ] Add FCM configuration to app.json
- [ ] Install expo-notifications
- [ ] Test notification delivery

#### 6.1.2 Implement Notification Service (3 hours)
- [ ] Create `src/services/notificationService.ts`
- [ ] Register device token with Supabase
- [ ] Handle notification permissions
- [ ] Handle notification taps

#### 6.1.3 Create Send Notification Edge Function (2 hours)
- [ ] Create `supabase/functions/send-notification/index.ts`
- [ ] Integrate FCM Admin SDK
- [ ] Send notifications for key events
- [ ] Test notification delivery

**Completion Criteria:**
- Notifications received on device
- Tapping notification navigates correctly
- Notifications sent for: new message, transaction update, wishlist match

---

### 6.2 Venues Feature (8 hours)

#### 6.2.1 Create Venues Service (3 hours)
- [ ] Create `src/features/venues/services/venuesService.ts`
- [ ] Implement getVenues with geospatial filtering
- [ ] Add TanStack Query hooks

#### 6.2.2 Create Venues Screen (4 hours)
- [ ] Create `app/(tabs)/venues.tsx`
- [ ] Show venues list with map view
- [ ] Add distance calculation
- [ ] Add venue detail modal

#### 6.2.3 Integrate Google Maps (1 hour)
- [ ] Install react-native-maps
- [ ] Add map view to venues screen
- [ ] Show venue markers
- [ ] Test on iOS and Android

**Completion Criteria:**
- Venues load and display
- Map shows venue locations
- Distance calculated correctly

---

### 6.3 Profile Completion (8 hours)

#### 6.3.1 Profile Screen (4 hours)
- [ ] Update `app/(tabs)/profile.tsx`
- [ ] Show user info and tier
- [ ] Show credit balance
- [ ] Add navigation to settings

#### 6.3.2 Credit History Screen (2 hours)
- [ ] Create `app/(tabs)/profile/credit-history.tsx`
- [ ] Show credit_events list
- [ ] Add filtering by type
- [ ] Show running balance

#### 6.3.3 Settings Screen (2 hours)
- [ ] Create `app/(tabs)/profile/settings.tsx`
- [ ] Add notification preferences
- [ ] Add theme toggle
- [ ] Add logout button

**Completion Criteria:**
- Profile shows correct data
- Credit history displays correctly
- Settings persist

---

## 🧪 Phase 7: Testing & Polish (Weeks 8-9)

**Goal:** End-to-end testing, bug fixes, performance optimization
**Estimated Effort:** 64 hours
**Dependencies:** All features complete
**Risk Level:** 🟡 Medium (unknown bug count)

### 7.1 End-to-End Testing (24 hours)

#### 7.1.1 Test Exchange Flow (8 hours)
- [ ] Test: Browse → Request → Approve → Pay → Ship → Deliver → Complete
- [ ] Test: Credit transfer on completion
- [ ] Test: Refund on cancellation
- [ ] Test: Edge cases (network errors, payment failures)
- [ ] Document bugs found

#### 7.1.2 Test Clubs Flow (8 hours)
- [ ] Test: Create club → Join → Chat → Vote → Finish book
- [ ] Test: Real-time chat with multiple devices
- [ ] Test: Spoiler tags and chapter references
- [ ] Test: Membership limits
- [ ] Document bugs found

#### 7.1.3 Test Integration Points (8 hours)
- [ ] Test: Razorpay payment flow
- [ ] Test: Porter/Dunzo delivery booking
- [ ] Test: Push notifications
- [ ] Test: Google Books API
- [ ] Test: Google Maps geocoding
- [ ] Document bugs found

**Completion Criteria:**
- All user flows work end-to-end
- Critical bugs documented
- Test cases documented

---

### 7.2 Bug Fixes (24 hours)

#### 7.2.1 Fix Critical Bugs (16 hours)
- [ ] Prioritize bugs by severity
- [ ] Fix all Severity 1 bugs (app crashes, data loss)
- [ ] Fix all Severity 2 bugs (feature broken)
- [ ] Test fixes

#### 7.2.2 Fix High-Priority Bugs (8 hours)
- [ ] Fix Severity 3 bugs (UX issues)
- [ ] Fix performance issues
- [ ] Test fixes

**Completion Criteria:**
- Zero Severity 1-2 bugs
- <5 Severity 3 bugs remaining

---

### 7.3 Performance Optimization (8 hours)

#### 7.3.1 Optimize App Load Time (3 hours)
- [ ] Measure current load time
- [ ] Optimize bundle size
- [ ] Add splash screen
- [ ] Lazy load screens
- [ ] Target: <3 seconds

#### 7.3.2 Optimize API Response Time (3 hours)
- [ ] Add database indexes
- [ ] Optimize RLS policies
- [ ] Add caching for Google Books API
- [ ] Target: <1 second

#### 7.3.3 Optimize Real-time Chat (2 hours)
- [ ] Add message batching
- [ ] Optimize subscription queries
- [ ] Test with 100+ messages
- [ ] Target: <100ms message latency

**Completion Criteria:**
- App load time <3 seconds
- API response time <1 second
- Chat latency <100ms

---

### 7.4 UI/UX Polish (8 hours)

#### 7.4.1 Design Consistency Audit (3 hours)
- [ ] Verify consistent spacing
- [ ] Verify consistent colors
- [ ] Verify consistent typography
- [ ] Fix inconsistencies

#### 7.4.2 Accessibility Audit (3 hours)
- [ ] Test with VoiceOver and TalkBack
- [ ] Verify color contrast
- [ ] Add accessibility labels
- [ ] Fix issues

#### 7.4.3 Copywriting Audit (2 hours)
- [ ] Review all user-facing text
- [ ] Fix typos and grammar
- [ ] Improve clarity
- [ ] Add helpful hints

**Completion Criteria:**
- Design consistent across all screens
- Accessibility score >90%
- All text clear and helpful

---

## 📚 Related Documents

- [← Back to Overview](./STRATEGIC_PLAN_OVERVIEW.md)
- [→ Investor Preparation Guide](./STRATEGIC_PLAN_INVESTOR_PREP.md)
- [Database Schema Reference](./DATABASE.md)
- [Edge Functions Specifications](./EDGE_FUNCTIONS_IMPLEMENTATION_LIST.md)
- [Architecture Guide](./ARCHITECTURE.md)

---

**Document Status:** ✅ Complete
**Maintained By:** Development Team
**Review Frequency:** Weekly


