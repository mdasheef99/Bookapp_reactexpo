import { authSelectors, resetAuthStoreForTests, useAuthStore } from '@/features/auth/store/authStore';
import { initializeAuth, resetAuthBootstrapForTests } from '@/application/auth/authBootstrap';
import { logoutCurrentDevice, resetLogoutForTests } from '@/application/auth/logout';
import { resetSessionCoordinatorForTests } from '@/application/auth/sessionCoordinator';

export function __resetAuthForTests() {
  resetAuthStoreForTests();
  resetAuthBootstrapForTests();
  resetSessionCoordinatorForTests();
  resetLogoutForTests();
}

export function useAuth() {
  const session = useAuthStore(authSelectors.session);
  const user = useAuthStore(authSelectors.user);
  const status = useAuthStore(authSelectors.status);

  return {
    session,
    user,
    isLoading: status === 'initializing',
    initialize: initializeAuth,
    signOut: logoutCurrentDevice,
  };
}
