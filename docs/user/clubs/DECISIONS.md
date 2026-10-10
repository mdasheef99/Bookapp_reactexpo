# Clubs Remediation — Adopted Product Decisions

**Date:** 2026-08-22
**Authority:** User's current explicit decision (per AGENTS.md authority hierarchy #1), adopting the recommendations from the ChatGPT remediation-program thread (share link `chatgpt.com/share/6a89c761-974c-83ee-89ff-4103fa155106`).
**Effect:** Unblocks P0 → P1 stream. Every CLUB-WU-* confirmation prompt may now cite these as settled.

| Decision | Resolution |
|---|---|
| **PRODUCT-05 — Invitation expiry** | EXPIRE. `expires_at` enforced synchronously inside `accept_club_invitation` (`expires_at <= now()` → reject). TTL = 14 days. Legacy invitations stamped `migration_time + 14 days`. Cron relabeling pending→expired is presentation/housekeeping only, never authoritative. (Unblocks CLUB-WU-B04.) |
| **PRODUCT-10 — Report UI** | Overflow menu (`⋯ → Report`) on discussions. Wires existing backend/service/hook path. (Partially unblocks CLUB-WU-F01.) |
| **PRODUCT-11 — Un-vote** | Active vote toggles off. (Partially unblocks CLUB-WU-F01.) |
| **PRODUCT-12 — Un-react** | Active reaction toggles off. Multiple simultaneous reactions: NO. (Completes CLUB-WU-F01.) |
| **PRODUCT-14 — Banner ownership** | CLUB-owned, uploaded post-create. Pre-creation upload: NO. Club creation succeeds even if banner upload fails; banner retryable from club settings. Storage paths become `{clubId}/...`; fixes CLUB-BACKEND-01 bucket-wide policy via RLS on club-admin role. (Unblocks CLUB-WU-B01.) |
| **TYPE-03-d — Emoji domain** | CLOSED DB-enforced set. CHECK constraint on canonical 11: 👍 👎 ❤️ 🔥 👏 😂 😍 😮 😢 🤔 📚 (Unblocks CLUB-WU-T03; adds one CHECK migration to the ledger window.) |
| **PRODUCT-HIER-P04 — Self-moderation** | PROHIBITED. `issue_club_member_action` MUST reject actor=target server-side before status checks, for warn/mute/timed-mute/ban. Ordinary-member self-action remains an authorization denial. Consequence recorded: admin cannot self-ban → no self-inflicted admin vacancy → H01 guard cannot race succession flow. (Unblocks CLUB-WU-H01 with CLUB-HIER-01/02/03.) |

## Register summary (from the ChatGPT master program)

- **40 unique finding IDs**: BACKEND-01..07 · CACHE-01..02 · CLIENT-01 · DEBT-01 · FUNC-01..03 · HIER-01..03 · PERF-01..03 · PRODUCT-01/14 · TEST-01..08 · TYPE-01..05 · UI-01..03 · UX-01..02
- **16 product decisions** total: 9 already settled non-blockers (PRODUCT-01..04, 06..09, 13 retain current behavior), 1 disposition-pending (CLUB-BACKEND-06 restore-vs-delete), 7 resolved by this document.
- **17 work units**: B01–B04, C01–C02, D01, E01, F01, G01, H01, L01, P01–P03, T01–T04.
- Stream order: P0 decisions ✅ → P1 backend (B01, B02, B03+04, B04←P-05, H01) → P2 L4 contracts (L01) + parallel typing foundation (T01, scope-gated) → P3 client gaps (F01, CACHE-01, UX-02 copy) → P4 SDD-01 UI overhaul → P5 residual casts → P6 discussion scalability (PERF-01..03, scale-gated) → P7 regression + E2E (E01).
- Process per WU (unchanged): read-only confirmation prompt → user approval → bounded remediation → focused tests + regression → independent review → live readback if deployed → tracker verification ledger closure.

## Next authorized action

First P1 confirmation pass: **CLUB-WU-B01** (banner ownership / Storage policy tightening ← PRODUCT-14) — read-only, then user approval before any remediation.
