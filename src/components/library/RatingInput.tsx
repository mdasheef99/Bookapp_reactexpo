import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface RatingInputProps {
    rating: number; // 0-5
    onChange: (val: number) => void;
    disabled?: boolean;
}

export const RatingInput = ({ rating, onChange, disabled }: RatingInputProps) => {
    const { colors } = useTheme();

    return (
        <View style={styles.container}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Your Rating</Text>
            <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                        key={star}
                        onPress={() => onChange(star)}
                        disabled={disabled}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={star <= rating ? 'star' : 'star-outline'}
                            size={32}
                            color={star <= rating ? '#eab308' : colors.textTertiary}
                            style={{ marginRight: 8 }}
                        />
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        alignItems: 'center',
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    starsContainer: {
        flexDirection: 'row',
    },
});
