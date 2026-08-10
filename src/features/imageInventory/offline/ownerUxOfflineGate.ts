import { useCallback, useEffect, useRef, useState } from 'react';

type RefreshEntry = { generation: number; promise: Promise<boolean> };
const inFlightRefreshes = new Map<string, RefreshEntry>();
const refreshGenerations = new Map<string, number>();

export function coalesceOwnerUxRefresh(
    scope: string,
    task: () => Promise<boolean>,
): Promise<boolean> {
    const generation = refreshGenerations.get(scope) ?? 0;
    const existing = inFlightRefreshes.get(scope);
    if (existing?.generation === generation) return existing.promise;
    const pending = task().finally(() => {
        if (inFlightRefreshes.get(scope)?.promise === pending) inFlightRefreshes.delete(scope);
    });
    inFlightRefreshes.set(scope, { generation, promise: pending });
    return pending;
}

export function invalidateOwnerUxRefreshScope(scope: string): void {
    refreshGenerations.set(scope, (refreshGenerations.get(scope) ?? 0) + 1);
}

export function resetOwnerUxRefreshCoalescerForTests() {
    inFlightRefreshes.clear();
    refreshGenerations.clear();
}

export type OwnerUxAuthorityState =
    | 'OFFLINE_READ_ONLY'
    | 'REFRESH_REQUIRED'
    | 'REFRESHING'
    | 'AUTHORITATIVE'
    | 'ERROR_READ_ONLY'
    | 'INVALIDATED';

export function useOwnerUxOfflineGate({
    scope,
    isOffline,
    refresh,
    hasAuthoritativeData,
    currentAuthorityVerified = false,
}: {
    scope: string;
    isOffline: boolean;
    refresh: () => Promise<boolean>;
    hasAuthoritativeData: boolean;
    currentAuthorityVerified?: boolean;
}) {
    const initiallyAuthoritative = !isOffline && hasAuthoritativeData && currentAuthorityVerified;
    const [authorizedScope, setAuthorizedScope] = useState<string | null>(
        initiallyAuthoritative ? scope : null,
    );
    const [authorityState, setAuthorityStateValue] = useState<OwnerUxAuthorityState>(
        isOffline
            ? 'OFFLINE_READ_ONLY'
            : initiallyAuthoritative
                ? 'AUTHORITATIVE'
                : 'REFRESH_REQUIRED',
    );
    const authorizedScopeRef = useRef(authorizedScope);
    const authorityStateRef = useRef(authorityState);
    const setAuthority = useCallback((next: string | null) => {
        if (authorizedScopeRef.current === next) return;
        authorizedScopeRef.current = next;
        setAuthorizedScope(next);
    }, []);
    const setAuthorityState = useCallback((next: OwnerUxAuthorityState) => {
        if (authorityStateRef.current === next) return;
        authorityStateRef.current = next;
        setAuthorityStateValue(next);
    }, []);
    const activeScope = useRef(scope);
    const lastScope = useRef(scope);
    const lastOffline = useRef(isOffline);
    const lastHasAuthoritativeData = useRef(hasAuthoritativeData);
    const authorityGeneration = useRef(0);
    const refreshRequired = useRef(
        isOffline || (hasAuthoritativeData && !currentAuthorityVerified),
    );
    const attemptedGeneration = useRef<number | null>(null);

    useEffect(() => () => {
        activeScope.current = '';
        authorityGeneration.current += 1;
        invalidateOwnerUxRefreshScope(scope);
    }, []);

    useEffect(() => {
        const scopeChanged = lastScope.current !== scope;
        const reconnected = lastOffline.current && !isOffline;
        const wentOffline = !lastOffline.current && isOffline;
        const lostData = lastHasAuthoritativeData.current && !hasAuthoritativeData;
        const invalidated = scopeChanged || reconnected || wentOffline || lostData;
        const previousScope = lastScope.current;
        activeScope.current = scope;
        lastScope.current = scope;
        lastOffline.current = isOffline;
        lastHasAuthoritativeData.current = hasAuthoritativeData;

        if (invalidated) {
            authorityGeneration.current += 1;
            attemptedGeneration.current = null;
            refreshRequired.current = true;
            setAuthority(null);
            invalidateOwnerUxRefreshScope(previousScope);
            if (scopeChanged) invalidateOwnerUxRefreshScope(scope);
        }

        if (isOffline) {
            setAuthority(null);
            setAuthorityState('OFFLINE_READ_ONLY');
            return;
        }

        if (!hasAuthoritativeData) {
            setAuthority(null);
            setAuthorityState(invalidated ? 'INVALIDATED' : 'REFRESH_REQUIRED');
            return;
        }

        if (!refreshRequired.current && currentAuthorityVerified) {
            setAuthority(scope);
            setAuthorityState('AUTHORITATIVE');
            return;
        }

        refreshRequired.current = true;
        const generation = authorityGeneration.current;
        if (attemptedGeneration.current === generation) return;
        attemptedGeneration.current = generation;
        setAuthority(null);
        setAuthorityState('REFRESHING');
        void coalesceOwnerUxRefresh(scope, refresh).then((valid) => {
            if (
                activeScope.current !== scope
                || authorityGeneration.current !== generation
            ) return;
            if (!valid) {
                setAuthority(null);
                setAuthorityState('ERROR_READ_ONLY');
                return;
            }
            refreshRequired.current = false;
            setAuthority(scope);
            setAuthorityState('AUTHORITATIVE');
        }, () => {
            if (
                activeScope.current === scope
                && authorityGeneration.current === generation
            ) {
                setAuthority(null);
                setAuthorityState('ERROR_READ_ONLY');
            }
        });
    }, [
        currentAuthorityVerified,
        hasAuthoritativeData,
        isOffline,
        refresh,
        scope,
        setAuthority,
        setAuthorityState,
    ]);

    return {
        canMutate: !isOffline
            && authorityState === 'AUTHORITATIVE'
            && authorizedScope === scope
            && hasAuthoritativeData,
        isOffline,
        isRefreshingAuthority: authorityState === 'REFRESHING',
        authorityState,
    } as const;
}

export function useOwnerQueryMutationGate({
    scope,
    isOffline,
    query,
}: {
    scope: string;
    isOffline: boolean;
        query: {
        data?: unknown;
        error?: unknown;
        isFetchedAfterMount?: boolean;
        refetch: () => Promise<{ data?: unknown; isError: boolean; error: unknown }>;
    };
}) {
    const refresh = useCallback(async () => {
        const result = await query.refetch();
        return !result.isError && result.error === null && Boolean(result.data);
    }, [query.refetch]);
    return useOwnerUxOfflineGate({
        scope,
        isOffline,
        refresh,
        hasAuthoritativeData: Boolean(query.data && !query.error),
        currentAuthorityVerified: Boolean(query.isFetchedAfterMount),
    });
}
