# BookTalks Mobile - Documentation

**Version:** 1.0 MVP  
**Target Timeline:** 8 weeks  
**Last Updated:** 2024-02-14

---

## 📖 Project Overview

BookTalks is a revolutionary peer-to-peer (P2P) book sharing ecosystem designed specifically for the Indian market. Unlike traditional library apps, **BookTalks treats books as a shared community resource that "circulates" rather than returns**. The fundamental philosophy is that a book read is a book that should move forward to the next reader, creating an ever-flowing stream of literature through the community.

### Core Differentiators

1. **Circulation Over Return**: Books move forward in the community, not back to original owners
2. **Credit Economy**: Democratic 1-credit-per-book system regardless of book value
3. **Intra-City Focus**: Hyperlocal book exchanges within the same city for faster, sustainable delivery
4. **Venue Integration**: Physical spaces (cafes, libraries) as community anchors
5. **Event-Sourced Integrity**: Immutable audit trails prevent fraud

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Supabase account
- Razorpay test account
- Porter/Dunzo API keys

### Installation

```bash
# Clone repository
git clone <repository-url>
cd booktalks-mobile

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm start
```

### Project Structure

```
booktalks-mobile/
├── src/                          # Application source code
│   ├── app/                      # Expo Router pages
│   ├── components/               # Reusable UI components
│   ├── lib/                      # Utilities and configurations
│   ├── hooks/                    # Custom React hooks
│   ├── stores/                   # Zustand state stores
│   └── types/                    # TypeScript type definitions
│
├── supabase/                     # Supabase backend
│   ├── functions/                # Edge Functions (Deno)
│   │   ├── create-payment-order/
│   │   ├── verify-payment/
│   │   ├── book-shipment/
│   │   ├── complete-transaction/
│   │   └── ...
│   ├── migrations/               # Database migrations
│   │   ├── 001_users_credits_schema.sql
│   │   ├── 002_exchange_schema.sql
│   │   ├── 003_venues_clubs_schema.sql
│   │   ├── 004_rename_lead_to_admin.sql
│   │   └── 005_chat_moderation_schema.sql
│   └── seed.sql                  # Dev/test data
│
├── docs/                         # Documentation (REORGANIZED STRUCTURE)
│   ├── README.md                 # This file - Project overview & navigation
│   ├── CHANGELOG.md              # Version history
│   │
│   ├── strategic-planning/       # Strategic planning documents
│   │   ├── STRATEGIC_PLAN_OVERVIEW.md
│   │   ├── STRATEGIC_PLAN_TECHNICAL.md
│   │   └── STRATEGIC_PLAN_INVESTOR_PREP.md
│   │
│   ├── linear-setup/             # Linear workspace setup files
│   │   ├── LINEAR_SETUP_GUIDE.md
│   │   ├── LINEAR_DEPENDENCY_MAP.md
│   │   ├── LINEAR_WORKSPACE_SUMMARY.md
│   │   └── LINEAR_IMPORT_TASKS.csv
│   │
│   ├── architecture/             # Architecture & design documentation
│   │   ├── ARCHITECTURE.md
│   │   ├── architecture_react_expo.md
│   │   ├── DATABASE.md
│   │   ├── EDGE_FUNCTIONS.md
│   │   ├── EDGE_FUNCTIONS_IMPLEMENTATION_LIST.md
│   │   ├── THIRD_PARTY_INTEGRATIONS.md
│   │   └── booktalks_mobile_spec.md
│   │
│   ├── api-reference/            # API documentation
│   │   └── API_REFERENCE.md
│   │
│   ├── deployment/               # Deployment & migration guides
│   │   ├── DEPLOYMENT.md
│   │   ├── MIGRATION_GUIDE.md
│   │   └── MIGRATION_MAP.md
│   │
│   ├── audits/                   # Audit reports & documentation fixes
│   │   ├── DOCUMENTATION_AUDIT_REPORT.md
│   │   ├── DOCUMENTATION_FIXES_REQUIRED.md
│   │   ├── DOCUMENTATION_CONSISTENCY_FIXES.md
│   │   ├── CONSISTENCY_VERIFICATION_REPORT.md
│   │   ├── BEFORE_AFTER_COMPARISON.md
│   │   ├── FIXES_SUMMARY.md
│   │   ├── SCHEMA_REFERENCE_GUIDE.md
│   │   ├── DEVELOPER_CHECKLIST.md
│   │   ├── DOCUMENTATION_UPDATE_SUMMARY.md
│   │   └── IMPLEMENTATION_STATUS_UPDATE.md
│   │
│   └── archive/                  # Archived documentation (historical snapshots)
│       ├── DOCUMENTATION_UPDATE_SUMMARY_2024-02-14.md
│       ├── EDGE_FUNCTIONS_IMPLEMENTATION_LIST_2024-02-14.md
│       ├── architecture_react_expo_2024-02-14.md
│       └── booktalks_mobile_spec_2024-02-14.md
│
├── .env.example                  # Environment variables template
├── app.json                      # Expo configuration
├── eas.json                      # EAS Build configuration
├── babel.config.js
├── tailwind.config.js            # NativeWind theme
├── tsconfig.json
└── package.json
```

