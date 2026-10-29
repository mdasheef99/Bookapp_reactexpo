import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { STORE_VIEW_FILTERS, type StoreViewFilter } from '../contracts/storeViewContracts';

const PREFIX = 'storeView_lastFilter:v1:';
const PENDING_CLEANUP_KEY = `${PREFIX}pendingCleanup`;
const CLEANUP_TIMEOUT_MS = 3_000;
const queues = new Map<string, Promise<unknown>>();
const users = new Map<string, { revision: number; cleaning: boolean }>();
const pendingCleanup = new Set<string>();

function userState(userId: string) {
    let state = users.get(userId);
    if (!state) {
        state = { revision: 0, cleaning: false };
        users.set(userId, state);
    }
    return state;
}

function serialize<T>(key: string, work: () => Promise<T>): Promise<T> {
    const next = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(work);
    queues.set(key, next);
    const release = () => { if (queues.get(key) === next) queues.delete(key); };
    void next.then(release, release);
    return next;
}

/** Each mounted identity owns a session; cleanup permanently fences its old handles. */
export function createStoreViewFilterSession(identity: ImageInventoryIdentity) {
    const key = `${PREFIX}${identity.userId}:${identity.storeId}`;
    const state = userState(identity.userId);
    const revision = state.revision;
    const startedDuringCleanup = state.cleaning;
    const current = () => !startedDuringCleanup && !state.cleaning && revision === state.revision;
    return {
        async read(): Promise<StoreViewFilter> {
            if (!current()) return 'all';
            try {
                const value = await serialize(key, () => current() ? AsyncStorage.getItem(key) : Promise.resolve(null));
                return current() && (STORE_VIEW_FILTERS as readonly (string | null)[]).includes(value)
                    ? value as StoreViewFilter : 'all';
            } catch { return 'all'; }
        },
        async write(filter: StoreViewFilter): Promise<void> {
            if (!current()) return;
            try {
                await serialize(key, async () => {
                    if (!current()) return;
                    await AsyncStorage.setItem(key, filter);
                    // A storage write may finish after cleanup's deadline. Retract it
                    // inside this queue, before any new session can write the same key.
                    if (!current()) await AsyncStorage.removeItem(key);
                });
            } catch { /* A device preference must never block the screen. */ }
        },
    };
}

/** Rejects for the coordinator's existing telemetry helper; failed users retry next time. */
export async function clearStoreViewFilterPreferences(userId: string): Promise<void> {
    pendingCleanup.add(userId);
    const targets = new Set<string>();
    const fence = (target: string) => {
        if (targets.has(target)) return;
        targets.add(target);
        const state = userState(target);
        state.revision += 1;
        state.cleaning = true;
    };
    for (const target of pendingCleanup) fence(target);
    let active = true;
    let loaded = false;
    const persist = (remaining = [...pendingCleanup]) => serialize(PENDING_CLEANUP_KEY, async () => {
        if (active) await AsyncStorage.setItem(PENDING_CLEANUP_KEY, JSON.stringify(remaining));
    });
    const cleanup = async () => {
        try {
            const raw = await serialize(PENDING_CLEANUP_KEY, () => AsyncStorage.getItem(PENDING_CLEANUP_KEY));
            if (!active) return;
            let stored: unknown;
            try { stored = JSON.parse(raw ?? '[]'); } catch { stored = []; }
            if (Array.isArray(stored)) {
                for (const target of stored) {
                    if (typeof target !== 'string' || !target) continue;
                    pendingCleanup.add(target);
                    fence(target);
                }
            }
            loaded = true;
            // Record retries before waiting: a timeout or process exit must not lose them.
            await persist();
            if (!active) return;
            const prefixes = [...targets].map((target) => `${PREFIX}${target}:`);
            await Promise.allSettled([...queues].filter(([key]) => prefixes.some((prefix) => key.startsWith(prefix))).map(([, queued]) => queued));
            if (!active) return;
            const keys = (await AsyncStorage.getAllKeys()).filter((key) => prefixes.some((prefix) => key.startsWith(prefix)));
            if (!active) return;
            if (keys.length) await AsyncStorage.multiRemove(keys);
            if (!active) return;
            await persist([...pendingCleanup].filter((target) => !targets.has(target)));
            if (!active) return;
            for (const target of targets) pendingCleanup.delete(target);
        } catch (error) {
            if (active && loaded) await persist();
            throw error;
        }
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Store View filter cleanup timed out')), CLEANUP_TIMEOUT_MS);
    });
    try {
        await Promise.race([cleanup(), timeout]);
    } finally {
        active = false;
        clearTimeout(timer);
        for (const target of targets) userState(target).cleaning = false;
    }
}
