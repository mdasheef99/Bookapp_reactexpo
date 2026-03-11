# BookTalks Mobile - Extended Kickstart Guide

## 🎯 Quick Reference: What to Ask the AI

When starting a new session, copy and paste this prompt to your AI assistant:

---

### PROMPT TO COPY-PASTE:

```
I'm continuing development on BookTalks Mobile, a React Native book sharing app.

Please analyze the project status by:

1. Reading these files in order:
   - docs/README.md
   - docs/strategic-planning/STRATEGIC_PLAN_TECHNICAL.md
   - docs/architecture/architecture_react_expo.md
   - package.json

2. Providing a status report with:
   - Current phase (week of 10-week timeline)
   - Implementation status (% complete, what's done/in-progress/pending)
   - Database status (migrations, tables, RLS)
   - Codebase status (folders, screens, services, Edge Functions)
   - Blockers and missing components

3. Recommending next steps:
   - Top 3-5 prioritized Linear tasks
   - Specific files to create/modify
   - Prerequisites to complete first
   - Clear development plan for this session

4. Verifying environment:
   - .env file status and required variables
   - Supabase connection
   - Dependencies status
   - Any missing configuration

Please structure your response with clear sections and actionable recommendations.
```

---

## 📊 Key Metrics to Track

**Implementation Progress:**
- Total files planned: 120+
- Currently implemented: ~35 files (29%)
- In progress: ~15 files (13%)
- Not started: ~70 files (58%)

**Timeline Status:**
- Project start: Feb 17, 2026
- Project end: Apr 28, 2026
- Total duration: 10 weeks
- MVP deadline: Week 8 (Apr 11, 2026)

**Effort Allocation:**
- Total effort: 296 hours
- Per week: ~30 hours
- Per developer: ~15 hours/week
- Phases 0-7: MVP (8 weeks)
- Phase 8: Investor prep (2 weeks)

---

## 🔍 What to Look For in Status Report

**Good Signs:**
✅ Database migrations created and deployed  
✅ Core services implemented (auth, books, exchange)  
✅ Main screens scaffolded  
✅ Environment properly configured  
✅ Dependencies installed and up-to-date  

**Red Flags:**
❌ Missing database migrations  
❌ No Edge Functions deployed  
❌ Incomplete environment setup  
❌ Outdated or missing dependencies  
❌ Broken links in documentation  

---

## 📋 Phase Breakdown Reference

**Phase 0 (Week 1, Days 1-2):** Documentation fixes (8 hours)  
**Phase 1 (Week 1, Days 3-5):** Foundation & security (24 hours)  
**Phase 2 (Weeks 2-3):** Exchange backend (40 hours)  
**Phase 3 (Weeks 3-4):** Exchange frontend (32 hours)  
**Phase 4 (Weeks 4-5):** Clubs backend (32 hours)  
**Phase 5 (Weeks 5-6):** Clubs frontend (32 hours)  
**Phase 6 (Weeks 6-7):** Integrations (24 hours)  
**Phase 7 (Weeks 8-9):** Testing & polish (64 hours)  
**Phase 8 (Week 10):** Investor prep (varies)  

---

## 🛠️ Common Development Tasks

**Database Setup:**
- Create migration files in `supabase/migrations/`
- Run migrations in Supabase SQL Editor
- Verify RLS policies
- Seed test data

**Backend Development:**
- Create services in `src/features/*/services/`
- Create hooks in `src/features/*/hooks/`
- Create Edge Functions in `supabase/functions/`
- Test with Supabase client

**Frontend Development:**
- Create screens in `app/(tabs)/*/`
- Create components in `src/components/`
- Create types in `src/features/*/types.ts`
- Test with Expo Go

**Integration:**
- Configure third-party APIs (Razorpay, Porter, etc.)
- Set environment variables
- Test payment flows
- Test delivery booking

---

## 📞 When to Ask for Help

Ask the AI to help with:
- Understanding which tasks to prioritize
- Breaking down large tasks into smaller steps
- Debugging specific errors
- Reviewing code for best practices
- Optimizing performance
- Writing tests
- Fixing broken links in documentation

---

## 💾 Files to Keep Updated

- `docs/README.md` - Update with new folder structure
- `docs/strategic-planning/STRATEGIC_PLAN_TECHNICAL.md` - Mark tasks as complete
- `docs/architecture/architecture_react_expo.md` - Update status markers
- `package.json` - Keep dependencies current
- `.env.example` - Document all required variables
- `CHANGELOG.md` - Log all changes

---

## 🚀 Success Criteria

**End of Session:**
- Clear understanding of current project state
- Prioritized list of next tasks
- Environment properly configured
- At least one task completed or in progress
- Documentation updated with progress

**End of Week:**
- 1-2 phases completed
- Database migrations deployed
- Core services implemented
- Main screens scaffolded
- Tests passing

**End of MVP (Week 8):**
- All Phases 0-7 complete
- All features working end-to-end
- <5 critical bugs remaining
- Ready for investor demo

---

**Last Updated:** Feb 17, 2026  
**Maintained By:** Development Team

