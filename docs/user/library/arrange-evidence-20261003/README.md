# Vertical Arrange implementation evidence — 2026-10-03

Owning contract: [SDD-05 §§20–21](../SDD-05-library-reading-room.md#20-arrange-shelf-shared-order-separate-dragging-2026-10-03). Status/next action: [Library tracker](../TRACKER.md).

## Verification actually run

- [Library Jest run](./jest-library.txt): **100 tests across 11 suites PASS**. Scope: order/drop geometry, arrangement state/storage, drag lifecycle, Shelf/chooser/appearance, Home, catalogue and Details regressions. Existing React `act` and Node deprecation warnings appear in the output. The drag fixture's required metadata was subsequently typed correctly and its [two tests rerun PASS](./jest-drag.txt).
- [TypeScript](./tsc.txt): **36 diagnostics outside Library; zero in Library**, matching the established baseline. This is not a globally passing type check.
- [Fresh web export](./web-export.txt) succeeds. [Bundle identity](./build-identity.json) records exact matching local/served SHA-256 for `entry-6e3dba25faea2ff1925c32ea40326903.js`; [browser facts](./browser-facts.json) confirm the final app loaded it.
- Authenticated real app: eight existing entries; cross-row Dune drop, one-step Undo, keyboard Earlier/Later, Cancel, Save/reload persistence, original-order restoration, Wishlist -> full All-books draft, disabled competing controls, and chooser selection without navigation PASS. Five action controls measure 44px tall at 320/430px and desktop; page width equals viewport width. [Final capture](./arrange-final.jpg) shows Arrange on the real app. The [chooser regression RED](./jest-chooser-red.txt) establishes the pre-fix “Open” announcement; the final run and actual app use “Select” in Arrange.
- [Isolated 80-book fixture facts](./fixture-facts.json) and [edge capture](./fixture-edge-scroll.jpg): real shared state, Gesture Handler, vertical drag and shelf source; theme/fonts/images/icons stubbed. Initial shared track: 550px viewport / 1,486px content. Book 19 began at x=1,017.2px beyond the viewport right x=907.6px; edge scrolling reached insertion before it. Both rows moved by the same 348px during ordinary horizontal browsing. Invalid final drops preserved the draft and removed the overlay; Undo restored all 80 IDs. The synthetic entries existed only in this fixture, which has no auth/database service imports. No fixture Save was performed.
- A gesture's total before/after scroll delta can include its time within the valid edge region. It is **not** evidence that scrolling continued while the pointer was outside. The exact frame lifecycle regression verifies no new scroll when the current target is invalid; held-outside-pointer behavior was not separately observed through the browser API.

The fixture's initial bundling/load failures were harness setup issues: root alias resolution, web preference over `.native` fallbacks and eager Worklets initialization. The final [build script](./build-fixture.cjs) / [entry](./fixture-entry.js) are reproducible with the installed Metro runtime; no dependency was installed. Generated bundle/HTML are ignored. The temporary fixture tab/server is closed; the user app stays open in All/Shelf with its original order. Temporary viewport overrides were reset through the documented browser API.

## Data and publication boundary

The user confirmed device-only saving. Verification wrote only the account-scoped local arrangement preference through Save, then restored the original eight-ID order. Book data, Supabase Database/Storage, migrations, dependencies and marketplace runtime were not changed. No staging, commit, push or deployment occurred. Prior unrelated workspace changes remain.

Native touch/gesture cancellation, assistive technology, reduced-motion interaction, refresh and large-library performance are NOT_RUN. The web fixture is not native performance evidence. Horizontal presentation/dragging and cross-device sync remain pending/deferred.

Documentation continuity: [validator](./continuity.txt) PASS (195 definitions; zero duplicates/missing traceability; 76 Markdown / 55 required files). Normal [repository diff check](./diff-check.txt) PASS; staged paths zero. 120 local links and the shared Arrange heading were checked successfully. Existing size advisories are retained.
