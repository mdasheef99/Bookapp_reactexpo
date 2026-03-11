import { View, Text, TouchableOpacity, Pressable, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemeColors } from '@/hooks/useTheme';
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
    colors: ThemeColors;
}

export const FilterModal = ({ visible, onClose, filters, onApply, colors }: FilterModalProps) => {
    const [localFilters, setLocalFilters] = useState<SearchFilters>(filters);

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

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
                onPress={onClose}
            >
                <Pressable
                    style={{
                        backgroundColor: colors.bgCard,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        maxHeight: '80%',
                    }}
                    onPress={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 20,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
                                Filters
                            </Text>
                            {activeFiltersCount > 0 && (
                                <View style={{
                                    backgroundColor: colors.accent,
                                    width: 20,
                                    height: 20,
                                    borderRadius: 10,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginLeft: 8,
                                }}>
                                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                                        {activeFiltersCount}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity onPress={handleReset}>
                            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>
                                Reset
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                        {/* Genre Section */}
                        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 12 }}>
                            GENRE
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                            {GENRE_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option.value}
                                    onPress={() => setLocalFilters(f => ({ ...f, genre: option.value }))}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingHorizontal: 14,
                                        paddingVertical: 10,
                                        borderRadius: 20,
                                        backgroundColor: localFilters.genre === option.value ? colors.accent : colors.bgSecondary,
                                        borderWidth: 1,
                                        borderColor: localFilters.genre === option.value ? colors.accent : colors.border,
                                    }}
                                >
                                    <Ionicons
                                        name={option.icon as any}
                                        size={16}
                                        color={localFilters.genre === option.value ? '#fff' : colors.textSecondary}
                                    />
                                    <Text style={{
                                        color: localFilters.genre === option.value ? '#fff' : colors.textPrimary,
                                        fontSize: 13,
                                        fontWeight: '500',
                                        marginLeft: 6,
                                    }}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Language Section */}
                        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 12 }}>
                            LANGUAGE
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                            {LANGUAGE_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option.value}
                                    onPress={() => setLocalFilters(f => ({ ...f, language: option.value }))}
                                    style={{
                                        paddingHorizontal: 16,
                                        paddingVertical: 10,
                                        borderRadius: 20,
                                        backgroundColor: localFilters.language === option.value ? colors.accent : colors.bgSecondary,
                                        borderWidth: 1,
                                        borderColor: localFilters.language === option.value ? colors.accent : colors.border,
                                    }}
                                >
                                    <Text style={{
                                        color: localFilters.language === option.value ? '#fff' : colors.textPrimary,
                                        fontSize: 13,
                                        fontWeight: '500',
                                    }}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Price Section */}
                        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 12 }}>
                            PRICE
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 40 }}>
                            {PRICE_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option.value}
                                    onPress={() => setLocalFilters(f => ({ ...f, priceType: option.value as any }))}
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        paddingVertical: 12,
                                        borderRadius: 14,
                                        backgroundColor: localFilters.priceType === option.value ? colors.accent : colors.bgSecondary,
                                        borderWidth: 1,
                                        borderColor: localFilters.priceType === option.value ? colors.accent : colors.border,
                                    }}
                                >
                                    <Ionicons
                                        name={option.icon as any}
                                        size={16}
                                        color={localFilters.priceType === option.value ? '#fff' : colors.textSecondary}
                                    />
                                    <Text style={{
                                        color: localFilters.priceType === option.value ? '#fff' : colors.textPrimary,
                                        fontSize: 13,
                                        fontWeight: '500',
                                        marginLeft: 6,
                                    }}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>

                    {/* Apply Button */}
                    <View style={{ padding: 20, paddingTop: 0 }}>
                        <TouchableOpacity
                            onPress={handleApply}
                            style={{
                                backgroundColor: colors.accent,
                                paddingVertical: 16,
                                borderRadius: 16,
                                alignItems: 'center',
                                shadowColor: colors.accent,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 4,
                            }}
                        >
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                                Apply Filters
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

// Filter chips to show active filters
interface FilterChipsProps {
    filters: SearchFilters;
    onRemove: (key: keyof SearchFilters) => void;
    colors: ThemeColors;
}

export const FilterChips = ({ filters, onRemove, colors }: FilterChipsProps) => {
    const activeFilters: { key: keyof SearchFilters; label: string }[] = [];

    if (filters.genre && filters.genre !== 'all') {
        activeFilters.push({ key: 'genre', label: filters.genre });
    }
    if (filters.language && filters.language !== 'all') {
        const lang = LANGUAGE_OPTIONS.find(l => l.value === filters.language);
        activeFilters.push({ key: 'language', label: lang?.label || filters.language });
    }
    if (filters.priceType && filters.priceType !== 'all') {
        activeFilters.push({ key: 'priceType', label: filters.priceType === 'free' ? 'Free' : 'Paid' });
    }

    if (activeFilters.length === 0) return null;

    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {activeFilters.map((filter) => (
                <TouchableOpacity
                    key={filter.key}
                    onPress={() => onRemove(filter.key)}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.accent + '20',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: colors.accent + '40',
                    }}
                >
                    <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>
                        {filter.label}
                    </Text>
                    <Ionicons name="close" size={14} color={colors.accent} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
            ))}
        </View>
    );
};

import { useState } from 'react';
