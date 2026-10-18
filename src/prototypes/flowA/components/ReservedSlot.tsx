import React from 'react';
import { Text, View } from 'react-native';
import { styles, usePrototypeText } from '../prototypeTokens';
import type { Appearance } from '../prototypeTokens';

export function ReservedSlot({ kind, colors }: { kind: 'options' | 'dates'; colors: Appearance }) {
    const text = usePrototypeText();
    return <View testID={`fa-slot-${kind}`} accessible={false} aria-hidden importantForAccessibility="no-hide-descendants"
        style={[styles.annotation, kind === 'options' ? styles.headerSlot : styles.dateSlot, { borderColor: colors.divider }]}>
        <Text testID={`fa-slot-${kind}-meta`} style={[text.caption, { color: colors.textTertiary }]}>
            {kind === 'options' ? 'SDD-08' : 'SDD-09 · Reading dates / reread'}
        </Text>
    </View>;
}
