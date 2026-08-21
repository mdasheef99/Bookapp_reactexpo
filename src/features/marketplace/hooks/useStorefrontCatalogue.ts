import { useCallback, useEffect, useRef, useState } from 'react';
import type {
    StorefrontProfile,
    StorefrontTitleGroup,
} from '../types';
import { consumerDiscoveryService } from '../services/consumerDiscoveryService';

const PAGE_SIZE = 12;

function titleGroupKey(group: StorefrontTitleGroup): string {
    return group.offers.map((offer) => offer.listingId).sort().join('|');
}

export function useStorefrontCatalogue(storeId: string, initialMatchContext: string | null = null) {
    const [profile, setProfile] = useState<StorefrontProfile | null>(null);
    const [titleCount, setTitleCount] = useState(0);
    const [highlightedTitleGroup, setHighlightedTitleGroup] =
        useState<StorefrontTitleGroup | null>(null);
    const [titleGroups, setTitleGroups] = useState<StorefrontTitleGroup[]>([]);
    const [matchContextState, setMatchContextState] =
        useState<'none' | 'active' | 'unavailable'>('none');
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeMatchContext, setActiveMatchContext] = useState<string | null>(initialMatchContext);
    const generationRef = useRef(0);
    const loadingMoreRef = useRef(false);
    const contextRef = useRef<string | null>(initialMatchContext);
    const cursorRef = useRef<string | null>(null);

    const beginTraversal = useCallback(async (matchContext: string | null) => {
        const generation = generationRef.current + 1;
        generationRef.current = generation;
        contextRef.current = matchContext;
        cursorRef.current = null;
        loadingMoreRef.current = false;
        setIsLoading(true);
        setIsLoadingMore(false);
        setError(null);
        try {
            const page = await consumerDiscoveryService.getStorefrontCatalogue({
                storeId, pageSize: PAGE_SIZE, cursor: null, matchContext,
            });
            if (generation !== generationRef.current) return;
            setProfile(page.storeProfile);
            setTitleCount(page.titleCount);
            setHighlightedTitleGroup(page.highlightedTitleGroup);
            setTitleGroups(page.titleGroups);
            setMatchContextState(page.matchContextState);
            if (page.matchContextState === 'unavailable') {
                contextRef.current = null;
                setActiveMatchContext(null);
            }
            setNextCursor(page.pageInfo.nextCursor);
            cursorRef.current = page.pageInfo.nextCursor;
        } catch (caught) {
            if (generation !== generationRef.current) return;
            setError(caught instanceof Error ? caught.message : 'Failed to load bookstore.');
            setProfile(null);
            setTitleGroups([]);
            setHighlightedTitleGroup(null);
            setNextCursor(null);
            cursorRef.current = null;
        } finally {
            if (generation === generationRef.current) setIsLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        setProfile(null);
        setTitleCount(0);
        setHighlightedTitleGroup(null);
        setTitleGroups([]);
        setMatchContextState('none');
        setNextCursor(null);
        setActiveMatchContext(initialMatchContext);
        contextRef.current = initialMatchContext;
        void beginTraversal(initialMatchContext);
        return () => { generationRef.current += 1; };
    }, [beginTraversal, initialMatchContext]);

    const loadMore = useCallback(async () => {
        const cursor = cursorRef.current;
        if (!cursor || loadingMoreRef.current) return;
        const generation = generationRef.current;
        loadingMoreRef.current = true;
        setIsLoadingMore(true);
        setError(null);
        try {
            const page = await consumerDiscoveryService.getStorefrontCatalogue({
                storeId, pageSize: PAGE_SIZE, cursor, matchContext: contextRef.current,
            });
            if (generation !== generationRef.current) return;
            setTitleGroups((current) => {
                const seen = new Set(current.map(titleGroupKey));
                return [...current, ...page.titleGroups.filter((group) => !seen.has(titleGroupKey(group)))];
            });
            setTitleCount(page.titleCount);
            setNextCursor(page.pageInfo.nextCursor);
            cursorRef.current = page.pageInfo.nextCursor;
        } catch (caught) {
            if (generation === generationRef.current) {
                setError(caught instanceof Error ? caught.message : 'Failed to load more books.');
            }
        } finally {
            if (generation === generationRef.current) {
                loadingMoreRef.current = false;
                setIsLoadingMore(false);
            }
        }
    }, [storeId]);

    const clearSearch = useCallback(async () => {
        setActiveMatchContext(null);
        contextRef.current = null;
        await beginTraversal(null);
    }, [beginTraversal]);

    const refresh = useCallback(
        () => beginTraversal(activeMatchContext),
        [activeMatchContext, beginTraversal],
    );

    return {
        profile, titleCount, highlightedTitleGroup, titleGroups, matchContextState,
        nextCursor, isLoading, isLoadingMore, error,
        hasSearchContext: activeMatchContext !== null || matchContextState === 'unavailable',
        clearSearch, loadMore, refresh, retry: refresh,
    };
}
