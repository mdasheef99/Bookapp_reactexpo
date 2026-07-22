import { useEffect } from 'react';
import { isAuthBypassEnabled } from '@/features/auth/config/authRuntimeConfig';
import { setAuthState } from '@/features/auth/store/authStore';
import { startAuthBootstrap, stopAuthBootstrap } from './authBootstrap';

export function AuthBootstrapOwner() {
  useEffect(() => {
    if (isAuthBypassEnabled) {
      setAuthState({ session: null, status: 'unauthenticated', initializationError: null });
      return undefined;
    }

    void startAuthBootstrap();
    return stopAuthBootstrap;
  }, []);

  return null;
}
