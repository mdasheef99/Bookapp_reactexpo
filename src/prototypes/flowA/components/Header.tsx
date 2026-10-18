import React from 'react';
import { View } from 'react-native';
import { styles } from '../prototypeTokens';
import type { Appearance } from '../prototypeTokens';
import { TextButton } from './TextButton';
import { ReservedSlot } from './ReservedSlot';

export function Header({ colors, showSlots }: { colors: Appearance; showSlots: boolean }) {
    return <View style={styles.header}>
        <TextButton label="‹ Library" accessibleName="Back to Library" colors={colors} primaryInk
            onPress={() => console.info('[FA-P1] would go back')} />
        {showSlots ? <ReservedSlot kind="options" colors={colors} /> : <View accessible={false} style={styles.headerSlot} />}
    </View>;
}
