import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import type { ThemePhase } from '@/hooks/useTheme';
import { LibraryTypographyProvider } from '@/components/library/LibraryTypography';
import { OPEN_ROWS, PRESETS } from './fixtures';
import type { OpenRow, Preset } from './fixtures';
import { PHASES, styles } from './prototypeTokens';
import { BookDetailsPrototype } from './BookDetailsPrototype';
import PrototypeSwitcher from './PrototypeSwitcher';

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default function BookDetailsPrototypeRoute() {
    const params = useLocalSearchParams<{ s?: string | string[]; phase?: string | string[]; open?: string | string[]; slots?: string | string[] }>();
    const { phase: currentPhase } = useTheme();
    const phaseParam = first(params.phase);
    const phase = PHASES.includes(phaseParam as ThemePhase) ? phaseParam as ThemePhase : currentPhase;
    const presetParam = first(params.s);
    const preset = PRESETS.includes(presetParam as Preset) ? presetParam as Preset : 'populated';
    const openParam = first(params.open);
    const open = OPEN_ROWS.includes(openParam as OpenRow) ? openParam as OpenRow : undefined;
    return <LibraryTypographyProvider>
        <View testID="FA_P1_PROTOTYPE_MARKER" style={styles.page}>
            {presetParam == null ? <PrototypeSwitcher phase={phase} /> :
                <BookDetailsPrototype key={`${preset}-${phase}-${open}-${first(params.slots)}`} preset={preset}
                    phase={phase} initialOpen={open} showSlots={first(params.slots) === '1'} />}
        </View>
    </LibraryTypographyProvider>;
}
