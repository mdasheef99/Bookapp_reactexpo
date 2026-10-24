# 02 — Auth and Session

**Last checked:** 2026-10-18, against the code and the documents it cites.

Sign-in is phone OTP (Indian `+91` numbers) through Supabase Auth. The session lifecycle is
centralised so that one place owns startup, account switching and logout.

## Who owns what

| File | Responsibility |
| --- | --- |
| `src/features/auth/store/authStore.ts` | Canonical Zustand auth state: `session`, `status`, sanitised `initializationError`. User is derived from `session.user`. |
| `src/application/auth/AuthBootstrapOwner.tsx` | Mounted once under the root `QueryClientProvider`; starts the bootstrap. |
| `src/application/auth/authBootstrap.ts` | The single `onAuthStateChange` subscription and guarded `getSession()` restore. |
| `src/application/auth/sessionCoordinator.ts` | Orders identity transitions and runs privacy cleanup between users. |
| `src/application/auth/logout.ts` | The only current-device logout path (`logoutCurrentDevice`). |
| `src/features/auth/hooks/useAuth.ts` | Facade used by screens: session, user, loading, `initialize`, `signOut`. |
| `src/features/auth/services/authService.ts`, `profileService.ts` | OTP sign-in and profile reads/writes. |
| `src/features/auth/services/authStorage.ts` | Derives the `sb-<project-ref>-auth-token` key, removes it on fallback, and keeps a non-secret `…-logout-pending` marker. |
| `src/features/auth/config/authBypassPolicy.js`, `authRuntimeConfig.ts` | Pure dev-bypass policy and the runtime configuration built from env vars. |
| `src/lib/storage.ts` | AsyncStorage adapter used by the Supabase client. **Unencrypted.** |

Auth status values: `initializing`, `authenticated`, `unauthenticated`,
`initialization-error`, `logout-error`, `session-cleanup-error`.

## Startup

0. **Interrupted logout first.** If a `…-logout-pending` marker survived (for
   example the app was killed mid-logout), the bootstrap does not restore the
   session: it removes the stored token and the marker, then applies
   `SIGNED_OUT` (`recoverPendingLogout` in `authBootstrap.ts`). If that removal
   fails, status becomes `logout-error`. Incoming auth events check the marker too.
1. The bootstrap subscribes to `onAuthStateChange` **before** calling `getSession()`.
2. Duplicate initialise calls share one promise.
3. `getSession()` is bounded by `AUTH_INITIALIZATION_TIMEOUT_MS` (5 s).
4. A newer auth event invalidates an older restore result.
5. A clean `null` result becomes `unauthenticated`; a failure becomes
   `initialization-error`, which the root layout shows with a retry button.

## Switching users

Same-user token refreshes and profile updates update the session without
clearing anything. Cleanup runs only when a user signs out or one user is
replaced by another. The previous session is hidden immediately, and the next
user is not exposed until cleanup finishes.

Cleanup (`cleanPreviousUserState` in `sessionCoordinator.ts`) runs:

- `clearImageInventoryIdentityState()` — cancels and clears Phase 9 Owner queries;
- `clearCommerceSession()` — cancels queries, clears the mutation cache and the
  whole `appQueryClient`, and resets commerce local state.

If cleanup fails **while switching to another user**, status becomes
`session-cleanup-error` and the root layout offers a retry
(`retryBlockedSessionTransition`). If cleanup fails **during sign-out**, the
failure is reported to Sentry and status still becomes `unauthenticated`. No
retry is offered; the next identity change runs cleanup again, because the
previous user is only forgotten after cleanup succeeds.

TanStack Query data in `appQueryClient` is cleared automatically. **Any new
Zustand store, module-level cache or AsyncStorage key holding per-user data must
add its own step to `cleanPreviousUserState`.** Known gap: recent library
searches (`src/hooks/useRecentSearches.ts`, AsyncStorage) are not cleared.

## Library note state

- `src/features/books/notes/noteDeck.ts` defines the AsyncStorage key
  `library_noteSwipeOrder:v1:<userId>`; `app/(tabs)/library/notes-swipe.tsx`
  reads and writes the user's `shuffle`, `newest` or `oldest` preference.
- `src/components/library/notes-swipe/useNoteSwipeMotion.ts` stores the
  first-visit hint marker at `library_noteSwipeHint:v1:<userId>`.
  These keys are scoped by user ID; `cleanPreviousUserState` does not remove them.
- `src/features/books/notes/manualNoteContract.ts` defines actor-scoped
  `library-note-deck` query keys for the index and individual cards.
  `noteDeckCache.ts` shares in-flight card requests through a `WeakMap` keyed
  by QueryClient, with user/note IDs identifying each request; entries are
  removed when requests settle.
- `src/features/books/notes/useManualNotes.ts` keeps save-receipt deduplication,
  deletion tombstones and card-retention counts per QueryClient, resetting its
  module memory on auth user-ID changes. `useNoteDeck.ts` retains a bounded
  window of cards and releases it on movement, blur or unmount.
- `src/features/books/notes/noteNavigation.ts` stores reader/composer return
  contexts (including swipe scope, category, order, seed and position) in a
  module Map; contexts are checked against actor/book IDs and cleared on auth
  user-ID changes.

## Logout

Profile and Settings both call `useAuth().signOut`, which delegates to
`logoutCurrentDevice()` in `src/application/auth/logout.ts`. The order is:

1. Write the pending-logout marker. If this fails, logout throws and auth state
   is unchanged.
2. Mark the user as logged out (blocks silent restore of that user).
3. Start the `SIGNED_OUT` transition: the session is hidden immediately and
   query/commerce cleanup is queued (it is not awaited before the network call).
4. Call `supabase.auth.signOut({ scope: 'local' })` (current device only).
5. If that call fails: remove the stored token key and the marker directly.
   If it succeeds: remove only the marker.
6. Wait for cleanup to finish.
7. If any storage removal in step 5 failed, status becomes `logout-error` and
   logout throws.

Notes:

- A failed Supabase call is **not** an error if both the token and marker
  removals succeed; logout resolves normally.
- Retrying from `logout-error` re-runs the local token/marker removal and the
  `SIGNED_OUT` transition; it makes no new network call.
- A logged-out user cannot be silently restored by a later token refresh; an
  explicit new `SIGNED_IN` is required.

## Development auth bypass

UI-only bypass needs all three: `__DEV__`, `EXPO_PUBLIC_APP_ENV=development`
and `EXPO_PUBLIC_DEV_SKIP_AUTH=true`. Any other environment that requests it
fails at configuration time. `npm run validate:auth-config` checks this policy
(and in production also requires the Supabase URL and key). It reads only the
environment variables of the shell that runs it; it does not load `.env.local`
or an EAS profile (`eas.json`), so set the target build's values first. It is
**not** wired into EAS or CI, so run it manually before preview or production
builds.

**Never use the bypass to test authorization, RLS, Store Owner access or
platform review.** It only lets screens render.

## Known gaps

- Token storage is unencrypted AsyncStorage; secure storage has not been
  implemented.
- The Supabase client uses a no-op local auth lock (`src/lib/supabase.ts`).
- Store Owner login intent travels only as a route parameter (login → OTP →
  profile setup); there is no durable intent or return-to store.

## Tests

`src/application/auth/__tests__/` (bootstrap, coordinator, logout),
`src/features/auth/**/__tests__/`, `app/__tests__/_layout.test.tsx`,
`src/features/marketplace/commerce/__tests__/commerceSession.test.ts`.
