import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { RECENT_SEARCHES_KEY, MAX_RECENT_SEARCHES } from '@/lib/constants';

export const useRecentSearches = () => {
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    useEffect(() => {
        loadRecentSearches();
    }, []);

    const loadRecentSearches = async () => {
        try {
            const saved = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
            if (saved) {
                setRecentSearches(JSON.parse(saved));
            }
        } catch (err) {
            console.error('Failed to load recent searches:', err);
        }
    };

    const saveRecentSearch = useCallback(async (searchQuery: string) => {
        try {
            const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, MAX_RECENT_SEARCHES);
            setRecentSearches(updated);
            await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        } catch (err) {
            console.error('Failed to save recent search:', err);
        }
    }, [recentSearches]);

    const removeRecentSearch = useCallback(async (searchQuery: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const updated = recentSearches.filter(s => s !== searchQuery);
        setRecentSearches(updated);
        await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    }, [recentSearches]);

    const clearRecentSearches = useCallback(async () => {
        setRecentSearches([]);
        await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
    }, []);

    return {
        recentSearches,
        saveRecentSearch,
        removeRecentSearch,
        clearRecentSearches,
    };
};
