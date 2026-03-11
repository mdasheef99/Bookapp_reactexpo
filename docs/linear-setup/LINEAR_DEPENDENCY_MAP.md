# Linear Dependency Map - BookTalks Mobile

**Version:** 1.0.0  
**Created:** 2026-02-17  
**Purpose:** Task dependencies and critical path for 10-week implementation

---

## Critical Path (Must Complete On Schedule)

These tasks block other work and must be completed on time:

```
Week 1:
  Phase 0.3 (Create Migration SQL Files)
    ↓
  Phase 1.2.1-1.2.5 (Database Migrations)
    ↓
Week 2-3:
  Phase 2.1.1-2.1.3 (Exchange Services)
  Phase 2.2.1-2.2.3 (Payment Functions)
  Phase 2.3.1-2.3.2 (Delivery Functions)
  Phase 2.4.1-2.4.2 (Credit Functions)
    ↓
Week 3-4:
  Phase 3.1.1-3.1.4 (Exchange UI)
  Phase 3.3.1-3.3.2 (Razorpay Integration)
    ↓
Week 4-5:
  Phase 4.1.1-4.1.3 (Clubs Services)
  Phase 4.3.1-4.3.3 (Real-time Setup)
    ↓
Week 5-6:
  Phase 5.1.1-5.1.4 (Clubs UI)
    ↓
Week 8-9:
  Phase 7.1.1-7.1.3 (End-to-End Testing)
    ↓
Week 10:
  Phase 8.1.1-8.8 (Investor Preparation)
```

---

## Dependency Groups

### Phase 0: Documentation (No Dependencies)
- Phase 0.1: Fix Broken Anchor Links
- Phase 0.2: Archive Old Files → depends on 0.1
- Phase 0.3: Create Migration SQL Files → depends on 0.2

### Phase 1: Foundation & Security (Depends on Phase 0)
- Phase 1.1.1: Move Credentials → depends on 0.3
- Phase 1.1.2: Session Persistence → depends on 1.1.1
- Phase 1.1.3: Error Boundary → depends on 1.1.2
- Phase 1.1.4: Input Validation → depends on 1.1.3
- Phase 1.2.1: Users & Credits Schema → depends on 0.3
- Phase 1.2.2: Exchange Schema → depends on 1.2.1
- Phase 1.2.3: Venues & Clubs Schema → depends on 1.2.2
- Phase 1.2.4: Chat & Moderation Schema → depends on 1.2.3
- Phase 1.2.5: Deploy All Migrations → depends on 1.2.4

### Phase 2: Exchange Backend (Depends on Phase 1)
- Phase 2.1.1: Listings Service → depends on 1.2.5
- Phase 2.1.2: Transactions Service → depends on 2.1.1
- Phase 2.1.3: Addresses Service → depends on 2.1.2
- Phase 2.2.1: Payment Order Function → depends on 2.1.3
- Phase 2.2.2: Verify Payment Function → depends on 2.2.1
- Phase 2.2.3: Refund Deposit Function → depends on 2.2.2
- Phase 2.3.1: Book Shipment Function → depends on 2.2.3
- Phase 2.3.2: Shipment Webhook Handler → depends on 2.3.1
- Phase 2.4.1: Complete Transaction Function → depends on 2.3.2
- Phase 2.4.2: Transfer Credits Function → depends on 2.4.1

### Phase 3: Exchange Frontend (Depends on Phase 2)
- Phase 3.1.1: Browse Listings Screen → depends on 2.1.1
- Phase 3.1.2: Create Listing Screen → depends on 3.1.1
- Phase 3.1.3: Listing Detail Screen → depends on 3.1.2
- Phase 3.1.4: Transaction Flow Screens → depends on 3.1.3
- Phase 3.2.1-3.2.4: Components → depends on 3.1.1
- Phase 3.3.1: Install Razorpay SDK → depends on 3.1.4
- Phase 3.3.2: Implement Payment Flow → depends on 3.3.1

### Phase 4: Clubs Backend (Depends on Phase 1)
- Phase 4.1.1: Clubs Service → depends on 1.2.5
- Phase 4.1.2: Messages Service → depends on 4.1.1
- Phase 4.1.3: Voting Service → depends on 4.1.2
- Phase 4.2.1: Check Membership Limits → depends on 4.1.1
- Phase 4.2.2: Moderate Content Function → depends on 4.2.1
- Phase 4.2.3: Wishlist Notify Function → depends on 4.2.2
- Phase 4.3.1: Configure Supabase Realtime → depends on 4.1.2
- Phase 4.3.2: Implement Real-time Hooks → depends on 4.3.1
- Phase 4.3.3: Optimize Real-time Performance → depends on 4.3.2

### Phase 5: Clubs Frontend (Depends on Phase 4)
- Phase 5.1.1: Browse Clubs Screen → depends on 4.1.1
- Phase 5.1.2: Club Detail Screen → depends on 5.1.1
- Phase 5.1.3: Club Chat Screen → depends on 5.1.2
- Phase 5.1.4: Create Club Screen → depends on 5.1.3
- Phase 5.2.1-5.2.3: Components → depends on 5.1.1
- Phase 5.3.1-5.3.2: Optimizations → depends on 5.1.3

