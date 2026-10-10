# Owner edition-picker publication and development backend rollout

## 2026-10-10 - Owner-authorized feature publication and development backend rollout

Phase 9 / Unit 6G remains active; Tasks 1-8 retain their recorded local approval and verification boundaries. The Owner explicitly authorized committing this edition-picker work, a GPT-6 Luna review at max before pushing, bounded corrections of confirmed findings followed by correction review, publication to GitHub main after approval, and compatible development backend rollout.

The separate Desktop Unit 6I checkout remains outside this publication. All nine baseline commits are already in main at 6e8848e82b47538f67962f0e34238d0017707711. The feature must integrate that current main without dropping its later work. M65-M71 source bytes remain immutable; their recorded shared application is not permission to reapply migrations.

Current work unit: local publication preflight and pre-push review. Exact next action: commit the feature snapshot, integrate current main, then perform the requested read-only subagent review and verification before publication. Runtime rollout follows approval/publication; new provider-result retention remains disabled until independently verified permission is available. No feature publication, deployment, or new shared database mutation is claimed at this checkpoint.

See the publication/deployment evidence below for fresh checks, review findings, corrections, exact commits and service readback. Earlier dated handoffs retain historical provenance.

## Scope and authority

Authority is the Owner's explicit 2026-10-10 request. Product behavior remains picker SDD sections 3-11 and 13.2, Master MAS-02/03/05/07/15/17/18, and the existing Unit 6G/7A contracts. This record concerns publication and operational verification, not new product requirements.

Starting feature root: C:/Users/user/.codex/worktrees/edition-picker-research/Bookconnect. Branch codex/edition-picker; HEAD ee3a8c79429ca401d468861f2861721082ba955e. Starting dirty scope: 75 modified and 87 untracked files, zero staged (162 paths). Starting Desktop root is codex/unit6i-owner-review-saved-books at the same HEAD; its 229 expanded dirty paths are separately hash-snapshotted and must remain unchanged.

Read-only preflight verified Supabase Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY. Existing Render phase9-metadata-worker is srv-d9sqfdvqj5pc73dc66fg, repository Bookapp_reactexpo, branch main, Dockerfile workers/phase9-metadata-worker/Dockerfile, one instance and automatic deployment off. Shared function/registry/migration readback will be refreshed before deployment.

## Pre-commit checks

Metadata-worker build and structural integration: 14/14 PASS, normal exit 0. Phase 9 continuity and whitespace checks PASS, normal exit 0; document-size and LF/CRLF advisories remain nonblocking. Whole client TypeScript (--noEmit --allowImportingTsExtensions) PASS, normal exit 0. No new Jest/native race/provider/browser proof is claimed here. Full merged-tree verification is required before main publication.

## Ordered remaining work

1. Commit the exact feature scope locally; integrate current main and preserve both histories.
2. GPT-6 Luna at max performs an independent read-only pre-push review. Confirm findings from source and regressions; apply only bounded justified corrections; have the same requested model review corrections.
3. Run full merged-tree Jest and required SQL/build/TypeScript/continuity gates; publish the approved branch/main without force.
4. Deploy the compatible existing Supabase Edge function and Render metadata worker from the reviewed source. Verify code identity, authentication and non-mutating health/read paths.
5. Exercise the existing development UI and operational paths within the provider-permission gate. Unknown provider retention permission remains fail-closed; no registry flag or cache header substitutes for it.

## Evidence and closeout

Review, correction, publication and backend outcomes are appended here when actually observed. Current checkpoint is not full operational acceptance. No Supabase migration, Storage/business-data mutation, deployment or provider call occurred in this preflight; registry/retention flags remain unchanged.
