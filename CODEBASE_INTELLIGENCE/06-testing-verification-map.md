# 06 - Testing And Verification Map

## Test Stack

- Jest with `jest-expo`
- React Native Testing Library
- TypeScript
- Playwright for web E2E/smoke tests

Config files:

- `package.json`
- `jest.setup.ts`
- `playwright.config.ts`
- `_serve.js`
- `scripts/e2e-build-web.js`

## Commands

Common commands:

```powershell
npm.cmd test -- --runInBand
npx.cmd tsc --noEmit
npm.cmd run test:e2e:web
npm.cmd run export:web
```

Focused examples from existing docs:

```powershell
npm.cmd test -- --runInBand src/features/clubs/services/__tests__/clubsService.test.ts src/features/clubs/hooks/__tests__/useClubs.test.ts src/features/clubs/screens/__tests__/ClubManageScreen.test.tsx
npm.cmd test -- --runInBand --runTestsByPath "app/(tabs)/profile/__tests__/profile.test.tsx"
npm.cmd test -- --runInBand src/features/exchange/services/__tests__/listingsService.test.ts
```

Use focused test runs during feature work. Full suites may be slower or include unrelated failures.

## Jest Setup

`jest.setup.ts`:

- extends React Native Testing Library matchers
- mocks `react-native-url-polyfill/auto`
- mocks `react-native-reanimated`
- sets test env vars for Supabase and dev auth bypass
- mocks Sentry

## Supabase Mock

`src/lib/__mocks__/supabase.ts` is the central mock for imports from `@/lib/supabase`.

It includes:

- auth methods
- query builder chains
- `rpc`
- `functions.invoke`
- realtime channel mocks

Add missing mock methods here when new service tests require them.

## Store Owner / Marketplace Tests

Phase 2 tests:

- `src/features/stores/services/__tests__/storeOwnerService.test.ts`
- `src/features/stores/hooks/__tests__/useStoreOwnerGate.test.tsx`
- `src/features/stores/screens/__tests__/StoreOwnerGateScreen.test.tsx`
- `src/features/stores/screens/__tests__/StoreOnboardingScreen.test.tsx`
- `src/features/stores/screens/__tests__/StoreSetupChecklistScreen.test.tsx`
- `app/(store-owner)/__tests__/index.test.tsx`
- `supabase/functions/__tests__/store_application_function.test.ts`
- `supabase/functions/__tests__/store_review_function.test.ts`
- `supabase/migrations/__tests__/marketplacePhase2OnboardingHardening.test.ts`
- `supabase/migrations/__tests__/marketplacePhase2CReviewMetadata.test.ts`

Phase 3 tests started:

- `supabase/migrations/__tests__/marketplacePhase3InventoryCanonicalListings.test.ts`
- `src/features/stores/services/__tests__/storeInventoryService.test.ts`
- `src/features/stores/screens/__tests__/StoreInventoryScreen.test.tsx`
- `app/(store-owner)/__tests__/inventory.test.tsx`

Phase 4 tests:

- `src/features/stores/services/__tests__/storeDashboardService.test.ts`
- `src/features/stores/services/__tests__/storeProfileService.test.ts`
- `src/features/stores/services/__tests__/storeSubscriptionService.test.ts`
- `src/features/stores/screens/__tests__/StoreDashboardScreen.test.tsx`
- `src/features/stores/screens/__tests__/StoreProfileScreen.test.tsx`
- `src/features/stores/screens/__tests__/SubscriptionStatusScreen.test.tsx`
- `src/features/stores/screens/__tests__/StoreInventoryScreen.test.tsx`
- `app/(store-owner)/__tests__/_layout.test.tsx`
- `app/(store-owner)/__tests__/dashboard.test.tsx`
- `app/(store-owner)/__tests__/storefront.test.tsx`
- `app/(store-owner)/__tests__/subscription.test.tsx`

Useful focused commands:

```powershell
npm.cmd test -- --runInBand src/features/stores supabase/functions/__tests__/store_application_function.test.ts supabase/functions/__tests__/store_review_function.test.ts
npm.cmd test -- --runInBand --runTestsByPath "C:\Users\user\Documents\augment-projects\Bookconnect_expo\app\(auth)\__tests__\login.test.tsx" "C:\Users\user\Documents\augment-projects\Bookconnect_expo\app\(tabs)\profile\__tests__\profile.test.tsx"
npm.cmd test -- --runInBand supabase/migrations/__tests__/marketplacePhase3InventoryCanonicalListings.test.ts src/features/stores/services/__tests__/storeInventoryService.test.ts
npm.cmd test -- --runInBand "src/features/stores"
npm.cmd test -- --runInBand --runTestsByPath "app/(store-owner)/__tests__/_layout.test.tsx" "app/(store-owner)/__tests__/dashboard.test.tsx" "app/(store-owner)/__tests__/index.test.tsx" "app/(store-owner)/__tests__/inventory.test.tsx" "app/(store-owner)/__tests__/storefront.test.tsx" "app/(store-owner)/__tests__/subscription.test.tsx"
```

When Expo route groups contain parentheses, regex path matching can fail on Windows. Use `--runTestsByPath` with absolute paths for route tests.

## Representative Test Locations

Auth:

- `src/features/auth/services/__tests__/authService.test.ts`
- `app/(auth)/__tests__/verify-otp.test.tsx`

Root/navigation:

- `app/__tests__/_layout.test.tsx`
- `app/(tabs)/__tests__/_layout.test.tsx`
- `src/lib/__tests__/navigation.test.ts`

Profile:

- `app/(tabs)/profile/__tests__/profile.test.tsx`
- `app/(tabs)/profile/__tests__/settings.test.tsx`
- `app/(tabs)/profile/__tests__/addresses.test.tsx`
- `app/(tabs)/profile/__tests__/notifications.test.tsx`

Exchange:

- `src/features/exchange/services/__tests__/listingsService.test.ts`
- `src/features/exchange/services/__tests__/transactionsService.test.ts`
- `src/features/exchange/hooks/__tests__/useTransactions.test.tsx`
- `src/features/exchange/utils/__tests__/transactionActionResolver.test.ts`
- route tests under `app/(tabs)/exchange/__tests__/`

Clubs:

- `src/features/clubs/services/__tests__/clubsService.test.ts`
- `src/features/clubs/screens/__tests__/`
- `src/features/clubs/screens/manage/__tests__/`
- route tests under `app/(tabs)/clubs/__tests__/`

Notifications:

- `src/features/notifications/services/__tests__/notificationsService.test.ts`
- `src/features/notifications/hooks/__tests__/useNotifications.test.tsx`
- `supabase/functions/__tests__/wishlist_notify_function.test.ts`

Venues:

- `src/features/venues/services/__tests__/venuesService.test.ts`
- `src/features/venues/screens/__tests__/`

Migrations:

- `supabase/migrations/__tests__/`

## Verification Discipline

- Run the narrowest relevant tests first.
- Run `npx.cmd tsc --noEmit` before claiming TypeScript correctness.
- For database/RLS/security changes, supplement local tests with Supabase MCP live inspection or migration-specific tests.
- Do not treat dev auth bypass as authorization verification.
- When path matching is awkward for Expo route tests, use `--runTestsByPath`.
- For Supabase Edge Functions that use service-role keys, add static tests for auth source, platform/store role checks, no request-body actor trust, audit/event writes, and forbidden client authority sources.
