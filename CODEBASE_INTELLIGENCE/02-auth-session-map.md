# 02 - Auth And Session Map

## Primary Files

- `src/features/auth/hooks/useAuth.ts` - global session/user state, auth subscription, initialization timeout, sign-out.
- `src/features/auth/services/authService.ts` - phone OTP sign-in, OTP verification, sign-out, get session.
- `app/(auth)/login.tsx` - OTP request screen.
- `app/(auth)/verify-otp.tsx` - OTP verification and post-auth navigation.
- `app/(auth)/setup-profile.tsx` - profile creation flow.
- `app/_layout.tsx` - global auth route guard.
- `app/index.tsx` - initial redirect.
- `src/lib/supabase.ts` - Supabase client auth persistence settings.
- `src/lib/mmkv.ts` - MMKV adapter used by Supabase auth.

## Session Model

`useAuth` is a simple module-level store, not Zustand:

- module variables hold `globalSession`, `globalUser`, and `globalIsLoading`
- listeners update React components
- `supabase.auth.onAuthStateChange` updates state
- `initialize()` races `supabase.auth.getSession()` against a 5 second timeout
- auth failures stop loading so the app can show login rather than hang

## Supabase Auth

`authService` wraps:

- `supabase.auth.signInWithOtp({ phone: '+91...' })`
- `supabase.auth.verifyOtp({ phone: '+91...', token, type: 'sms' })`
- `supabase.auth.signOut()`
- `supabase.auth.getSession()`

The current OTP flow is India phone-number centered and prefixes `+91`.

## Redirect Behavior

Current root behavior:

- no session outside `(auth)` -> `/(auth)/login`
- session inside `(auth)` except setup profile -> `/(tabs)/library`
- root index with session -> `/(tabs)/library`
- root index without session -> `/(auth)/login`

Marketplace implication: Store Owner login intent will need explicit persistence/redirect handling. Otherwise, after auth, the root guard can discard the intent and send the user to the consumer library.

## Store Owner Entry Implication

Phase 2 needs two entry points:

- unauthenticated/new users from Login or first-run auth
- signed-in users from Profile

Both must route through a Store Owner gate/state machine. Entry must not imply approval or selling rights.

## Testing Anchors

- `src/features/auth/services/__tests__/authService.test.ts`
- `app/(auth)/__tests__/verify-otp.test.tsx`
- `src/lib/__mocks__/supabase.ts`
- `jest.setup.ts`

## Risks

- `EXPO_PUBLIC_DEV_SKIP_AUTH=true` is useful for UI rendering but invalid for authorization verification.
- Auth/session code is global module state, so tests may need reset helpers such as `__resetAuthForTests()`.
- Store Owner onboarding should not use `user_profiles.account_type` as the authorization source. Use marketplace/store administrator state.
