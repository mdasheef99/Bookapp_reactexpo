import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LibraryBookEntry } from '../utils/libraryShelf';
import { createShelfDraft, moveHorizontalShelfDraft, moveShelfDraft, parseShelfOrder, reconcileShelfArrangement, ShelfDraft, undoShelfDraft } from '../utils/shelfOrder';
import { ShelfRow } from '../utils/shelfLayout';

export const shelfOrderStorageKey = (userId: string) => `library_shelfOrder:v2:${userId}`;
export const legacyShelfOrderStorageKey = (userId: string) => `library_shelfOrder:v1:${userId}`;
type ArrangementState = {
    owner: string | undefined; ready: boolean; saved: ReturnType<typeof parseShelfOrder>;
    draft: ShelfDraft | null; membership: string; saving: boolean; message: string | null; readError: boolean;
};
const emptyState = (owner?: string): ArrangementState => ({ owner, ready: false, saved: null, draft: null, membership: '', saving: false, message: null, readError: false });

/** Shared state/storage only. Each shelf style implements its own gestures. */
export function useShelfArrangement(userId: string | undefined, books: LibraryBookEntry[]) {
    const [state, setState] = useState<ArrangementState>(() => emptyState(userId));
    const [readAttempt, setReadAttempt] = useState(0);
    const requestVersion = useRef(0);
    const currentOwner = useRef(userId);
    currentOwner.current = userId;
    const ids = useMemo(() => books.map((book) => book.id), [books]);
    const membership = JSON.stringify([...new Set(ids)].sort());
    const currentMembership = useRef(membership);
    currentMembership.current = membership;
    const viewState = state.owner === userId ? state : emptyState(userId);
    const stateRef = useRef(viewState);
    stateRef.current = viewState;
    const accepted = useMemo(() => reconcileShelfArrangement(viewState.saved, ids), [viewState.saved, ids]);
    const order = viewState.draft?.order ?? accepted.order;
    const tierIds = viewState.draft?.tierIds ?? accepted.tierIds;
    const orderedBooks = useMemo(() => {
        const byId = new Map(books.map((book) => [book.id, book]));
        return order.flatMap((id) => { const book = byId.get(id); return book ? [book] : []; });
    }, [books, order]);

    useEffect(() => {
        const version = ++requestVersion.current;
        setState(emptyState(userId));
        if (!userId) return;
        void (async () => {
            const current = await AsyncStorage.getItem(shelfOrderStorageKey(userId));
            return current ?? await AsyncStorage.getItem(legacyShelfOrderStorageKey(userId));
        })().then((raw) => {
            const saved = parseShelfOrder(raw);
            if (version === requestVersion.current && currentOwner.current === userId) {
                setState({ ...emptyState(userId), ready: true, saved });
            }
        }).catch(() => {
            if (version === requestVersion.current && currentOwner.current === userId) {
                setState({ ...emptyState(userId), readError: true, message: 'Could not load your saved arrangement. Try again before arranging.' });
            }
        });
        return () => { ++requestVersion.current; };
    }, [userId, readAttempt]);

    useEffect(() => {
        setState((current) => current.owner === userId && current.draft && current.membership !== membership
            ? { ...current, draft: null, message: 'Your library changed. Start arranging again to include the latest books.' } : current);
    }, [membership, userId]);

    const enter = useCallback(() => {
        setState((current) => current.owner === userId && current.ready && !current.saving
            ? { ...current, draft: createShelfDraft(reconcileShelfArrangement(current.saved, ids)), membership, message: null } : current);
    }, [userId, ids, membership]);
    const move = useCallback((id: string, beforeId: string | null) => {
        setState((current) => {
            if (!current.draft || current.saving) return current;
            const draft = moveShelfDraft(current.draft, id, beforeId);
            return draft === current.draft ? current : { ...current, draft, message: null };
        });
    }, []);
    const moveHorizontal = useCallback((id: string, row: ShelfRow, beforeId: string | null) => {
        setState((current) => {
            if (!current.draft || current.saving) return current;
            const draft = moveHorizontalShelfDraft(current.draft, id, row, beforeId);
            return draft === current.draft ? current : { ...current, draft, message: null };
        });
    }, []);
    const undo = useCallback(() => setState((current) => current.draft && !current.saving
        ? { ...current, draft: undoShelfDraft(current.draft), message: null } : current), []);
    const cancel = useCallback(() => setState((current) => current.draft && !current.saving
        ? { ...current, draft: null, message: null } : current), []);

    const save = useCallback(async () => {
        const snapshot = stateRef.current;
        if (!userId || !snapshot.draft || snapshot.saving || snapshot.owner !== userId
            || snapshot.membership !== currentMembership.current) return;
        const version = requestVersion.current;
        const saved = { order: [...snapshot.draft.order], tierIds: {
            top: [...snapshot.draft.tierIds.top], bottom: [...snapshot.draft.tierIds.bottom],
        } };
        // Protect against a second call before React has committed the saving state.
        stateRef.current = { ...snapshot, saving: true };
        setState((current) => ({ ...current, saving: true, message: null }));
        try {
            await AsyncStorage.setItem(shelfOrderStorageKey(userId), JSON.stringify({
                version: 2, ids: saved.order, tiers: saved.tierIds,
            }));
            if (version === requestVersion.current && currentOwner.current === userId) {
                setState((current) => ({ ...current, saved: { order: saved.order, tierIds: saved.tierIds }, draft: null, saving: false,
                    message: 'Arrangement saved on this device.' }));
            }
        } catch {
            if (version === requestVersion.current && currentOwner.current === userId) {
                setState((current) => ({ ...current, saving: false, message: current.draft
                    ? 'Could not save. Your moves are still here; try Save again.'
                    : 'Could not save. Your library changed; start arranging again to include the latest books.' }));
            }
        }
    }, [userId]);

    return {
        orderedBooks, order, tierIds, ready: viewState.ready, active: !!viewState.draft, saving: viewState.saving,
        canUndo: !!viewState.draft?.previous, message: viewState.message, readError: viewState.readError,
        enter, move, moveHorizontal, undo, cancel, save, retryRead: () => setReadAttempt((attempt) => attempt + 1),
    };
}

export type ShelfArrangement = ReturnType<typeof useShelfArrangement>;
