import { Text } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { EditionChoices } from '../contracts/ownerEditionPicker';

// SDD-1 §4 / D07: only factual parts of the chosen snapshot appear here.
export function EditionLine({ choices, pending, identityChanged, selected = false }: {
    choices?: EditionChoices; pending: boolean; identityChanged: boolean; selected?: boolean;
}) {
    const { colors } = useTheme();
    const snapshot = choices?.selection?.snapshot;
    const parts = snapshot ? [snapshot.publisher, snapshot.publishedDate?.match(/\b[0-9]{4}\b/u)?.[0],
        snapshot.isbn13 || snapshot.isbn10].filter(Boolean) : [];
    const label = pending ? 'Finding edition…' : identityChanged ? 'No edition chosen — title or author changed'
        : snapshot ? parts.join(' · ') || 'Edition chosen' : selected ? 'Edition chosen' : 'No edition chosen';
    return <Text selectable accessibilityLabel={label} accessibilityLiveRegion="polite"
        style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{label}</Text>;
}
