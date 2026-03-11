## Project Agent Rules

### Sentry maintenance rule for BookTalks Mobile

Sentry is already integrated into this Expo SDK 54 / React Native / Expo Router app and must be treated as part of the project’s normal quality checklist.

For every meaningful feature, bug fix, refactor, or infrastructure change, the agent must do a Sentry review before finishing work.

#### When a Sentry review is required

A Sentry review is required whenever a change touches any of the following:

- new screens, routes, layouts, or navigation flows under `app/`
- new feature service logic under `src/features/*/services`
- new Supabase queries, mutations, inserts, updates, deletes, RPCs, or auth/session flows
- new TanStack Query hooks, especially mutations and retry/error behavior
- auth, onboarding, profile setup, OTP, session restore, sign-in/sign-out flows
- file upload, image picking, network-heavy flows, async side effects, or multi-step user actions
- crash-prone UI, complex forms, optimistic updates, background work, or guarded flows
- changes to `app/_layout.tsx`, `src/lib/sentry.ts`, `app.json`, `metro.config.js`, `eas.json`, or env/build configuration

If a change is trivial and isolated (pure styling, copy-only text change, static layout tweak with no behavior change), the agent may note that no Sentry update is needed.

#### How to review Sentry for new screens

For new screens and routes:

- confirm the screen works with the existing Sentry route tracking pattern in `app/_layout.tsx`
- consider whether the screen introduces a new crash-prone flow, especially async boot/loading states, route params, conditional rendering from remote data, form submission, or media/image interactions
- do not add custom Sentry capture calls just because a screen exists
- only add Sentry-specific handling if the screen has a meaningful failure mode that would otherwise be silent or hard to debug

#### How to review Sentry for service-layer logic

For new or changed service functions under `src/features/*/services`:

- check whether failures are already surfaced clearly through thrown errors and UI handling
- prefer preserving clean error propagation over adding noisy `captureException` calls everywhere
- if a service failure is important to debug and likely to be swallowed, add minimal, structured, privacy-safe context
- tag by feature/service name where useful, for example `feature=exchange`, `feature=clubs`, `service=listingsService`, `service=clubsService`

Do not send raw request/response payloads, SQL strings containing user data, or unfiltered Supabase error objects if they may include sensitive fields.

#### How to review Supabase queries / mutations / RPCs

For any change involving Supabase:

- assume the failure may contain sensitive user or auth data
- never send access tokens, refresh tokens, auth headers, session objects, OTP data, full request/response payloads, addresses, or user-generated content
- if adding Sentry context around a Supabase operation, keep it minimal: feature name, service name, table or RPC name, and high-level operation type (`select`, `insert`, `update`, `rpc`)
- if an error is expected or user-driven (validation failure, permission denial already shown in UI, empty result state), do not capture it as a Sentry exception unless there is a specific product reason

#### How to review TanStack Query hooks and mutations

For new or changed hooks under `src/features/*/hooks`:

- review whether query/mutation errors are already handled by the screen/UI
- do not automatically report every query error to Sentry
- avoid duplicate reporting between service layer, hook layer, screen layer, and global unhandled error capture
- only add capture logic when a failure is unexpected, hard to reproduce, operationally important, or otherwise silent

For mutations, prioritize clear UI error handling first; Sentry should support debugging, not replace UX.

#### How to review auth/session-related logic

For auth, session, OTP, and profile flows:

- treat these as high-sensitivity areas
- verify that Sentry user context remains minimal and privacy-safe
- user context should generally be limited to the Supabase user id and optional low-risk tags like account type or membership tier
- never attach phone numbers, OTP codes, email, display name unless explicitly justified, full profile records, session payloads, or token values

Any change to auth/session restore, login, logout, or onboarding should include a Sentry privacy review.

#### How to review navigation changes

For changes to Expo Router structure or route behavior:

- preserve the existing route breadcrumb/tag behavior from `app/_layout.tsx`
- ensure new route groups or redirects do not break route tracking
- do not add duplicate navigation breadcrumbs in individual screens unless there is a strong reason

#### How to review error boundaries and crash-prone flows

For crash-prone areas (boot flows, async initialization, media flows, deep linking, guarded routes, large forms, or complex data dependencies):

- check whether an error boundary or root-level protection already covers the change
- if adding manual capture logic, keep it small and contextual
- capture unexpected, operationally useful failures
- do not capture user mistakes, validation messages, or known handled states as Sentry exceptions

#### What should be captured vs not captured

Capture in Sentry when the error is:

- unexpected
- actionable for debugging
- likely to affect real users
- not already fully explained by the UI
- not just a normal business-rule rejection

Do not capture when the error is:

- expected validation behavior
- a known empty state
- a normal permission rejection already handled clearly
- a user cancellation
- a retryable transient error already handled silently unless it becomes abnormal or repeated

#### Privacy and data-scrubbing requirements for this app

This app handles sensitive data. Sentry instrumentation must remain privacy-safe.

Never send or attach:

- phone numbers
- OTP codes or verification payloads
- Supabase access tokens
- Supabase refresh tokens
- session objects
- authorization headers
- cookies
- addresses or delivery details
- profile payloads
- referral codes
- book notes, discussions, replies, comments, or other user-generated content
- freeform form input unless explicitly scrubbed and approved

Always preserve or extend scrubbing behavior in `src/lib/sentry.ts` when introducing new sensitive fields.

#### Release and environment tagging expectations

All Sentry-related changes must preserve consistency with the current project conventions:

- environment values should stay limited to `development`, `preview`, and `production`
- release naming should stay consistent with the app’s current pattern in `src/lib/sentry.ts`
- if build metadata is introduced, keep it compatible with `EXPO_PUBLIC_APP_BUILD` and `EAS_BUILD_PROFILE`
- do not invent ad hoc environment names unless the user explicitly requests them

#### Sentry config and secret handling

Future agents must follow these rules:

- runtime DSN belongs in env/config, not hardcoded in app source
- `EXPO_PUBLIC_SENTRY_DSN` is acceptable as runtime config
- `SENTRY_AUTH_TOKEN` is build-time only and must never be committed to source code
- build-time Sentry secrets belong in EAS/CI secrets, not `.env`
- if sourcemap upload behavior is touched, verify `app.json`, `metro.config.js`, `eas.json`, and `package.json` scripts remain consistent

#### Testing and verification expectations

Whenever Sentry-related code or config changes are made, the agent must verify them with the smallest useful checks:

- run focused tests for changed Sentry helper logic
- run any impacted app tests if shared bootstrap/auth/config behavior changed
- verify Expo config resolves correctly when plugin/build config changes
- verify the app still renders/boots after Sentry changes
- after frontend-related Sentry changes, validate with Playwright or equivalent browser/runtime check where practical
- if changing sourcemap or release/upload configuration, validate the upload path or explain exactly what secret/build prerequisite blocks full validation

#### Noise control rule

Do not add broad, noisy, or speculative instrumentation.

Avoid:

- capturing every TanStack Query error
- capturing every Supabase error automatically
- adding breadcrumbs for all user input
- sending raw payloads for debugging
- adding analytics-like tracking to Sentry

Sentry in this repo should stay focused on real errors, actionable debugging context, safe metadata, and stable release/environment visibility.

When in doubt, prefer less instrumentation with better privacy and lower noise.