# BookConnect library — design essence (review checklist)

Statement: a quiet, well-made reading room. It shows your books and thoughts beautifully, works without explanation, and never asks for your attention.

## Calm Technology (Amber Case) — main approach
C1 Smallest possible attention: every element must earn its place; the reader should be able to glance and leave.
C2 Inform and create calm: tell the reader what is true (saved / not saved / offline) without alarm, urgency or celebration.
C3 Use the periphery: secondary information (counts, dates, ownership, options) sits quietly at the edge, never competing with the reader's own content.
C4 Amplify the human: the reader's own words (notes, review) are the most prominent content after the book itself; the app's own voice stays minimal.
C5 Communicate without speaking: state is shown by placement, weight and form, not by banners, badges, colour alarms or copy.
C6 Work even when it fails: offline / error states keep the reader's content visible and say plainly what is and isn't possible.
C7 Minimum technology: no decorative animation, no gimmicks, no features the screen doesn't need.
C8 Respect norms: platform-native behaviour (Back, dialogs, focus, screen readers) and plain, kind language.

## Refactoring UI — visual hierarchy
R1 Hierarchy by weight and colour before size; de-emphasise secondary content rather than emphasising primary.
R2 Fewer borders; separate with space and subtle background shifts.
R3 A limited spacing and type scale used consistently; generous whitespace.
R4 Labels only where needed; data speaks for itself.

## Bringhurst / Butterick — text
T1 Body text comfortable: >=16px, line height ~1.35-1.5, measure <= ~70 characters.
T2 Hierarchy through typography (serif display + humanist sans), not boxes.
T3 Typographic correctness: real quotes, sensible ellipses, no all-caps body labels.

## Krug — flows
K1 Self-evident: a first-time reader knows what the screen is and what to do without thinking.
K2 Obvious primary action; clear "where am I / how do I go back".
K3 Consistent words for the same thing across the app.
K4 Nothing that makes the reader wonder (ambiguous labels, hidden states, surprising taps).

## Baseline
A1 WCAG 2.2 AA: contrast, 48dp targets, names/roles, focus order, 200% text, no focus obscured.
