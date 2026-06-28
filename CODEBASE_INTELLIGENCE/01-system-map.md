# 01 - System Map

## App Shape

BookConnect is an Expo SDK 54 / React Native app using Expo Router, TypeScript, NativeWind, TanStack Query, Supabase, MMKV, Sentry, and Jest.

Key files:

- `app/_layout.tsx` - root provider shell, auth guard, Sentry setup, route tracking, and dev auth bypass handling.
- `app/index.tsx` - root redirect. Authenticated users go to `/(tabs)/library`; unauthenticated users go to `/(auth)/login`.
- `app/(auth)/_layout.tsx` - auth stack layout.
- `app/(tabs)/_layout.tsx` - authenticated tab layout.
- `app/(store-owner)/_layout.tsx` - Store Owner route stack.
- `src/lib/supabase.ts` - Supabase client.
- `src/lib/mmkv.ts` - MMKV storage and Supabase storage adapter.
- `src/lib/sentry.ts` - Sentry init and capture helpers.
- `global.css`, `tailwind.config.js`, `babel.config.js`, `metro.config.js` - styling/build configuration.

## Root Provider Flow

`app/_layout.tsx` wraps the app with:

- `Sentry.ErrorBoundary`
- `GestureHandlerRootView`
- `SafeAreaProvider`
- `QueryClientProvider`
- `AtmosphericBackground`
- `StatusBar`

`InitialLayout` calls `useAuth().initialize()` once, syncs Sentry user/route state, and applies route redirects.

## Routing

Top-level route groups:

- `app/(auth)` - login, OTP verification, profile setup.
- `app/(tabs)` - signed-in consumer app.
- `app/(store-owner)` - Store Owner gate, onboarding, review status, and setup checklist.

Tabs:

- `library` - personal library and book search.
- `exchange` - P2P exchange.
- `clubs` - clubs, discussions, events, venues, invitations, management.
- `profile` - account, settings, notifications, addresses, credit history.
- hidden tab routes include `credit-history` and `addresses`.

Nested layouts:

- `app/(tabs)/library/_layout.tsx`
- `app/(tabs)/exchange/_layout.tsx`
- `app/(tabs)/exchange/transaction/_layout.tsx`
- `app/(tabs)/clubs/_layout.tsx`
- `app/(tabs)/profile/_layout.tsx`

## Current Marketplace Product Surfaces

Current Store Owner routes:

- `app/(store-owner)/_layout.tsx` - hidden Stack layout for Store Owner routes.
- `app/(store-owner)/index.tsx` - gate route; resolves Store Owner state server-side through store ownership/application records.
- `app/(store-owner)/onboarding.tsx` - Phase 2B store application screen.
- `app/(store-owner)/status.tsx` - Phase 2C review/rejected/restricted/suspended status screen.
- `app/(store-owner)/setup.tsx` - Phase 2C setup checklist and subscription/trial status screen.

Still missing product surfaces:

- `marketplace`
- `seller`
- `inventory`
- bookstore orders
- platform admin review

This matters for marketplace Phase 3: manual inventory should extend the Store Owner product surface without reusing P2P exchange routes or tables. Platform review remains an Edge Function/API concern; there is no platform admin UI yet.

## Dev Bypass

`EXPO_PUBLIC_DEV_SKIP_AUTH=true` allows UI-only dev bypasses in root routing and Supabase env handling. Do not use this to validate authorization, RLS, Store Owner access, or platform review behavior.

## Historical Docs Caveat

`docs/architecture/architecture_react_expo.md` is useful for architecture context, but its embedded database/migration inventory is historical. For current marketplace status, prefer `docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md` and live Supabase checks.
