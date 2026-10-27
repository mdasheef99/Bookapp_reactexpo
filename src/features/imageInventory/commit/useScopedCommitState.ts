import { useCallback, useMemo, useRef, useState, type SetStateAction } from 'react';

// Owner/session scope is checked during render, before cleanup effects run.
export function useScopedCommitState<T>(scope: string, initial: () => T) {
    const empty = useMemo(initial, [scope]);
    const active = useRef(scope);
    active.current = scope;
    const [state, setState] = useState(() => ({ scope, value: empty }));
    const setValue = useCallback((next: SetStateAction<T>) => setState(current => active.current !== scope ? current : ({ scope,
        value: typeof next === 'function' ? (next as (value: T) => T)(current.scope === scope ? current.value : empty) : next,
    })), [scope, empty]);
    return [state.scope === scope ? state.value : empty, setValue] as const;
}
