# Documentation Migration Map

> **Historical note (2026-03-06):** This file documents the 2024 documentation refactor only.
> For current database truth, use `docs/audits/LIVE_SCHEMA_RECONCILIATION_2026-03-06.md`
> and `supabase/migrations/LIVE_MIGRATION_HISTORY_2026-03-06.md`.

**Date:** 2024-02-14  
**Purpose:** Track content relocation from old documentation structure to new modular structure.

---

## 📦 Archived Files

All original files preserved in `docs/archive/` with timestamp `2024-02-14`:
- `architecture_react_expo_2024-02-14.md` (1629 lines)
- `booktalks_mobile_spec_2024-02-14.md` (985 lines)
- `DOCUMENTATION_UPDATE_SUMMARY_2024-02-14.md` (327 lines)
- `EDGE_FUNCTIONS_IMPLEMENTATION_LIST_2024-02-14.md`

**Retention:** Archived files will be kept for minimum 30 days for rollback safety.

---

## 🗺️ Content Migration Map

### From `architecture_react_expo.md` → New Files

| Old Location | Content | New Location |
|--------------|---------|--------------|
| Lines 1-11 | Architectural Philosophy | `ARCHITECTURE.md` Section 1 |
| Lines 12-116 | Technology Stack | `README.md` + `ARCHITECTURE.md` |
| Lines 117-306 | Project Structure | `README.md` Section 3 |
| Lines 310-505 | Database Schema (Tables) | `DATABASE.md` Section 1 |
| Lines 506-905 | Database Migrations | `MIGRATION_GUIDE.md` |
| Lines 1004-1022 | RLS Policies | `DATABASE.md` Section 2 |
| Lines 1068-1117 | Design System | `ARCHITECTURE.md` Section 4 |
| Lines 1138-1370 | Edge Functions | `EDGE_FUNCTIONS.md` |
| Lines 1376-1389 | Environment Variables | `DEPLOYMENT.md` Section 1 |
| Lines 1458-1479 | CI/CD Configuration | `DEPLOYMENT.md` Section 3 |
| Lines 68-98 | Third-Party APIs | `THIRD_PARTY_INTEGRATIONS.md` |

### From `booktalks_mobile_spec.md` → New Files

| Old Location | Content | New Location |
|--------------|---------|--------------|
| Lines 1-13 | Project Vision | `README.md` Section 1 |
| Lines 14-50 | Membership Tiers | `README.md` Section 2 |
| Lines 210-242 | Transaction State Machine | `ARCHITECTURE.md` Section 3 |
| Lines 262-284 | Browse & Discovery | `API_REFERENCE.md` Examples |
| Lines 481-497 | Club Chat Features | `API_REFERENCE.md` Real-time |
| Lines 684-713 | Design System | `ARCHITECTURE.md` Section 4 |
| Lines 725-868 | Push Notifications | `THIRD_PARTY_INTEGRATIONS.md` FCM |

### From `EDGE_FUNCTIONS_IMPLEMENTATION_LIST.md` → New Files

| Old Location | Content | New Location |
|--------------|---------|--------------|
| Entire file | All 10 Edge Functions | `EDGE_FUNCTIONS.md` (enhanced) |

### From `DOCUMENTATION_UPDATE_SUMMARY.md` → New Files

| Old Location | Content | New Location |
|--------------|---------|--------------|
| Entire file | Change history | `CHANGELOG.md` + Archive |

---

## 🔍 Quick Search Guide

**Looking for specific content? Use these keywords:**

### Database
- **Tables**: Search `DATABASE.md` for table name (e.g., "user_profiles", "listings")
- **RLS Policies**: Search `DATABASE.md` Section 2
- **Indexes**: Search `DATABASE.md` Section 3
- **Migrations**: See `MIGRATION_GUIDE.md`

### Backend Logic
- **Edge Functions**: See `EDGE_FUNCTIONS.md`
- **Payment Flow**: See `EDGE_FUNCTIONS.md` → "create-payment-order"
- **Credit System**: See `EDGE_FUNCTIONS.md` → "complete-transaction"

### Frontend Development
- **Supabase Client**: See `API_REFERENCE.md` Section 1
- **Authentication**: See `API_REFERENCE.md` Section 2
- **Querying Data**: See `API_REFERENCE.md` Section 3
- **Real-time Chat**: See `API_REFERENCE.md` Section 4

### Integrations
- **Razorpay**: See `THIRD_PARTY_INTEGRATIONS.md` Section 1
- **Porter/Dunzo**: See `THIRD_PARTY_INTEGRATIONS.md` Section 2
- **FCM Notifications**: See `THIRD_PARTY_INTEGRATIONS.md` Section 3
- **Google APIs**: See `THIRD_PARTY_INTEGRATIONS.md` Section 4

### Deployment
- **Environment Variables**: See `DEPLOYMENT.md` Section 1
- **Supabase Setup**: See `DEPLOYMENT.md` Section 2
- **CI/CD**: See `DEPLOYMENT.md` Section 3

---

## 🔗 Cross-File Navigation

Each new documentation file includes:
- **"Related Documentation"** section at the bottom
- **Inline links** to related files (e.g., "See DATABASE.md for schema details")
- **Breadcrumb navigation** for complex topics

---

## 🔄 Rollback Instructions

If you need to revert to the old documentation structure:

1. Delete new files:
   ```bash
   rm docs/README.md docs/ARCHITECTURE.md docs/DATABASE.md docs/EDGE_FUNCTIONS.md
   rm docs/API_REFERENCE.md docs/THIRD_PARTY_INTEGRATIONS.md docs/DEPLOYMENT.md
   rm docs/MIGRATION_GUIDE.md docs/CHANGELOG.md
   ```

2. Restore archived files:
   ```bash
   copy docs\archive\architecture_react_expo_2024-02-14.md docs\architecture_react_expo.md
   copy docs\archive\booktalks_mobile_spec_2024-02-14.md docs\booktalks_mobile_spec.md
   copy docs\archive\DOCUMENTATION_UPDATE_SUMMARY_2024-02-14.md docs\DOCUMENTATION_UPDATE_SUMMARY.md
   copy docs\archive\EDGE_FUNCTIONS_IMPLEMENTATION_LIST_2024-02-14.md docs\EDGE_FUNCTIONS_IMPLEMENTATION_LIST.md
   ```

3. Delete this migration map:
   ```bash
   rm docs/MIGRATION_MAP.md
   ```

---

## 📊 Migration Status

- [x] Phase 1: Setup & Safety (Archive created)
- [x] Phase 2: Create New Documentation Files (9 files created)
- [x] Phase 3: Content Extraction & Deduplication (Complete)
  - [x] Updated DOCUMENTATION_UPDATE_SUMMARY.md with new file references
  - [x] Added project structure diagram to README.md
  - [x] Verified no content duplication
- [x] Phase 4: Quality Assurance (Complete)
  - [x] Validated all cross-references (49 links checked)
  - [x] Verified all section anchors
  - [x] Confirmed all files exist
  - [x] No broken links found

**Status:** ✅ **DOCUMENTATION REFACTORING COMPLETE**

**Last Updated:** 2024-02-14

