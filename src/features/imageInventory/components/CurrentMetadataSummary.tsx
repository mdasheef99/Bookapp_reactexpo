import { Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import { MetadataCover } from './MetadataCover';

type Snapshot = Partial<Omit<NonNullable<OwnerCandidateDetail['metadata']['snapshot']>, 'title' | 'authors' | 'language'>> & {
  title: string | null; authors: readonly string[] | null; language: string | null;
};
export function MetadataValue({ label, value }: { label: string; value: string | number | null | undefined }) {
  const { colors } = useTheme();
  if (value == null || value === '') return null;
  return <Text selectable style={{ color: colors.textPrimary }}>{label}: {String(value)}</Text>;
}
// Picker §13.2: one current choice above results; representative provenance stays truthful.
export function CurrentMetadataSummary({ snapshot, representative }: {
  snapshot: Snapshot | null;
  representative: OwnerCandidateDetail['metadata']['representativeCover'];
}) {
  const { colors } = useTheme();
  if (!snapshot) return <Text selectable testID="metadata-no-selected-details" style={{ color: colors.textSecondary }}>
    No selected metadata details are available. Detected identity remains available for manual review.
  </Text>;
  const fallback = snapshot.coverReference ? null : representative;
  return <View style={{ gap: 4 }} testID="selected-metadata-details">
    <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontWeight: '700' }}>Current choice</Text>
    <MetadataCover reference={snapshot.coverReference ?? fallback?.coverReference ?? null}
      label={`Cover for ${snapshot.title ?? 'current choice'}`} placeholderLabel={`No cover available for ${snapshot.title ?? 'current choice'}`}
      style={{ width: 120, height: 180, alignSelf: 'center', borderRadius: 8 }} />
    {fallback ? <MetadataValue label="Cover source" value="Representative edition" /> : null}
    <MetadataValue label="Title" value={snapshot.title} />
    <MetadataValue label="Subtitle" value={snapshot.subtitle} />
    <MetadataValue label="Authors" value={snapshot.authors?.join(', ') ?? null} />
    <MetadataValue label="Description" value={snapshot.description} />
    <MetadataValue label="Language" value={snapshot.language} />
    <MetadataValue label="ISBN-10" value={snapshot.isbn10} />
    <MetadataValue label="ISBN-13" value={snapshot.isbn13} />
    <MetadataValue label="Publisher" value={snapshot.publisher} />
    <MetadataValue label="Published" value={snapshot.publishedDate} />
    <MetadataValue label="Edition" value={snapshot.editionStatement} />
    <MetadataValue label="Volume" value={snapshot.volume} />
    <MetadataValue label="Format" value={snapshot.format} />
    <MetadataValue label="Page count" value={snapshot.pageCount} />
    <MetadataValue label="Categories / genre" value={snapshot.categories?.join(', ') ?? null} />
    <MetadataValue label="Source" value="Selected metadata" />
  </View>;
}