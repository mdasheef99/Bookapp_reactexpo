# 01 — App Structure

**Last checked:** 2026-10-18, against the code and the documents it cites.

## Stack

Expo / React Native with TypeScript, Expo Router (file-based routes under
`app/`), NativeWind (Tailwind classes), TanStack Query (server state), Zustand
(local state), Zod (validation), Supabase JS, AsyncStorage, Sentry, Jest
(`jest-expo`) and Playwright. See `package.json` for exact versions.

The `@/` import alias maps to `src/`. The app entry point is `expo-router/entry`
(`package.json` `main`); the root `App.tsx` and `index.ts` are unused leftovers.

## Running the app locally

1. Copy `.env.example` to `.env.local` and fill in `EXPO_PUBLIC_SUPABASE_URL`,
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_APP_ENV` and the Sentry values.
2. `npm.cmd run web` (or `npm.cmd start` for Expo Go / devices).
3. Sign in with phone OTP. `app/(auth)/verify-otp.tsx` hard-codes a development
   test phone and shows its code hint on screen; that number only works if it is
   also enabled in Supabase Auth settings (see `.env.example`).
4. Playwright tests need a built `dist/` (served by `_serve.js` on port 8081)
   and Microsoft Edge at the path hard-coded in `playwright.config.ts`.

## Top-level layout

| Path | Contents |
| --- | --- |
| `app/` | Routes (screens). Route files are thin and usually mount one screen from `src/features/`. |
| `src/application/` | Cross-feature coordination. Contains `auth/` (session lifecycle, logout). |
| `src/features/<name>/` | Feature modules: services/api, hooks/queries, screens, components, contracts. See 04. |
| `src/components/` | Shared UI: `ui/` (Button, Input, GlassCard, AtmosphericBackground, OfflineBanner), plus `search/`, `library/`, `notes/`, `exchange/`. |
| `src/lib/` | `supabase.ts` (client), `storage.ts` (AsyncStorage adapter), `queryClient.ts` (shared `appQueryClient`), `sentry.ts`, `navigation.ts`, `constants.ts`. |
| `src/hooks/`, `src/store/` | Shared hooks (debounce, network status, theme, wishlist) and the theme store. |
| `supabase/` | Migrations, Edge Functions, shared server code, SQL/integration tests. See 03. |
| `workers/` | Phase 9 background worker services (Node, Docker). See 03. |
| `scripts/` | Build, smoke, validation and Phase 9 worker helper scripts. |
| `e2e/` | Playwright web tests. |
| `docs/` | Specs, phase SDDs and trackers. See 09. |
| `app.json`, `eas.json` | Expo app config (plugins, camera/photo permissions used by scanning) and EAS build profiles (`development`, `preview`, `production`, each setting `EXPO_PUBLIC_APP_ENV`). |
| `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `global.css` | Build config: plain Expo Babel preset; Metro wrapped only by Sentry; Tailwind content paths and theme; `global.css` (Tailwind directives) imported by `app/_layout.tsx`. Check these before assuming NativeWind is fully wired. |

## Root shell

`app/_layout.tsx` wraps the app in this order:

`Sentry.ErrorBoundary` → `GestureHandlerRootView` → `SafeAreaProvider` →
`QueryClientProvider (appQueryClient)` → `AuthBootstrapOwner` +
`AtmosphericBackground` → `InitialLayout` → `<Slot />`.

`InitialLayout` waits while auth initialises, shows a retry screen for
recoverable auth errors (`initialization-error`, `logout-error`,
`session-cleanup-error`), syncs the Sentry user and route, and redirects:

- no session outside `(auth)` → `/(auth)/login`
- session inside `(auth)` (except `setup-profile`) → `/(tabs)/library`

`app/index.tsx` sends signed-in users to `/(tabs)/library` and guests to
`/(auth)/login`.

In development auth bypass (see 02), `app/index.tsx` always opens
`/(tabs)/library`, the root-layout redirects are skipped, and the auth bootstrap
does not run (status stays `unauthenticated`).

## Routes

### `app/(auth)/` — sign-in

`login.tsx`, `verify-otp.tsx`, `setup-profile.tsx`.

### `app/(tabs)/` — signed-in consumer app

Tabs, in order: **My Library**, **Exchange**, **Marketplace**, **Clubs**, **Profile**.

| Area | Routes |
| --- | --- |
| Library | `library/index`, `library/search`, `library/[bookId]`, `library/notes` |
| Exchange (P2P) | `exchange/index`, `exchange/create`, `exchange/[listingId]`, `exchange/my-transactions`, `exchange/transaction/[transactionId]` |
| Marketplace (stack) | `marketplace/index` (search), `marketplace/book/[listingId]` (one public listing's detail), `marketplace/store/[storeId]` (public store page), `marketplace/cart`, `marketplace/requests/index`, `marketplace/requests/[requestId]` |
| Clubs | `clubs/index`, `create`, `authors`, `invitations`, `venues`, `venues/[venueId]`, and per club `clubs/[clubId]/`: `index`, `manage`, `events`, `events/create`, `events/[eventId]/edit`, `discussion`, `discussion/[topicId]`, `reading`, `nominate`, `invite`, `applications`, `venues` |
| Profile | `profile/index`, `edit`, `settings`, `addresses`, `credit-history`, `notifications`, `notification-settings` |

### `app/(store-owner)/` — Store Owner console

Visible tabs: **Dashboard**, **Inventory**, **Store View**, **Orders**, **Subscription**.

| Route | Purpose |
| --- | --- |
| `index` (hidden) | Gate: resolves the Owner's state from the server and routes onward |
| `onboarding`, `status`, `setup` (hidden) | Store application, review status, setup checklist |
| `dashboard` | Store health, quotas, subscription, compliance blockers |
| `inventory/` (stack) | `index` (inventory hub), `scan/` (scan flow: `index`, `preview`, `[sessionId]/index`, `[sessionId]/missed`, `[sessionId]/summary`) |
| `store-view/` (stack) | `index` (committed stock list), `[inventoryId]` (detail, edit, photos, history) |
| `orders/index`, `orders/[requestId]` | Phase 6 Owner order-request inbox and detail |
| `store-profile` (hidden) | Store profile and public storefront settings |
| `storefront` (hidden) | Redirect alias to `store-profile` (still linked from the setup checklist) |
| `subscription` | Plan, entitlements, usage |

Inventory is where books are scanned, reviewed and added. Store View is where
already-added stock is managed and published. They are deliberately separate.

### Other

`app/dev-clubs-foundation.tsx` is a development-only Clubs design preview. It
renders nothing outside `__DEV__` and is not linked from navigation.

## Historical architecture doc

`docs/architecture/architecture_react_expo.md` is useful background, but its
database and migration inventory is historical. Use this folder, the code and
live Supabase checks instead.
