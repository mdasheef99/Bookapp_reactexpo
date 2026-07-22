# 02 - Auth And Session Map

## Ownership

- `src/features/auth/store/authStore.ts` owns the canonical Supabase `session`, explicit auth status, and sanitized initialization error. User data is derived from `session?.user`.
- `src/application/auth/AuthBootstrapOwner.tsx` is mounted once under the root QueryClient provider.
- `src/application/auth/authBootstrap.ts` owns the one Supabase auth subscription and guarded startup restoration.
- `src/application/auth/sessionCoordinator.ts` owns cross-feature identity-transition ordering and privacy cleanup.
- `src/application/auth/logout.ts` is the authoritative current-device logout path.
- `src/features/auth/hooks/useAuth.ts` is the compatibility facade: `{ session, user, isLoading, initialize, signOut }`.
- `src/features/auth/config/authBypassPolicy.js` is the shared pure bypass policy used by runtime and build validation.
- `src/features/auth/services/authStorage.ts` owns the narrowly scoped Supabase SDK logout fallback key.

Auth code under `src/features/auth` does not import marketplace. The application coordinator depends on both auth state and the marketplace commerce cleanup boundary.

## Startup And Auth Events

The selected initialization strategy is a guarded `getSession()` plus an auth subscription and version protection:

1. The root bootstrap attaches `onAuthStateChange` before calling `getSession()`.
2. Duplicate initialization calls share one promise.
3. `getSession()` has a bounded five-second timeout and handles returned and thrown errors.
4. An auth event or bootstrap unmount invalidates an older restoration result.
5. Successful `null` restoration becomes `unauthenticated`; failure becomes `initialization-error`.
6. The root router waits during `initializing` and shows an intentional retry state for `initialization-error`.

The callback records the event and schedules transition work without awaiting cleanup or invoking another Supabase auth method.

## Identity Transitions And Cleanup

Same-user `TOKEN_REFRESHED` and `USER_UPDATED` events update the canonical session without clearing user state. Cleanup runs only for:

- authenticated user to no user;
- User A directly to User B.

Identity replacement immediately hides the prior session. The next authenticated identity is not exposed until the serialized cleanup barrier completes. Cleanup includes:

- QueryClient query cancellation and query clearing;
- QueryClient mutation-cache clearing;
- commerce replacement, clarification draft, and deep-link state reset.

Each commerce cleanup step is attempted even if another step fails. Failures are reported with sanitized metadata.

## Logout

Both Profile and Settings use `useAuth().signOut`, which delegates to one application logout controller.

- Scope is current device: `supabase.auth.signOut({ scope: 'local' })`.
- Local application cleanup completes even when the remote call fails.
- Supabase JS 2.89.0 performs a network request for local scope and can return before removing storage on non-401/403/404 errors.
- On a returned or thrown SDK error, the fallback removes only the derived `sb-<project-ref>-auth-token` key from the configured MMKV adapter.
- If targeted storage removal also fails, privacy cleanup completes and logout rejects with a sanitized error rather than reporting success.
- A failed-logout identity is blocked from being restored by later refresh/update events; a new explicit `SIGNED_IN` event may authenticate it again.
- Supabase-driven `SIGNED_OUT` performs cleanup but never recursively invokes remote sign-out.

Secure persistence is not implemented: the existing unencrypted MMKV auth adapter remains and requires a separately authorized migration.

## Development Bypass

Runtime bypass requires all three conditions:

- `__DEV__ === true`;
- `EXPO_PUBLIC_APP_ENV === 'development'`;
- `EXPO_PUBLIC_DEV_SKIP_AUTH === 'true'`.

Preview, production, non-development runtime, and malformed/unknown environments reject opt-in. Missing Supabase configuration is accepted only for that intentional development bypass. `npm run validate:auth-config` enforces preview/production policy without printing values. Static E2E exports no longer force bypass.

## Routing

- no session outside `(auth)` -> `/(auth)/login`;
- session inside `(auth)`, except setup profile -> `/(tabs)/library`;
- `setup-profile` remains reachable after OTP authentication;
- initialization failure stays distinct from a confirmed guest and offers retry.

Authoritative restored-session/profile-completion routing is deferred. Store Owner login intent persistence also remains future work.

## Testing Anchors

- `src/features/auth/config/__tests__/authBypassPolicy.test.ts`
- `src/application/auth/__tests__/authBootstrap.test.ts`
- `src/application/auth/__tests__/sessionCoordinator.test.ts`
- `src/application/auth/__tests__/logout.test.ts`
- `src/features/auth/store/__tests__/authStore.test.ts`
- `src/features/auth/services/__tests__/authStorage.test.ts`
- `src/features/auth/hooks/__tests__/useAuth.test.ts`
- `app/__tests__/_layout.test.tsx`
- `src/features/marketplace/commerce/__tests__/commerceSession.test.ts`

## Deferred Risks And Verification

- SecureStore or encrypted-MMKV persistence migration.
- Android backup policy.
- Authoritative profile-completion routing.
- OTP error normalization and resend behavior.
- Native device offline/logout/account-switching verification.
- Remote EAS environment verification.
- The custom no-op Supabase auth lock remains unchanged pending a focused failing test.

Web export validates bundling and web initialization only; it is not native-device evidence.