### First-Time Setup

1. **Supabase Setup**: See [DEPLOYMENT.md](./deployment/DEPLOYMENT.md#supabase-setup)
2. **Run Migrations**: See [MIGRATION_GUIDE.md](./deployment/MIGRATION_GUIDE.md)
3. **Deploy Edge Functions**: See [EDGE_FUNCTIONS.md](./architecture/EDGE_FUNCTIONS.md#deployment)
4. **Configure Third-Party APIs**: See [THIRD_PARTY_INTEGRATIONS.md](./architecture/THIRD_PARTY_INTEGRATIONS.md)

---

## 🛠️ Technology Stack

### Frontend (Mobile Application)

**Core Framework:**
- React Native via Expo SDK 54 (~54.0.30)
- Expo Router (file-based routing v6+)
- TypeScript (strict mode)

**UI & Styling:**
- NativeWind (Tailwind CSS for React Native v4)
- expo-image (aggressive caching for book covers)
- react-native-reanimated (smooth animations)

**State Management:**
- Zustand (lightweight stores for auth, theme, UI)
- TanStack Query v5 (server state, caching)
- MMKV (high-speed persistence)

**Forms & Validation:**
- React Hook Form (performance-optimized forms)
- Zod (runtime type safety + validation schemas)

### Backend (Supabase)

**Database:**
- PostgreSQL v15+ with PostGIS extension
- Row-Level Security (RLS) enforced on all tables
- Real-time subscriptions for club chat

**Authentication:**
- Supabase Auth with phone OTP (Twilio integration)
- JWT session management with refresh tokens

**Edge Functions** (Deno runtime):
- Payment processing (Razorpay)
- Delivery booking (Porter/Dunzo)
- Credit system operations
- Notification triggers

### Third-Party Integrations

- **Razorpay**: Payment processing (deposits, refunds)
- **Porter & Dunzo**: Intra-city delivery services
- **Google Books API**: Book metadata
- **Google Maps API**: Geocoding and proximity
- **Firebase Cloud Messaging**: Push notifications

---

## 👥 Membership Tiers

> **Source of truth for entitlement enforcement:**
> `src/features/clubs/services/clubsEntitlement.ts`, `supabase/functions/check-membership-limits/index.ts`, and live DB triggers / RPCs (`can_user_hold_club_role`, `is_active_eligible_club_manager`).
> Cross-checked against `docs/features/CLUBS_ENTITLEMENT_IMPLEMENTATION_ANALYSIS_2026-03-10.md` and `docs/architecture/booktalks_mobile_spec.md`.

### Free Tier
- ✅ Unlimited Book Club memberships **for clubs with `access_level = all`**
- ✅ Full club participation after joining (vote, RSVP, forum discussion, nominate books)
- ❌ **Cannot be promoted to Moderator or Admin** — only Pro and Pro+ users may hold privileged roles
- ❌ Cannot create clubs (creation cap: 0)
- ✅ Unlimited library features

### Pro Tier ($2.99/month)
- ✅ Everything in Free
- ✅ Can join clubs with `access_level = all` or `pro`
- ✅ Create up to 5 book clubs
- ✅ **Can be promoted to Moderator or Admin role** (requires Pro or Pro+ subscription)
- ✅ Priority support
- ✅ Early access to new features

### Pro+ Tier ($4.99/month)
- ✅ Everything in Pro
- ✅ Can join clubs with `access_level = all`, `pro`, or `pro_plus`
- ✅ Create up to 15 book clubs
- ✅ **Can be promoted to Moderator or Admin role** (requires Pro or Pro+ subscription)
- ✅ Premium badge on profile
- ✅ Exclusive author events access
- ✅ Priority customer support

**Downgrade Policy:** 30-day grace period with warnings on Day 7, 14, 21, 29 is specified in `booktalks_mobile_spec.md`.
> ⚠️ **Not yet implemented:** The `handle-downgrade-grace-period` Edge Function and any automated cron / scheduled warning job do not exist in the repo. Automated archiving and grace-period enforcement are pending.

---

## ✍️ Verified Authors Program

Verified authors get a dedicated set of features to engage with their readers:

### Author Verification
- Manual verification process (admin approval)
- `user_profiles.account_type = 'author'` + `is_verified_author = true`
- Verified badge on profile

### Author Clubs
- Dedicated **Author Club** type (distinct from public/approval/invite-only clubs)
- Appear in a dedicated "Author Clubs" discovery section
- Author is automatically the club admin

### Author-Specific Features
- 📖 **Exclusive Listings** — Signed editions, early releases, manuscript previews (visible to club members first via timed exclusivity)
- 🎤 **AMA Events** — Ask Me Anything sessions with structured Q&A (upvoting, pinning, archiving)
- ✒️ **Virtual Book Signing** — Schedule signing events, mark limited signed copies
- 📊 **Author Analytics** — Reader engagement metrics, club growth trends, popular questions

---

## 📚 Documentation Structure & Navigation

### 🎯 Quick Links by Role

**For Developers:**
- **Getting Started**: [DEPLOYMENT.md](./deployment/DEPLOYMENT.md) → [MIGRATION_GUIDE.md](./deployment/MIGRATION_GUIDE.md)
- **Architecture**: [ARCHITECTURE.md](./architecture/ARCHITECTURE.md) → [architecture_react_expo.md](./architecture/architecture_react_expo.md)
- **Database**: [DATABASE.md](./architecture/DATABASE.md) → [SCHEMA_REFERENCE_GUIDE.md](./audits/SCHEMA_REFERENCE_GUIDE.md)
- **APIs**: [API_REFERENCE.md](./api-reference/API_REFERENCE.md) → [EDGE_FUNCTIONS.md](./architecture/EDGE_FUNCTIONS.md)
- **Integrations**: [THIRD_PARTY_INTEGRATIONS.md](./architecture/THIRD_PARTY_INTEGRATIONS.md)

**For Project Managers:**
- **Strategic Plan**: [STRATEGIC_PLAN_OVERVIEW.md](./strategic-planning/STRATEGIC_PLAN_OVERVIEW.md)
- **Technical Details**: [STRATEGIC_PLAN_TECHNICAL.md](./strategic-planning/STRATEGIC_PLAN_TECHNICAL.md)
- **Investor Prep**: [STRATEGIC_PLAN_INVESTOR_PREP.md](./strategic-planning/STRATEGIC_PLAN_INVESTOR_PREP.md)
- **Linear Setup**: [LINEAR_SETUP_GUIDE.md](./linear-setup/LINEAR_SETUP_GUIDE.md)

**For QA/Testing:**
- **Audit Reports**: [DOCUMENTATION_AUDIT_REPORT.md](./audits/DOCUMENTATION_AUDIT_REPORT.md)
- **Implementation Status**: [IMPLEMENTATION_STATUS_UPDATE.md](./audits/IMPLEMENTATION_STATUS_UPDATE.md)
- **Developer Checklist**: [DEVELOPER_CHECKLIST.md](./audits/DEVELOPER_CHECKLIST.md)

### 📂 Folder Organization

| Folder | Contents | Purpose |
|--------|----------|---------|
| **strategic-planning/** | 3 strategic plan documents | 10-week implementation roadmap, technical specs, investor prep |
| **linear-setup/** | Linear workspace setup files | CSV import, setup guide, dependency map, workspace summary |
| **architecture/** | 7 architecture documents | System design, database schema, Edge Functions, integrations, specs |
| **api-reference/** | API documentation | Frontend developer guide for Supabase usage |
| **deployment/** | 3 deployment guides | Environment setup, database migrations, content relocation |
| **audits/** | 10 audit & fix documents | Documentation audits, consistency fixes, implementation status |
| **archive/** | 4 historical documents | Previous versions (dated 2024-02-14) for reference |

### 📖 Document Reference

| Document | Location | Purpose |
|----------|----------|---------|
| **ARCHITECTURE.md** | `architecture/` | High-level system architecture, design decisions |
| **DATABASE.md** | `architecture/` | Complete schema, tables, RLS policies, indexes |
| **EDGE_FUNCTIONS.md** | `architecture/` | All 10 Edge Functions with specifications |
| **API_REFERENCE.md** | `api-reference/` | Frontend developer guide for Supabase usage |
| **THIRD_PARTY_INTEGRATIONS.md** | `architecture/` | Razorpay, Porter/Dunzo, FCM, Google APIs |
| **DEPLOYMENT.md** | `deployment/` | Environment setup, deployment guide, CI/CD |
| **MIGRATION_GUIDE.md** | `deployment/` | Database migrations and SQL scripts |
| **CHANGELOG.md** | Root `docs/` | Documentation update history |
| **MIGRATION_MAP.md** | `deployment/` | Content relocation guide (old → new structure) |
| **STRATEGIC_PLAN_OVERVIEW.md** | `strategic-planning/` | Executive summary, timeline, milestones |
| **STRATEGIC_PLAN_TECHNICAL.md** | `strategic-planning/` | Detailed implementation tasks, dependencies |
| **STRATEGIC_PLAN_INVESTOR_PREP.md** | `strategic-planning/` | Demo prep, metrics, investor materials |
| **LINEAR_SETUP_GUIDE.md** | `linear-setup/` | Step-by-step Linear workspace setup (60 min) |
| **LINEAR_DEPENDENCY_MAP.md** | `linear-setup/` | Task dependencies, critical path, velocity targets |
| **LINEAR_WORKSPACE_SUMMARY.md** | `linear-setup/` | Overview of 150+ tasks, timeline, team structure |
| **LINEAR_IMPORT_TASKS.csv** | `linear-setup/` | CSV file for bulk import into Linear |

---

## 🎯 MVP Scope (8 Weeks)

### Week 1-2: Foundation
- ✅ Authentication (phone OTP)
- ✅ User profiles
- ✅ Personal library management

### Week 3-4: P2P Exchange
- ✅ Create/browse listings (city-filtered)
- ✅ Transaction flow (request → approve → payment → delivery)
- ✅ Credit system (event-sourced)

### Week 5-6: Book Clubs
- ✅ Create/join clubs
- ✅ Real-time chat with spoiler tags
- ✅ Reading milestones and voting

### Week 7-8: Polish & Launch
- ✅ Push notifications
- ✅ Venue integration
- ✅ Testing and bug fixes

**Deferred to Phase 2:** Atmospheric themes, inter-city delivery, advanced gamification

---

## 🔗 Related Resources

- **Original Specifications**: See `archive/` folder for comprehensive archived docs (historical snapshots)
- **API Documentation**: Auto-generated from Supabase schema
- **Design System**: See [ARCHITECTURE.md](./architecture/ARCHITECTURE.md#design-system)
- **Troubleshooting**: See [DEPLOYMENT.md](./deployment/DEPLOYMENT.md#troubleshooting)
- **Project Timeline**: See [STRATEGIC_PLAN_OVERVIEW.md](./strategic-planning/STRATEGIC_PLAN_OVERVIEW.md)
- **Linear Setup**: See [LINEAR_SETUP_GUIDE.md](./linear-setup/LINEAR_SETUP_GUIDE.md)

---

## 📋 Documentation Reorganization (Feb 17, 2026)

The `docs/` folder has been reorganized into logical categories for better navigation:

- **strategic-planning/**: Strategic implementation plans and investor prep materials
- **linear-setup/**: Linear workspace setup files and task imports
- **architecture/**: System design, database schema, and API specifications
- **api-reference/**: Frontend developer API guides
- **deployment/**: Deployment guides and database migrations
- **audits/**: Documentation audit reports and consistency fixes
- **archive/**: Historical documentation snapshots

**Need help finding something?** Check [MIGRATION_MAP.md](./deployment/MIGRATION_MAP.md) to find where specific content moved from the old documentation structure.

