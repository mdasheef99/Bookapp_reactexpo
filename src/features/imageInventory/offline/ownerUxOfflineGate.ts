import { useCallback, useEffect, useRef, useState } from 'react';

const inFlightRefreshes = new Map<string, Promise<boolean>>();

export function coalesceOwnerUxRefresh(
    scope: string,
    task: () => Promise<boolean>,
): Promise<boolean> {
    const existing = inFlightRefreshes.get(scope);
    if (existing) return existing;
    const pending = task().finally(() => {
        if (inFlightRefreshes.get(scope) === pending) inFlightRefreshes.delete(scope);
    });
    inFlightRefreshes.set(scope, pending);
    return pending;
}

export function resetOwnerUxRefreshCoalescerForTests() {
    inFlightRefreshes.clear();
}

export function useOwnerUxOfflineGate({
    scope,
    isOffline,
    refresh,
    hasAuthoritativeData,
}: {
    scope: string;
    isOffline: boolean;
    refresh: () => Promise<boolean>;
    hasAuthoritativeData: boolean;
}) {
    const [refreshRequired, setRefreshRequired] = useState(isOffline);
    const activeScope = useRef(scope);
    const wasOffline = useRef(isOffline);
    const initialized = useRef(false);

    useEffect(() => () => { activeScope.current = ''; }, []);

    useEffect(() => {
        activeScope.current = scope;
        if (!initialized.current) {
            initialized.current = true;
            setRefreshRequired(isOffline || !hasAuthoritativeData);
            return;
        }
        setRefreshRequired(true);
        if (!isOffline) {
            void coalesceOwnerUxRefresh(scope, refresh).then((valid) => {
                if (activeScope.current === scope && valid) setRefreshRequired(false);
            });
        }
    }, [scope]);

    useEffect(() => {
        if (!isOffline && hasAuthoritativeData && !wasOffline.current) {
            setRefreshRequired(false);
        }
    }, [hasAuthoritativeData, isOffline]);

    useEffect(() => {
        if (isOffline) setRefreshRequired(true);
        if (wasOffline.current && !isOffline) {
            setRefreshRequired(true);
            void coalesceOwnerUxRefresh(scope, refresh).then((valid) => {
                if (activeScope.current === scope && valid) setRefreshRequired(false);
            });
        }
        wasOffline.current = isOffline;
    }, [isOffline, refresh, scope]);

    return {
        canMutate: !isOffline && !refreshRequired && hasAuthoritativeData,
        isOffline,
        isRefreshingAuthority: !isOffline && refreshRequired,
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
    });
}
