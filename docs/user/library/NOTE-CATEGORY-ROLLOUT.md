# Five note categories — approved direction and rollout

**Current rollout status — 2026-10-17:** all five stored identifiers and SQL null remain supported. The reviewed persistence correction is now applied/read back as **20261017083830**, with exact SQL SHA256 and catalog/privilege verification; [receipt](./evidence/sdd06-forward-correction-application-2026-10-17/README.md). All four application gates remain false; no real API round trips/cleanup or enablement occurred. **Stop after application per owner instruction.** Further connected verification/enablement requires a new scoped instruction; no question-only migration is needed.

**Historical local-candidate checkpoint — 2026-10-11:** `20261010172118_library_manual_note_persistence.sql` passed sixteen projected-baseline SQL cases and [Luna/max review](./evidence/sdd06-persistence-local-2026-10-10/LUNA-REVIEW.md). That file differs from the applied variant and must not be replayed. The earlier storage-rejection evidence and question-only proposal below describe the unmigrated baseline; they are not current-state or next-action authority.

**Previous 2026-10-10 preflight handoff:** [manual-note persistence proposal](./MANUAL-NOTE-PERSISTENCE-PLAN.md) addresses Question/null together with the existing SDD-06 version/reconciliation/owner-grant gates. [Fresh evidence](./evidence/sdd06-persistence-preflight-2026-10-10/README.md) confirms live storage still rejects both values. This is a bounded proposal only; no SQL migration file/application or gate enablement occurred. Earlier question-only plan below remains historical.

User approved Quote, Thought, Takeaway, Action and Question on 2026-10-07.

| Display label | Stored value | Description | Optional writing prompt |
| --- | --- | --- | --- |
| Quote | quote | Words from the book worth keeping | Which words do you want to keep? |
| Thought | reflect | Your reactions, interpretations or connections | What are you thinking about? |
| Takeaway | distill | An important idea in your own words | What is the main idea in your own words? |
| Action | apply | Something you want to try or put into practice | What could you try? |
| Question | question | Something you want to understand or explore | What are you still wondering? |

The retained legacy editor defaults to Thought through reflect. The current manual chooser starts unselected, permits Skip/No category, and preserves text when the category changes. Uncategorized is SQL null, not a sixth category. Categories describe purpose; optional topic tags and Question answered/Action done states remain later proposals. No automatic category inference or required writing prompts. Quote notes remain distinct from saved passages; neither is automatically duplicated into the other.

### Historical 2026-10-09 after-book-entry target and preflight

The default described above belongs to the existing legacy editor. The owner-pasted controlled-refinement task explicitly makes category optional, initially unselected, with Skip/No category before input and changeability until saving. [SDD-06 revision 0.2](./SDD-06-after-book-entry-ui.md) owns that target; OCR must preserve the chosen category. Uncategorized is an absence of classification, not a sixth category. New editors use a compact Change control after the initial chooser; the five display labels remain fixed.

Fresh metadata-only Supabase MCP verification on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn confirms tag is NOT NULL and constrained to the original four values; page is nullable/positive and the 500-word check remains. Both Question and uncategorized saving are therefore unsupported today. [Evidence receipt](./evidence/sdd06-review-2026-10-09/README.md) records the exact scope and synthetic word-limit probes; no note content or writes were involved.

The earlier question-only migration proposal below is insufficient for the complete optional-category target. The future narrowly authorized persistence design must address Question, nullable classification, existing-renderer/filter compatibility and actor/book authorization without remapping unsupported values. A broader security/reconciliation need is a separate scoped preflight, not silently added to that migration. No migration file creation/application is authorized here. Visual simulation can show the desired categories; functional saving cannot claim full support until enabled and verified.

Before enabling new writes, verify all existing internal consumers can read Question/null without crashing or relabeling them. Preserve the four existing values/rows; no automatic category backfill or rename. Check both worktree trackers before any shared-schema proposal, following AGENTS.md. Compatibility preparation, migration-file creation, application and write enablement remain distinct steps.

## Historical read-only evidence — original four-value baseline

Supabase MCP verified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn ACTIVE_HEALTHY. A metadata-only constraint query returned reading_notes_tag_check allowing exactly quote, reflect, distill, apply. Existing content, page and 500-word checks remain. No note content read, database write or migration performed.

Display renames are implemented locally through shared NOTE_TAG_CONFIG. Stored identifiers and existing rows are preserved. Question is designed but must not be exposed as a savable application category while live storage rejects it.

## Historical question-only proposal — superseded by the forward correction

1. Obtain explicit approval to create a migration file expanding only reading_notes_tag_check to quote, reflect, distill, apply, question. Do not rename existing values, backfill notes or change RLS/word/page constraints.
2. Before creation, re-verify the exact project and inspect both worktree trackers for concurrent shared-schema work. Record filename/effects in the owning migration ledger.
3. Verify the migration on a disposable database: all five valid values accepted, unknown values rejected, existing four retained; other constraints/security unchanged. No live test notes required for preparation.
4. Obtain separate approval to apply to the verified project; read back the exact resulting constraint and migration version.
5. Add question to NoteTag, shared config, category selector, filters and Question prompt, with create/edit/filter regressions. Check all note renderers and shared consumers for compatibility before enabling new writes, including the sibling feature tree without editing it here.
6. Confirm round-trip create/edit/filter and existing-note preservation in an authorized test account. Question must retain its own identifier, never silently save as reflect.

Historical question-only checkpoint: no SQL file existed at that point. This recipe is superseded; do not create or replay a question-only migration from it. The current correction's application/readback is complete as linked above. Category round trips/cleanup and gate enablement remain unverified/separately scoped; stop now as instructed by the owner.

Category closeout: existing NoteEditor OCR regression suite10/10 PASS; Phase9 continuity PASS (195 definitions, zero duplicate/missing traceability;76 Markdown files), diff hygiene PASS and staged diff empty. Actual Stitch AX readback verified five radio labels, Thought default and Question description; screenshot/evidence docs/user/library/design-review-20261007/stitch-categories.jpg and stitch-categories.txt. Question selection/text-preservation interaction not established from the attempted click; no prototype interaction or native accessibility acceptance claimed. App Question create/edit/filter tests remain pending until storage enablement. Supabase changelog index fetch returned unsupported-content-type; no Supabase API/schema implementation performed. No new native build/web export, migration or database writes. Labels and documentation/evidence remain uncommitted; prior changes preserved. Next action remains explicit narrow migration-creation authorization per NOTE-CATEGORY-ROLLOUT.md.
