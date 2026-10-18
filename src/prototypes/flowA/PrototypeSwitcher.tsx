import React from 'react';
import { ScrollView, Text } from 'react-native';
import { Link } from 'expo-router';
import { getLibraryAppearance } from '@/components/library/LibraryAppearance';
import type { ThemePhase } from '@/hooks/useTheme';
import { OPEN_ROWS, PRESETS } from './fixtures';
import type { OpenRow, Preset } from './fixtures';
import { PHASES, styles, usePrototypeText } from './prototypeTokens';

export default function PrototypeSwitcher({ phase }: { phase: ThemePhase }) {
    const text = usePrototypeText();
    const colors = getLibraryAppearance(phase);
    const link = (preset: Preset, chosenPhase: ThemePhase, open?: OpenRow, slots?: boolean) => {
        const label = `${preset} · ${chosenPhase}${open ? ` · open=${open}` : ''}${slots ? ' · slots=1' : ''}`;
        return <Link key={label} accessibilityRole="link" accessibilityLabel={label}
            href={{ pathname: '/(tabs)/library/dev-flow-a', params: { s: preset, phase: chosenPhase, ...(open ? { open } : {}), ...(slots ? { slots: '1' } : {}) } }}
            style={[styles.target, text.body, { color: colors.textPrimary }]}>
            <Text>{label}</Text>
        </Link>;
    };
    return <ScrollView testID="fa-switcher" style={{ backgroundColor: colors.bgPrimary }} contentContainerStyle={[styles.content, styles.switcher]}>
        {PRESETS.flatMap(preset => PHASES.map(chosenPhase => link(preset, chosenPhase)))}
        {PHASES.flatMap(chosenPhase => [...OPEN_ROWS.map(open => link('populated', chosenPhase, open)), link('populated', chosenPhase, undefined, true)])}
    </ScrollView>;
}
