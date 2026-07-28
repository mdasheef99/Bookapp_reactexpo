# Phase 9 Unit 5C Lite Documentation Evidence

**Status:** bounded correction in progress after independent review
**Date:** 2026-07-29

## Authorized scope

Replace the governing older Unit 5C specification with the approved Lite target,
create and push a documentation-only candidate, and obtain one independent
exact-tip review with at most one bounded correction pass.

## Completed documentation scope

- dedicated Unit 5C Lite governing decision;
- root DOC-3/DOC-4/DOC-5/DOC-8 reconciliation;
- Phase 9 master, data, extraction, review, media, and marketplace SDDs;
- WU0/WU0B current-contract annotations;
- requirements traceability, data dictionary, current-vs-target audit, and
  complexity register;
- planning/implementation/master/global trackers and routing/session documents;
- continuity-validator routing and marker updates.

## Preserved current truth

- current selected-language behavior remains implemented;
- `p9-vision-v2` remains the strict current contract;
- M01 `book_search_aliases` remains the live limited schema;
- Unit 5B remains fixture/mock verified only;
- public publication requires a positive selling price;
- price-on-request is excluded;
- Unit 5C implementation remains unstarted.

## External and implementation effects

None. No source code, migration, Supabase/Storage, provider call, credential,
deployment, UI, search index, inventory, publication, or commerce change.

## Candidate validation

- Phase 9 continuity: pass.
- Markdown links: 49 files checked.
- Required Phase 9 files: 36 present.
- Requirement traceability: 195 definitions, zero duplicates, zero missing.
- Documentation line limit: pass; no Phase 9 Markdown file exceeds 350 lines.
- Superseded terminology search: remaining selected-language/three-English-alias
  references are explicitly labelled current runtime, live schema, or history.
- `git diff --check`: pass.
- Scoped secret scan: pass.
- Changed-file classification: marketplace documentation and its continuity
  validator only.

## Gate

Independent review of candidate `d73a9b1` found three current handoff documents
that still stated the selected-language and three-English-alias methods without
the required current-runtime/superseded-target qualification. This authorized
bounded correction pass reconciles those handoffs and adds regression coverage
to the continuity validator. The corrected exact documentation tip requires
independent re-review. After merge, Unit 5C implementation requires a new
session and separate authorization.
