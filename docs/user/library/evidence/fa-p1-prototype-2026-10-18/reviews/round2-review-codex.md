## 1. VERDICT

It embodies the reading-room aesthetic, but only partly the ESSENCE. Its biggest strength is the unboxed, readable note area, which makes the book feel personal without adding engagement machinery. Its biggest weakness is that calmness weakens around failure, uncertainty, and secondary interactions: the reader still has to interpret what happened and what a tap will reveal.

## 2. FINDINGS

| id | checklist item | what you see (file:line or image) | why it conflicts with the essence | concrete fix | severity |
|---|---|---|---|---|---|
| F01 | C2, C8, K4 | Image #7; [RemoveDialog.tsx:18](/C:/Users/LEGION/Desktop/Bookconnect4_fu1a/src/prototypes/flowA/components/RemoveDialog.tsx:18): generic irreversible-removal warning, using “collection.” | The reader’s important question is whether their notes, review, and saved pages disappear. The warning supplies gravity without supplying that answer. | Name the book, use “library” consistently, and state the verified consequences for personal content. Do not promise preservation without evidence. | must-fix |
| F02 | C2, C6, K4 | Image #5; [BookDetailsPrototype.tsx:48](/C:/Users/LEGION/Desktop/Bookconnect4_fu1a/src/prototypes/flowA/BookDetailsPrototype.tsx:48): offline content retains the normal status selector and Add note action. | The design explains what is displayed, but leaves persistence expectations unanswered. Looking fully operational is insufficient when the reader cannot tell whether changes will survive. | Define offline outcomes for each action. Communicate local saving, pending synchronization, or unavailability beside the affected action, according to actual capability. | must-fix |
| F03 | C6 | Image #4; [NotePassages.tsx:25](/C:/Users/LEGION/Desktop/Bookconnect4_fu1a/src/prototypes/flowA/components/NotePassages.tsx:25); [ScreenStates.tsx:22](/C:/Users/LEGION/Desktop/Bookconnect4_fu1a/src/prototypes/flowA/components/ScreenStates.tsx:22). Errors replace passages or the entire book screen. | Only the no-content failure presentation is designed. A failed refresh should not make previously available words disappear. | Add a failed-refresh state that retains last-known content with a quiet retry message. Keep the empty error screen for an initial load without cached content. | must-fix |
| F04 | A1, C8 | [RemoveDialog.tsx:13](/C:/Users/LEGION/Desktop/Bookconnect4_fu1a/src/prototypes/flowA/components/RemoveDialog.tsx:13): dialog has a name and focuses Cancel, but its consequence text is not associated as its description. | A screen-reader user can arrive at the buttons without automatically hearing the destructive consequence. | Associate the explanatory text with the dialog using the web description relationship and equivalent native announcement behavior. Preserve initial focus on Cancel. | must-fix |
| F05 | C3, C5, R1 | Image #5: a blue, full-width offline panel precedes the cover and moves everything down. | A passive connection condition becomes the first visual event. It competes with the reader’s content despite requiring no immediate action. | Use a short, unfilled secondary-text status line near the header. Reserve additional explanation for an affected action. | should-fix |
| F06 | A1, K1 | [CoverBlock.tsx:30](/C:/Users/LEGION/Desktop/Bookconnect4_fu1a/src/prototypes/flowA/components/CoverBlock.tsx:30) and [NotePassages.tsx:20](/C:/Users/LEGION/Desktop/Bookconnect4_fu1a/src/prototypes/flowA/components/NotePassages.tsx:20): title and section heading are styled text without heading semantics. | Visual readers can scan the hierarchy; assistive-technology users are not given the same structure. | Mark the book title and relevant section titles as headings, with appropriate web levels and native header roles. | should-fix |
| F07 | C1, C7, K4 | [BookDetailsPrototype.tsx:82](/C:/Users/LEGION/Desktop/Bookconnect4_fu1a/src/prototypes/flowA/BookDetailsPrototype.tsx:82): ownership expands into the same facts already summarized; empty community reviews expand from “None yet” to another empty statement. | These controls charge an interaction without revealing useful information. Collapsing unnecessary content does not make it necessary. | Render ownership as a quiet summary unless expansion adds detail. Hide empty community reviews or show one noninteractive empty statement. | should-fix |
| F08 | C4, R1, T2 | Images #1–2; [NotePassages.tsx:36](/C:/Users/LEGION/Desktop/Bookconnect4_fu1a/src/prototypes/flowA/components/NotePassages.tsx:36): quotation gets 18px literary serif; the reader’s own thought gets 16px interface sans. | The author’s words receive more typographic care and prominence than the reader’s reflection. That undercuts “amplify the human.” | Give all note passages equally comfortable literary typography. Let the quiet category caption and quotation marks distinguish their kinds. | should-fix |
| F09 | C1, R3, K2 | Image #9; [CoverBlock.tsx:16](/C:/Users/LEGION/Desktop/Bookconnect4_fu1a/src/prototypes/flowA/components/CoverBlock.tsx:16): every narrow screen stacks the full-size cover above even a short title. | The large empty area beside Walden spends scarce vertical space on the object and pushes the reader’s words and action down. | At narrow widths, try a smaller cover with adjacent title. Stack when the actual title or enlarged text requires it, rather than solely at a width threshold. | should-fix |
| F10 | K3, C8 | “My review” beside “Your notes”; prototype “Finished” versus existing shelf “Completed” in [libraryShelf.ts:29](/C:/Users/LEGION/Desktop/Bookconnect4_fu1a/src/features/books/utils/libraryShelf.ts:29). | The screen changes conversational perspective, while the same reading state changes names across surfaces. | Use “Your review.” Keep the more natural “Finished,” but adopt it consistently across the library during the real build. | should-fix |
| F11 | C2, K4 | Image #6; [ScreenStates.tsx:24](/C:/Users/LEGION/Desktop/Bookconnect4_fu1a/src/prototypes/flowA/components/ScreenStates.tsx:24): generic failure suggests checking the connection; not-found suggests removal. | Neither cause is established by these states. Speculation gives the reader troubleshooting work and can imply lost content. | Remove the speculative explanatory sentences. The distinct headings and retry/back actions already explain the available next step. | should-fix |
| F12 | A1, K4 | [DetailRow.tsx:15](/C:/Users/LEGION/Desktop/Bookconnect4_fu1a/src/prototypes/flowA/components/DetailRow.tsx:15) applies `expanded=false` to All notes, whose intended action opens a list. | Assistive technology describes a collapsed disclosure where the visual affordance promises navigation. | Make expansion semantics conditional. All notes should announce its destination without an expanded state; retain disclosure semantics for actual accordions. | should-fix |
| F13 | C2, K1 | [fixtures.ts:68](/C:/Users/LEGION/Desktop/Bookconnect4_fu1a/src/prototypes/flowA/fixtures.ts:68): the Tristram Shandy fixture inherits the visibly titled Walden cover. | Even fixture content should form a believable book identity; contradictory artwork distracts from judging the long-title design. | Use the existing no-cover treatment for this fixture or supply matching local artwork. | consider |

