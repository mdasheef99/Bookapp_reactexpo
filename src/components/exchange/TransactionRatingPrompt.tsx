import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TransactionRating } from '@/features/exchange/services/ratingsService';
import type { ThemeColors } from '@/hooks/useTheme';

export interface RatingDraft {
    rating: number;
    tags: string[];
    review: string;
}

interface TransactionRatingPromptProps {
    colors: ThemeColors;
    otherPartyName: string;
    existingRating?: TransactionRating | null;
    isSubmitting: boolean;
    onSubmit: (draft: RatingDraft) => void;
}

const TAG_OPTIONS = [
    { key: 'good_communication', label: 'Good communication' },
    { key: 'book_as_described', label: 'Book as described' },
    { key: 'smooth_meetup', label: 'Smooth meetup' },
];

export function TransactionRatingPrompt({
    colors,
    otherPartyName,
    existingRating,
    isSubmitting,
    onSubmit,
}: TransactionRatingPromptProps) {
    const [rating, setRating] = useState(0);
    const [tags, setTags] = useState<string[]>([]);
    const [review, setReview] = useState('');

    if (existingRating) {
        return (
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>You rated this exchange</Text>
                <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map(star => (
                        <Ionicons
                            key={star}
                            name={star <= existingRating.rating ? 'star' : 'star-outline'}
                            size={22}
                            color="#F59E0B"
                        />
                    ))}
                </View>
                {existingRating.review ? (
                    <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
                        {existingRating.review}
                    </Text>
                ) : null}
            </View>
        );
    }

    const toggleTag = (tag: string) => {
        setTags(current =>
            current.includes(tag)
                ? current.filter(value => value !== tag)
                : [...current, tag]
        );
    };

    return (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Rate this exchange</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Share quick feedback for {otherPartyName}.
            </Text>
            <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map(star => (
                    <TouchableOpacity
                        key={star}
                        onPress={() => setRating(star)}
                        accessibilityRole="button"
                        accessibilityLabel={`Rate ${star} stars`}
                    >
                        <Ionicons
                            name={star <= rating ? 'star' : 'star-outline'}
                            size={30}
                            color="#F59E0B"
                        />
                    </TouchableOpacity>
                ))}
            </View>
            <View style={styles.tagRow}>
                {TAG_OPTIONS.map(tag => {
                    const selected = tags.includes(tag.key);
                    return (
                        <TouchableOpacity
                            key={tag.key}
                            onPress={() => toggleTag(tag.key)}
                            style={[
                                styles.tag,
                                {
                                    borderColor: selected ? colors.accent : colors.border,
                                    backgroundColor: selected ? `${colors.accent}18` : 'transparent',
                                },
                            ]}
                        >
                            <Text style={[styles.tagText, { color: selected ? colors.accent : colors.textSecondary }]}>
                                {tag.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            <TextInput
                value={review}
                onChangeText={setReview}
                placeholder="Optional review"
                placeholderTextColor={colors.textTertiary}
                style={[
                    styles.input,
                    {
                        borderColor: colors.border,
                        color: colors.textPrimary,
                        backgroundColor: colors.bgSecondary,
                    },
                ]}
                multiline
            />
            <TouchableOpacity
                onPress={() => onSubmit({ rating, tags, review })}
                disabled={rating === 0 || isSubmitting}
                style={[
                    styles.submitButton,
                    { backgroundColor: rating === 0 || isSubmitting ? colors.disabled : colors.accent },
                ]}
            >
                <Text style={styles.submitText}>{isSubmitting ? 'Submitting...' : 'Submit rating'}</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginTop: 12,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
    },
    subtitle: {
        fontSize: 13,
        lineHeight: 18,
        marginTop: 4,
    },
    starRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 14,
    },
    tag: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    tagText: {
        fontSize: 12,
        fontWeight: '700',
    },
    input: {
        minHeight: 76,
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        textAlignVertical: 'top',
        marginTop: 14,
        fontSize: 14,
    },
    submitButton: {
        alignItems: 'center',
        borderRadius: 10,
        paddingVertical: 12,
        marginTop: 12,
    },
    submitText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    reviewText: {
        marginTop: 10,
        fontSize: 14,
        lineHeight: 20,
    },
});