### Phase 6: Integrations (Depends on Phases 1-5)
- Phase 6.1.1: Configure Firebase → depends on 1.2.5
- Phase 6.1.2: Notification Service → depends on 6.1.1
- Phase 6.1.3: Send Notification Function → depends on 6.1.2
- Phase 6.2.1: Venues Service → depends on 1.2.5
- Phase 6.2.2: Venues Screen → depends on 6.2.1
- Phase 6.2.3: Google Maps Integration → depends on 6.2.2
- Phase 6.3.1: Profile Screen → depends on 1.2.5
- Phase 6.3.2: Credit History Screen → depends on 6.3.1
- Phase 6.3.3: Settings Screen → depends on 6.3.2

### Phase 7: Testing & Polish (Depends on Phases 3-6)
- Phase 7.1.1: Test Exchange Flow → depends on 3.3.2
- Phase 7.1.2: Test Clubs Flow → depends on 5.3.2
- Phase 7.1.3: Test Integration Points → depends on 6.1.3
- Phase 7.2.1: Fix Critical Bugs → depends on 7.1.3
- Phase 7.2.2: Fix High-Priority Bugs → depends on 7.2.1
- Phase 7.3.1: Optimize App Load Time → depends on 7.2.2
- Phase 7.3.2: Optimize API Response Time → depends on 7.3.1
- Phase 7.3.3: Optimize Real-time Chat → depends on 7.3.2
- Phase 7.4.1-7.4.3: UI/UX Polish → depends on 7.2.2

### Phase 8: Investor Prep (Depends on Phase 7)
- Phase 8.1.1-8.1.4: Seed Demo Data → depends on 7.2.2
- Phase 8.2.1-8.2.2: Configure Demo Accounts → depends on 8.1.4
- Phase 8.3.1-8.3.2: Rehearse Demo → depends on 8.2.2
- Phase 8.4.1-8.4.3: Demo Script & Talking Points → depends on 8.3.2
- Phase 8.5.1-8.5.3: Metrics Dashboard → depends on 8.4.3
- Phase 8.6.1-8.6.3: Video Demo Recording → depends on 8.4.1
- Phase 8.7.1-8.7.3: Investor Deck & Materials → depends on 8.5.3
- Phase 8.8: Investor-Ready Checklist → depends on 8.7.3

---

## Parallel Work Streams

### Stream A: Backend (Weeks 1-7)
- Phase 0-1: Foundation (Week 1)
- Phase 2: Exchange Backend (Weeks 2-3)
- Phase 4: Clubs Backend (Weeks 4-5)
- Phase 6: Integrations (Weeks 6-7)
- Phase 7: Testing (Weeks 8-9)

### Stream B: Frontend (Weeks 1-7)
- Phase 1: Foundation (Week 1)
- Phase 3: Exchange Frontend (Weeks 3-4)
- Phase 5: Clubs Frontend (Weeks 5-6)
- Phase 6: Integrations (Weeks 6-7)
- Phase 7: Testing (Weeks 8-9)

### Stream C: Investor Prep (Week 10)
- Phase 8: All investor preparation tasks (Week 10)

---

## Risk Dependencies

### High-Risk Items (May Impact Timeline)
1. **Razorpay Integration** (Phase 2.2)
   - Risk: Payment API integration fails
   - Mitigation: Use test mode, have mock fallback
   - Blocks: Phase 3.3, Phase 7.1.1

2. **Porter/Dunzo Integration** (Phase 2.3)
   - Risk: Delivery API sandbox unavailable
   - Mitigation: Mock delivery responses if needed
   - Blocks: Phase 7.1.1

3. **Real-time Chat** (Phase 4.3)
   - Risk: Performance issues with multiple users
   - Mitigation: Test early with multiple devices
   - Blocks: Phase 5.1.3, Phase 7.1.2

4. **Testing Phase** (Phase 7)
   - Risk: Too many bugs found
   - Mitigation: Prioritize critical bugs, defer minor ones
   - Blocks: Phase 8

---

## Effort Estimates by Phase

| Phase | Effort | Duration | Team |
|-------|--------|----------|------|
| Phase 0 | 8h | 1 day | 1 person |
| Phase 1 | 24h | 3 days | 1 person |
| Phase 2 | 40h | 5 days | 1 person (backend) |
| Phase 3 | 32h | 4 days | 1 person (frontend) |
| Phase 4 | 32h | 4 days | 1 person (backend) |
| Phase 5 | 32h | 4 days | 1 person (frontend) |
| Phase 6 | 24h | 3 days | Both |
| Phase 7 | 64h | 8 days | Both |
| Phase 8 | 40h | 5 days | Both |
| **Total** | **296h** | **10 weeks** | **2 people** |

---

## Velocity Targets

**Assuming 2 full-time developers (40 hours/week each = 80 hours/week):**

- Week 1: 32h (Phase 0-1) ✓ On track
- Weeks 2-4: 72h (Phase 2-3) ✓ On track
- Weeks 5-6: 64h (Phase 4-5) ✓ On track
- Week 7: 24h (Phase 6) ✓ On track
- Weeks 8-9: 64h (Phase 7) ✓ On track
- Week 10: 40h (Phase 8) ✓ On track

**Total: 296 hours / 80 hours per week = 3.7 weeks of work**  
**Spread across 10 weeks with parallel streams = Achievable**

---

## Milestone Checklist

- [ ] Week 1: All Phase 0-1 tasks complete, database deployed
- [ ] Weeks 2-4: Exchange backend & frontend complete, payment working
- [ ] Weeks 5-6: Clubs backend & frontend complete, real-time chat working
- [ ] Week 7: All integrations complete, venues & profile working
- [ ] Weeks 8-9: All bugs fixed, performance optimized, UI polished
- [ ] Week 10: Demo environment ready, investor materials complete

---

**Last Updated:** 2026-02-17  
**Next Review:** Weekly during implementation

