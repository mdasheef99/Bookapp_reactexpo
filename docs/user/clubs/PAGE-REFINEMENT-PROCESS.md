# Clubs Page-by-Page UI/UX Refinement Process

Use this workflow for each Clubs page redesign. It keeps each page grounded in
its existing behavior, approved visual direction, and evidence from the running
implementation. A process approval for one page does not authorize another.

## Established design direction

- Warm ivory backgrounds, white surfaces, and burgundy accents.
- Newsreader headings and Inter body text and controls.
- Calm reading-community tone, compact spacing, clear hierarchy, and accessible
  touch targets.
- Keep the Authors directory button visible.

References:

- [Stitch Clubs project](https://stitch.withgoogle.com/projects/12334872055044206539)
- Approved directory artboard: `e380d3b4d9294044a89bf96c46c7074c`
- Approved discussion-listing artboard: `5d184ceefc5d4836b6d747322929d4ec`
- [Astra critique conversation](https://chatgpt.com/c/6ab83334-f56c-83e8-92f8-87f35eff8028)

## Workflow

1. **Inspect and map the current page.** Open it in the running app and read
   the relevant source. Map every control, route and navigation path,
   validation rule, permission gate, query, mutation, and loading, empty, error,
   and pending state. Preserve unrelated working-tree changes.

2. **Prepare the visual proposal.** Apply the established Clubs design direction
   while preserving the behavior map. Identify the states the proposal covers
   and any states that need separate frames or interaction notes.

3. **Use Stitch for major redesigns.** Work in the existing Stitch project.
   Inspect the rendered artboards themselves and compare their dimensions,
   copy, controls, and states against the source map. Stitch completion messages,
   links, and generated summaries are not visual verification.

4. **Obtain Astra critique and implementation approval.** Confirm Astra's
   selected model for the review. Attach current screenshots from the current
   proposal and provide complete behavior, design, accessibility, and reference
   context. Request critical analysis and alignment with the Clubs philosophy
   and references. Refine the proposal, then obtain the user's approval before
   implementation. Links and old attachments do not prove a current visual
   review. If current screenshots cannot be attached or reviewed, report that
   limitation and wait unless the user authorizes another process.

5. **Use self-critique only with page-specific authorization.** A simpler
   palette or presentation change may skip Astra when the user explicitly
   authorizes that simpler process for that page. Follow the exact scope of the
   authorization; self-critique approval for one page does not carry forward.
   If implementation approval was not included, obtain it before coding.

6. **Implement only the approved scope.** Preserve existing routes, queries,
   mutations, services, backend interactions, schema, and permissions. Treat
   any proposed behavior, data, or authorization change as a separate scope that
   needs explicit approval. Planning, visual approval, and read-only database
   access do not grant write, migration, deployment, commit, or push authority.

7. **Verify the running implementation.** Check the actual app at desktop and
   390×844. Exercise the mapped controls, navigation, validation, scrolling, and
   controls above fixed bottom tabs. Run appropriate focused tests, TypeScript,
   web export, and documentation checks. State which checks used live behavior,
   mocks, or static inspection, and name anything that remains unverified.
   Never submit business data or change permissions during a read-only check.

8. **Review, document, and close the work unit.** Obtain an independent,
   read-only subagent review of the screen, shared components, tests, and docs.
   Resolve confirmed findings, inspect the complete diff, update the Clubs
   tracker and scoped pre-PR review record, and run diff hygiene and required
   documentation validation. Record exact Git state, uncommitted changes,
   verification, residual gaps, and one precise next action. Follow the scoped
   commit/publication review process; do not commit or push without current
   authorization.
