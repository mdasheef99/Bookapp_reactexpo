import { Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';

function valueOrDash(value: string | number | null | undefined): string {
    return value === null || value === undefined || value === '' ? 'Not provided' : String(value);
}

export function MetadataEvidencePanel({
    detail,
}: {
    detail: OwnerCandidateDetail;
}) {
    const { colors } = useTheme();
    const snapshot = detail.metadata.snapshot;
    if (!snapshot) {
        return (
            <Text selectable style={{ color: colors.textSecondary }}>
                No matched metadata is available. Manual reviewed details remain available.
            </Text>
        );
    }
    return (
        <View style={{ gap: 5 }} accessibilityLabel="Matched book metadata">
            <Text selectable style={{ color: colors.textPrimary, fontWeight: '800' }}>
                {snapshot.title}
            </Text>
            <Text selectable style={{ color: colors.textSecondary }}>
                {snapshot.authors.join(', ')}
            </Text>
            <Text selectable style={{ color: colors.textSecondary }}>
                Language {snapshot.language} · ISBN {valueOrDash(snapshot.isbn13 ?? snapshot.isbn10)}
            </Text>
            <Text selectable style={{ color: colors.textSecondary }}>
                Publisher {valueOrDash(snapshot.publisher)} · Published {valueOrDash(snapshot.publishedDate)}
            </Text>
            <Text selectable style={{ color: colors.textSecondary }}>
                Format {valueOrDash(snapshot.format)} · Pages {valueOrDash(snapshot.pageCount)}
            </Text>
            {snapshot.description ? (
                <Text selectable style={{ color: colors.textSecondary }}>
                    {snapshot.description}
                </Text>
            ) : null}
        </View>
    );
}

export function DuplicateEvidencePanel({
    detail,
}: {
    detail: OwnerCandidateDetail;
}) {
    const { colors } = useTheme();
    const display = detail.duplicateAdvice.display;
    if (!display) return null;
    return (
        <View style={{ gap: 5 }} accessibilityLabel="Possible existing inventory item">
            <Text selectable style={{ color: colors.textPrimary, fontWeight: '800' }}>
                {display.title}
            </Text>
            <Text selectable style={{ color: colors.textSecondary }}>
                {display.authors.length ? display.authors.join(', ') : 'Author not provided'}
            </Text>
            <Text selectable style={{ color: colors.textSecondary }}>
                {display.language} · {valueOrDash(display.format)} · {display.condition}
            </Text>
            <Text selectable style={{ color: colors.textSecondary }}>
                ₹{(display.priceMinor / 100).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })} · {display.availableQuantity} available · Shelf {display.location}
            </Text>
            <Text selectable style={{ color: colors.textSecondary }}>
                ISBN {valueOrDash(display.isbn13 ?? display.isbn10)} · Damage {display.hasDamage ? 'reported' : 'not reported'} · Copy note {display.hasCopySpecificNote ? 'present' : 'none'}
            </Text>
        </View>
    );
}
