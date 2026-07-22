import {
  authSelectors,
  resetAuthStoreForTests,
  setAuthState,
  useAuthStore,
} from '../authStore';

const session = {
  access_token: 'test-token',
  user: { id: 'user-1' },
} as never;

describe('authStore', () => {
  beforeEach(resetAuthStoreForTests);

  it('keeps session canonical and derives user selectors', () => {
    setAuthState({ session, status: 'authenticated', initializationError: null });
    const state = useAuthStore.getState();

    expect(authSelectors.session(state)).toBe(session);
    expect(authSelectors.user(state)?.id).toBe('user-1');
    expect(authSelectors.userId(state)).toBe('user-1');
    expect(authSelectors.isAuthenticated(state)).toBe(true);
  });

  it('distinguishes initialization errors from unauthenticated state', () => {
    setAuthState({
      session: null,
      status: 'initialization-error',
      initializationError: { message: 'Unable to restore session' },
    });

    expect(useAuthStore.getState().status).toBe('initialization-error');
    expect(useAuthStore.getState().initializationError).toEqual({
      message: 'Unable to restore session',
    });
  });
});