## 3. COPY

| Current string | Replacement |
|---|---|
| “My review” | “Your review” |
| “Not written yet” — collapsed and expanded | “No review yet.” |
| “You’re offline. Showing your last saved copy.” | “Offline · Showing saved content.” |
| “Remove from library?” — visible title and accessible name | “Remove “{book title}” from your library?” |
| “This book will be removed from your collection. This action cannot be undone.” | “You can’t undo this removal.” |
| “Remove” — dialog confirmation | “Remove book” |
| “Check your connection and try again.” | Omit; retain the error heading and Try again button. |
| “It may have been removed.” | Omit; retain the not-found heading and Back to Library button. |
| “None yet” / “No public reviews yet.” | If the empty community section remains, show “No community reviews.” once, without expansion. |

The removal dialog also needs a factual sentence explaining what happens to notes, reviews, and saved pages; this offline UI review cannot establish their retention behavior.

## 4. KEEP

- Unboxed passages, generous line spacing, and restrained metadata.
- One unmistakable Add note action, with no promotional or engagement prompts.
- Warm daylight and golden palettes, and a midnight palette that preserves hierarchy.
- The muted, local no-cover treatment without a bright empty rectangle.
- Plain counts, collapsed review, and absent saved-page rows when empty.
- Static loading treatment, generous targets, keyboard radio selection, and dialog focus returning to its trigger.