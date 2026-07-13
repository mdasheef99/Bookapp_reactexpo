# BookTalks Mobile - Development Session Kickstart Prompt

**Use this prompt to start a fresh development session with an AI assistant.**

---

## 📋 INSTRUCTIONS FOR AI ASSISTANT

You are helping develop **BookTalks Mobile**, a peer-to-peer book sharing app for the Indian market. Please follow these steps:

### START HERE: Use Context Tools First
First read `CODEBASE_INTELLIGENCE/README.md` and the relevant files in `CODEBASE_INTELLIGENCE/` for durable project orientation. If the `codebase-retrieval` MCP tool is available, use it to refresh the specific area you are working on before doing manual file-by-file exploration. Then read the documentation below in order and use those docs to guide the rest of your analysis.

### STEP 1: Read & Analyze Key Documentation (in order)
1. Read `docs/README.md` - Project overview and navigation guide
2. Read `docs/strategic-planning/STRATEGIC_PLAN_TECHNICAL.md` - Implementation tasks and timeline
3. Read `docs/architecture/architecture_react_expo.md` - Technical architecture and project structure
4. Read `package.json` - Current dependencies and scripts

### STEP 2: Provide Systematic Status Update
After reading the docs, provide a status update covering:

**A. Current Project Phase**
- Which week of the 10-week timeline are we in? (Timeline: Feb 17 - Apr 28, 2026)
- What phase should be active now?

**B. Implementation Status**
- What has been implemented (✅ status markers)?
- What's in progress (🟡 status markers)?
- What's not yet started (❌ status markers)?
- Percentage complete overall?

**C. Database Status**
- Which migrations have been created/deployed?
- Which tables exist in Supabase?
- Are RLS policies configured?

**D. Codebase Status**
- Which folders/files exist in `src/`?
- Which screens are implemented in `app/`?
- Which services are implemented?
- Which Edge Functions are deployed?

**E. Blockers & Missing Components**
- What critical items are blocking progress?
- What prerequisites must be completed first?
- Are there any environment setup issues?

### STEP 3: Recommend Next Steps
Provide actionable recommendations:

**A. Prioritized Linear Tasks**
- List the top 3-5 tasks to work on next
- Reference Phase numbers from strategic plan
- Estimate effort for each task

**B. Files to Create/Modify**
- Specific files that need to be created
- Specific files that need to be modified
- Order of implementation

**C. Prerequisites**
- Environment setup needed?
- Database migrations needed?
- Dependencies to install?
- Configuration files to create?

**D. Development Plan for This Session**
- Clear, actionable steps for the current session
- Estimated time for each step
- Success criteria for each step

### STEP 4: Verify Development Environment
Check and report on:
- Does `.env` file exist? What variables are needed?
- Is Supabase connection configured?
- Are all dependencies in `package.json` installed?
- Are there any missing or outdated packages?
- Can the app start with `npm start`?

---

## 🎯 OUTPUT FORMAT

Structure your response as follows:

```
# BookTalks Mobile - Development Status & Recommendations

## 📊 Current Status
[Your analysis of implementation status]

## 🚀 Next Steps (Prioritized)
[Your recommended tasks]

## ⚙️ Environment Readiness
[Your environment check results]

## 📝 Session Plan
[Your actionable development plan]
```

---

## 📚 Key Context

**Project:** BookTalks Mobile (React Native + Expo SDK 54 + Supabase)  
**Timeline:** 10 weeks (Feb 17 - Apr 28, 2026)  
**Team:** 2 developers (backend-focused, frontend-focused)  
**MVP Scope:** 8 weeks (Phases 0-7)  
**Total Effort:** 296 hours (~3.7 weeks of work spread over 10 weeks)

**Core Features:**
- P2P book exchange with credit economy
- Book clubs with real-time chat
- Payment processing (Razorpay)
- Intra-city delivery (Porter/Dunzo)
- Push notifications (FCM)
- Venue integration

**Tech Stack:**
- Frontend: React Native, Expo Router, TypeScript, NativeWind, TanStack Query, Zustand
- Backend: Supabase (PostgreSQL + Auth + Realtime + Storage)
- Edge Functions: Deno (10 total functions)
- Third-party: Razorpay, Porter, Dunzo, Google APIs, Firebase

---

**Ready to begin? Start by reading the documentation files listed in STEP 1.**

