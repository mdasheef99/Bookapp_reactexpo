import { useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { captureAppException } from '@/lib/sentry';

// Simple React hooks-based auth state (replacing zustand)
let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalIsLoading = true;
let listeners: Array<() => void> = [];

function notifyListeners() {
    listeners.forEach(listener => listener());
}

export function useAuth() {
    const [session, setSession] = useState<Session | null>(globalSession);
    const [user, setUser] = useState<User | null>(globalUser);
    const [isLoading, setIsLoading] = useState(globalIsLoading);

    useEffect(() => {
        const listener = () => {
            setSession(globalSession);
            setUser(globalUser);
            setIsLoading(globalIsLoading);
        };

        listeners.push(listener);
        return () => {
            listeners = listeners.filter(l => l !== listener);
        };
    }, []);

    const initialize = async () => {
        try {
            // Create a promise that rejects after 5 seconds to prevent hanging
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Auth initialization timed out')), 5000)
            );

            // Race the session retrieval against the timeout
            const { data: { session } } = await Promise.race([
                supabase.auth.getSession(),
                timeoutPromise
            ]) as any;

            globalSession = session;
            globalUser = session?.user ?? null;
            globalIsLoading = false;
            notifyListeners();

            supabase.auth.onAuthStateChange((_event, session) => {
                globalSession = session;
                globalUser = session?.user ?? null;
                globalIsLoading = false;
                notifyListeners();
            });
        } catch (error) {
            console.warn('Auth initialization error or timeout:', error);
            captureAppException(error, {
                area: 'auth',
                action: 'initialize_session_failed',
                tags: {
                    feature: 'auth',
                    hook: 'useAuth',
                },
                extra: {
                    timeout_ms: 5000,
                },
            });
            // Even on error, we must stop loading to show the app (likely Login screen)
            globalIsLoading = false;
            notifyListeners();
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        globalSession = null;
        globalUser = null;
        notifyListeners();
    };

    return {
        session,
        user,
        isLoading,
        initialize,
        signOut,
    };
}
