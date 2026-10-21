import { View, Text, Pressable, Modal, Platform, ScrollView, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { ChoiceRadioGroup } from '@/components/library/bookDetails/ChoiceRadioGroup';
import { DIALOG_MAX_WIDTH, ICON_SIZE } from '@/components/library/bookDetails/bookDetailsTokens';
import { BookButton } from '@/components/library/ui';
import { SearchFilters } from '@/features/books/services/booksService';

const GENRE_OPTIONS = [
    { value: 'all', label: 'All Genres', icon: 'grid-outline' },
    { value: 'fiction', label: 'Fiction', icon: 'book-outline' },
    { value: 'non-fiction', label: 'Non-Fiction', icon: 'newspaper-outline' },
    { value: 'mystery', label: 'Mystery', icon: 'search-outline' },
    { value: 'romance', label: 'Romance', icon: 'heart-outline' },
    { value: 'science fiction', label: 'Sci-Fi', icon: 'planet-outline' },
    { value: 'fantasy', label: 'Fantasy', icon: 'sparkles-outline' },
    { value: 'biography', label: 'Biography', icon: 'person-outline' },
    { value: 'history', label: 'History', icon: 'time-outline' },
    { value: 'self-help', label: 'Self-Help', icon: 'bulb-outline' },
    { value: 'business', label: 'Business', icon: 'briefcase-outline' },
];

const LANGUAGE_OPTIONS = [
    { value: 'all', label: 'All Languages' },
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'Hindi' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
];

const PRICE_OPTIONS = [
    { value: 'all', label: 'All Books', icon: 'library-outline' },
    { value: 'free', label: 'Free Only', icon: 'gift-outline' },
    { value: 'paid', label: 'Paid Only', icon: 'pricetag-outline' },
];

interface FilterModalProps {
    visible: boolean;
    onClose: () => void;
    filters: SearchFilters;
    onApply: (filters: SearchFilters) => void;
}

export const FilterModal = ({ visible, onClose, filters, onApply }: FilterModalProps) => {
    const colors = useLibraryAppearance();
    const [localFilters, setLocalFilters] = useState<SearchFilters>(filters);

    useEffect(() => {
        if (visible) setLocalFilters(filters);
    }, [filters, visible]);

    const handleApply = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onApply(localFilters);
        onClose();
    };

    const handleReset = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setLocalFilters({});
    };

    const activeFiltersCount = [
        localFilters.genre && localFilters.genre !== 'all',
        localFilters.language && localFilters.language !== 'all',
        localFilters.priceType && localFilters.priceType !== 'all',
    ].filter(Boolean).length;

    return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}
        {...(Platform.OS === 'web' ? { accessibilityLabel: 'Filters' } : {})}>
        <Pressable accessible={false} focusable={false} style={[styles.scrim, { backgroundColor: colors.overlay }]} onPress={onClose}>
            <Pressable accessible={false} focusable={false} style={[styles.panel, { backgroundColor: colors.bgRaised, borderColor: colors.controlBorder }]}
                onPress={event => event.stopPropagation()}>
                <View style={styles.header}>
                    <Text accessibilityRole="header" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>{activeFiltersCount ? `Filters (${activeFiltersCount})` : 'Filters'}</Text>
                    <BookButton label="Reset filters" variant="text" onPress={handleReset} />
                </View>
                <ScrollView contentContainerStyle={styles.facets} showsVerticalScrollIndicator={false}>
                    <ChoiceRadioGroup label="Genre" value={localFilters.genre ?? 'all'} options={GENRE_OPTIONS}
                        onChange={genre => setLocalFilters(current => ({ ...current, genre }))} />
                    <ChoiceRadioGroup label="Language" value={localFilters.language ?? 'all'} options={LANGUAGE_OPTIONS}
                        onChange={language => setLocalFilters(current => ({ ...current, language }))} />
                    <ChoiceRadioGroup label="Price" value={localFilters.priceType ?? 'all'} options={PRICE_OPTIONS}
                        onChange={priceType => setLocalFilters(current => ({ ...current, priceType: priceType as SearchFilters['priceType'] }))} />
                </ScrollView>
                <View style={styles.footer}><BookButton label="Apply filters" variant="primary" onPress={handleApply} /></View>
            </Pressable>
        </Pressable>
    </Modal>;
};

interface FilterChipsProps {
    filters: SearchFilters;
    onRemove: (key: keyof SearchFilters) => void;
}

export const FilterChips = ({ filters, onRemove }: FilterChipsProps) => {
    const colors = useLibraryAppearance();
    const activeFilters: { key: keyof SearchFilters; label: string }[] = [];
    if (filters.genre && filters.genre !== 'all') activeFilters.push({ key: 'genre', label: filters.genre });
    if (filters.language && filters.language !== 'all') {
        const lang = LANGUAGE_OPTIONS.find(option => option.value === filters.language);
        activeFilters.push({ key: 'language', label: lang?.label || filters.language });
    }
    if (filters.priceType && filters.priceType !== 'all') activeFilters.push({ key: 'priceType', label: filters.priceType === 'free' ? 'Free' : 'Paid' });
    if (activeFilters.length === 0) return null;
    return <View style={styles.chips}>
        {activeFilters.map(filter => <Pressable key={filter.key} onPress={() => onRemove(filter.key)} accessibilityRole="button"
            accessibilityLabel={`Remove ${filter.label} filter`} accessibilityHint="Removes this search filter and refreshes results"
            style={[styles.chip, { borderColor: colors.controlBorder }]}>
            <Text style={[LIBRARY_TEXT.label, { color: colors.textPrimary, textTransform: 'capitalize' }]}>{filter.label}</Text>
            <Ionicons name="close" size={ICON_SIZE} color={colors.accent} />
        </Pressable>)}
    </View>;
};

const styles = StyleSheet.create({
    scrim: { flex: 1, justifyContent: 'flex-end', padding: LIBRARY_SPACING.md },
    panel: { width: '100%', maxWidth: DIALOG_MAX_WIDTH, alignSelf: 'center', maxHeight: '80%', borderRadius: LIBRARY_RADIUS.dialog, borderWidth: 1 },
    header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: LIBRARY_SPACING.xs, padding: LIBRARY_SPACING.md },
    facets: { padding: LIBRARY_SPACING.md, gap: LIBRARY_SPACING.lg },
    footer: { padding: LIBRARY_SPACING.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: LIBRARY_SPACING.xs, marginBottom: LIBRARY_SPACING.sm },
    chip: { flexDirection: 'row', alignItems: 'center', gap: LIBRARY_SPACING.xs, minHeight: MIN_TARGET, minWidth: MIN_TARGET, paddingHorizontal: LIBRARY_SPACING.sm, paddingVertical: LIBRARY_SPACING.xs, borderRadius: LIBRARY_RADIUS.chip, borderWidth: 1 },
});
