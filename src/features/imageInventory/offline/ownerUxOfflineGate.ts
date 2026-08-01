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
    const [authorizedScope, setAuthorizedScope] = useState<string | null>(
        !isOffline && hasAuthoritativeData && currentAuthorityVerified ? scope : null,
    );
    const authorizedScopeRef = useRef(authorizedScope);
    const setAuthority = useCallback((next: string | null) => {
        if (authorizedScopeRef.current === next) return;
        authorizedScopeRef.current = next;
        setAuthorizedScope(next);
    }, []);
    const activeScope = useRef(scope);

    useEffect(() => () => { activeScope.current = ''; }, []);

    useEffect(() => {
        activeScope.current = scope;
        if (!isOffline && hasAuthoritativeData && currentAuthorityVerified) {
            setAuthority(scope);
            return;
        }
        setAuthority(null);
        invalidateOwnerUxRefreshScope(scope);
        if (!isOffline) {
            void coalesceOwnerUxRefresh(scope, refresh).then((valid) => {
                if (activeScope.current === scope && valid) setAuthority(scope);
            });
        }
    }, [currentAuthorityVerified, hasAuthoritativeData, isOffline, refresh, scope, setAuthority]);

    return {
        canMutate: !isOffline && authorizedScope === scope && hasAuthoritativeData,
        isOffline,
        isRefreshingAuthority: !isOffline && authorizedScope !== scope,
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
