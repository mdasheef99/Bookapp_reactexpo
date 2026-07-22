import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

export type AuthStatus =
  | 'initializing'
  | 'authenticated'
  | 'unauthenticated'
  | 'initialization-error'
  | 'logout-error'
  | 'session-cleanup-error';

export interface SanitizedAuthError {
  message: string;
}

export interface AuthState {
  session: Session | null;
  status: AuthStatus;
  initializationError: SanitizedAuthError | null;
}

const initialAuthState: AuthState = {
  session: null,
  status: 'initializing',
  initializationError: null,
};

export const useAuthStore = create<AuthState>(() => initialAuthState);

export function setAuthState(state: AuthState) {
  useAuthStore.setState(state);
}

export function resetAuthStoreForTests() {
  useAuthStore.setState(initialAuthState, true);
}

export const authSelectors = {
  session: (state: AuthState): Session | null => state.session,
  user: (state: AuthState): User | null => state.session?.user ?? null,
  userId: (state: AuthState): string | null => state.session?.user.id ?? null,
  status: (state: AuthState): AuthStatus => state.status,
  isAuthenticated: (state: AuthState): boolean => state.status === 'authenticated',
};

export const useAuthStatus = () => useAuthStore(authSelectors.status);
export const useAuthInitializationError = () => useAuthStore((state) => state.initializationError);
