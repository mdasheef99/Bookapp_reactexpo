import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { NoteTag, NOTE_TAG_CONFIG } from '@/features/books/services/notesService';

interface TagSelectorProps {
    selected: NoteTag | null;
    onChange: (tag: NoteTag) => void;
    /** When true, allows deselecting (used for filtering) */
    allowDeselect?: boolean;
    /** Compact mode for inline use */
    compact?: boolean;
}

const TAGS: NoteTag[] = ['quote', 'reflect', 'distill', 'apply'];

export const TagSelector = ({ selected, onChange, allowDeselect = false, compact = false }: TagSelectorProps) => {
    const { colors } = useTheme();

    const handlePress = (tag: NoteTag) => {
        if (allowDeselect && selected === tag) {
            onChange(null as any); // Deselect
        } else {
            onChange(tag);
        }
    };

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {TAGS.map((tag) => {
                const config = NOTE_TAG_CONFIG[tag];
                const isSelected = selected === tag;

                return (
                    <TouchableOpacity
                        key={tag}
                        onPress={() => handlePress(tag)}
                        activeOpacity={0.7}
                        style={[
                            styles.tag,
                            compact && styles.tagCompact,
                            {
                                backgroundColor: isSelected ? config.color : colors.bgCard,
                                borderColor: isSelected ? config.color : colors.border,
                            },
                        ]}
                    >
                        <Ionicons
                            name={config.icon as any}
                            size={compact ? 14 : 16}
                            color={isSelected ? '#FFFFFF' : config.color}
                        />
                        <Text
                            style={[
                                styles.label,
                                compact && styles.labelCompact,
                                {
                                    color: isSelected ? '#FFFFFF' : colors.textSecondary,
                                    fontWeight: isSelected ? '700' : '500',
                                },
                            ]}
                        >
                            {config.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 8,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    tagCompact: {
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    label: {
        fontSize: 13,
        marginLeft: 6,
    },
    labelCompact: {
        fontSize: 12,
    },
});
