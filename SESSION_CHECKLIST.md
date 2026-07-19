# BookTalks Mobile - Session Checklist

> **Current marketplace work:** This legacy checklist does not own phase status. Use repository [`AGENTS.md`](./AGENTS.md) and the [active marketplace phase router](./docs/multi-tenant-bookstore-marketplace/implementation/ACTIVE.md).

Use this checklist at the start of each development session.

---

## ✅ Pre-Session Setup (5 minutes)

- [ ] Open `CODEBASE_INTELLIGENCE/README.md`
- [ ] Read the relevant `CODEBASE_INTELLIGENCE/` map for the feature or area being touched
- [ ] Open `DEVELOPMENT_SESSION_KICKSTART.md`
- [ ] Copy the prompt from "PROMPT TO COPY-PASTE" section
- [ ] Paste it into your AI assistant
- [ ] Wait for the status report
- [ ] Review the recommendations

---

## ✅ Environment Verification (10 minutes)

- [ ] Check `.env` file exists
- [ ] Verify all required environment variables are set:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Confirm no service-role key or other server secret uses an `EXPO_PUBLIC_*` variable or enters the mobile bundle.
- [ ] Run `npm install` to ensure dependencies are installed
- [ ] Run `npm start` to verify app starts
- [ ] Check Supabase connection works

---

## ✅ Documentation Review (10 minutes)

- [ ] Read the AI's status report carefully
- [ ] Understand current phase and progress
- [ ] Note any blockers or missing components
- [ ] Review recommended next steps
- [ ] Ask clarifying questions if needed

---

## ✅ Task Selection (5 minutes)

From the AI's recommendations:
- [ ] Select 1-3 tasks to work on this session
- [ ] Estimate time for each task
- [ ] Identify any prerequisites
- [ ] Plan the order of implementation

---

## ✅ During Development

For each task:
- [ ] Create a new branch (if using git)
- [ ] Break task into smaller steps
- [ ] Write code incrementally
- [ ] Test after each step
- [ ] Commit frequently
- [ ] Ask AI for help if stuck

---

## ✅ End of Session (10 minutes)

- [ ] Verify all code changes work
- [ ] Run tests if applicable
- [ ] Update documentation with progress
- [ ] Mark completed tasks in strategic plan
- [ ] Note any blockers for next session
- [ ] Commit and push changes

---

## 📋 Quick Reference: Key Files

**Documentation:**
- `CODEBASE_INTELLIGENCE/README.md` - Durable codebase map and future-agent starting point
- `docs/README.md` - Project overview
- `docs/strategic-planning/STRATEGIC_PLAN_TECHNICAL.md` - Tasks & timeline
- `docs/architecture/architecture_react_expo.md` - Architecture & status

**Configuration:**
- `package.json` - Dependencies
- `.env.example` - Environment variables template
- `app.json` - Expo configuration
- `tsconfig.json` - TypeScript config

**Source Code:**
- `src/` - Application source
- `app/` - Expo Router screens
- `supabase/` - Backend code

---

## 🎯 Current Phase Status

**Today's Date:** [Fill in]  
**Current Week:** [1-10]  
**Current Phase:** [Phase 0-8]  
**Expected Completion:** [Date]

---

## 📊 Progress Tracking

**This Session:**
- [ ] Task 1: __________ (Status: [ ] Not Started [ ] In Progress [ ] Complete)
- [ ] Task 2: __________ (Status: [ ] Not Started [ ] In Progress [ ] Complete)
- [ ] Task 3: __________ (Status: [ ] Not Started [ ] In Progress [ ] Complete)

**This Week:**
- [ ] Phase: __________ (Status: [ ] Not Started [ ] In Progress [ ] Complete)
- [ ] Estimated Hours: ____ / Actual Hours: ____

**Overall Progress:**
- [ ] Phases Complete: ____ / 9
- [ ] Files Implemented: ____ / 120+
- [ ] Percentage Complete: ____%

---

## 🚨 Blockers & Notes

**Current Blockers:**
1. ___________________________
2. ___________________________
3. ___________________________

**Notes for Next Session:**
- ___________________________
- ___________________________
- ___________________________

---

## 📞 When to Ask for Help

- [ ] Stuck on a task for >30 minutes
- [ ] Unsure about implementation approach
- [ ] Need to debug an error
- [ ] Want code review
- [ ] Need to optimize performance
- [ ] Documentation unclear

---

**Print this checklist and fill it out at the start of each session!**

