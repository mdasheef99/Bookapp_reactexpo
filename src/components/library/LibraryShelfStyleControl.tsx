import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LIBRARY_RADIUS, useLibraryAppearance } from './LibraryAppearance';
import { useLibraryTypography } from './LibraryTypography';

export type LibraryShelfStyle = 'vertical' | 'horizontal';
export const LIBRARY_SHELF_STYLE_KEY = 'library_shelfStyle:v1';

export function LibraryShelfStyleControl({ value, onChange, disabled }: {
    value: LibraryShelfStyle; onChange: (value: LibraryShelfStyle) => void; disabled: boolean;
}) {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();
    return <View testID="library-shelf-style-control" style={styles.row}>
        <Text style={{ color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12 }}>Book layout</Text>
        <View style={[styles.choices, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            {(['vertical', 'horizontal'] as const).map((style) => <Pressable key={style} testID={`library-shelf-style-${style}`}
                accessibilityRole="button" accessibilityLabel={`${style === 'vertical' ? 'Vertical' : 'Horizontal'} shelf layout`}
                accessibilityState={{ selected: value === style, disabled }}
                {...(Platform.OS === 'web' ? { 'aria-pressed': value === style } : {})}
                disabled={disabled} onPress={() => onChange(style)}
                style={[styles.choice, value === style && { backgroundColor: colors.bgCard }, disabled && { opacity: 0.6 }]}>
                <Text style={{ color: value === style ? colors.textPrimary : colors.textSecondary,
                    fontFamily: fonts.label, fontSize: 12 }}>{style === 'vertical' ? 'Vertical' : 'Horizontal'}</Text>
            </Pressable>)}
        </View>
    </View>;
}
const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
    choices: { flexDirection: 'row', padding: 3, borderWidth: 1, borderRadius: LIBRARY_RADIUS.control },
    choice: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8 },
});
