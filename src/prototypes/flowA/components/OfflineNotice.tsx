import React from 'react';
import { Text } from 'react-native';
import { styles, usePrototypeText } from '../prototypeTokens';
import type { Appearance } from '../prototypeTokens';

export function OfflineNotice({ colors }: { colors: Appearance }) {
    const text = usePrototypeText();
    return <Text style={[text.body, styles.notice, { color: colors.textSecondary }]}>Offline · Showing saved content.</Text>;
}
