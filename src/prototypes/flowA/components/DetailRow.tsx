import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ICON_SIZE, styles, usePrototypeText, useWebFocus } from '../prototypeTokens';
import type { Appearance } from '../prototypeTokens';

export function DetailRow({ id, label, secondary, absent, expanded, onPress, children, colors, link = false }: {
    id: string; label: string; secondary?: string; absent?: boolean; expanded?: boolean; link?: boolean;
    onPress?: () => void; children?: React.ReactNode; colors: Appearance;
}) {
    const text = usePrototypeText();
    const { focusStyle, ...focusProps } = useWebFocus(colors);
    const content = <>
        <Text style={[text.body, styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
        {secondary ? <Text numberOfLines={1} ellipsizeMode="tail" style={[text.body, styles.rowSummary,
            { color: absent ? colors.textTertiary : colors.textSecondary }]}>{secondary}</Text> : <View style={styles.spacer} />}
    </>;
    if (!onPress) return <View testID={`fa-row-${id}`} style={[styles.row, { borderColor: colors.divider }]}>{content}</View>;
    const disclosure = !link && expanded !== undefined;
    return <View>
        <Pressable testID={`fa-row-${id}`} accessibilityRole={link ? 'link' : 'button'}
            accessibilityLabel={[label, secondary].filter(Boolean).join(', ')}
            aria-expanded={disclosure ? expanded : undefined} accessibilityState={disclosure ? { expanded } : undefined}
            {...focusProps} onPress={onPress} style={[styles.row, { borderColor: colors.divider }, focusStyle]}>
            {content}
            <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={ICON_SIZE} color={colors.textSecondary} accessible={false} aria-hidden />
        </Pressable>
        {expanded && <View testID={`fa-expanded-${id}`} style={styles.expanded}>{children}</View>}
    </View>;
}
