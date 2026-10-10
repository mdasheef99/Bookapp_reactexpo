import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import { compactReviewDisplay, publicationHasEffectiveOverride, type CompactReviewEdits } from '../review/compactReviewDraft';
import type { ScanSetupFormState } from '../scanSetup/scanSetupForm';
import { FieldSummary } from './BatchReviewFieldSummary';
import { InlineBatchReviewAdditionalFields } from './InlineBatchReviewAdditionalFields';

export function BatchReviewDetails({ card, defaults, mountedEdits, display, errorFields, disabled, updateEdits }: {
  card: OwnerBatchReviewCard; defaults: ScanSetupFormState; mountedEdits: CompactReviewEdits;
  display: ReturnType<typeof compactReviewDisplay>; errorFields: ReadonlySet<string>;
  disabled: boolean; updateEdits: (patch: CompactReviewEdits) => void;
}) {
  const { colors } = useTheme();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const publicationOverride = publicationHasEffectiveOverride(card, defaults, mountedEdits);
  return (
<View style={{
                    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
                    backgroundColor: colors.bgSecondary, gap: 1, paddingHorizontal: 12,
                }} testID="card-additional-details">
                    <Pressable
                        testID="card-additional-details-toggle"
                        accessibilityRole="button"
                        accessibilityLabel={detailsExpanded
                            ? 'Hide location, publication, language, and damage details'
                            : 'Show location, publication, language, and damage details'}
                        onPress={() => setDetailsExpanded((current) => !current)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                    >
                        <Text selectable style={{ flex: 1, color: colors.textSecondary, fontSize: 14 }}>
                            Location · Publication · Language · Damage
                        </Text>
                        <Text selectable style={{ color: colors.textSecondary, fontSize: 12 }}>
                            {detailsExpanded ? '▲' : '▼'}
                        </Text>
                    </Pressable>
                    {detailsExpanded ? (
                        <InlineBatchReviewAdditionalFields
                            display={display}
                            defaults={defaults}
                            sourceCodes={{
                                language: card.fieldSources.language,
                                location: card.fieldSources.location,
                                publication: card.fieldSources.publication,
                                damage: card.fieldSources.damage,
                            }}
                            localFields={{
                                language: mountedEdits.originalLanguage !== undefined,
                                location: mountedEdits.shelfLocation !== undefined,
                                publication: mountedEdits.publicationIntent !== undefined || publicationOverride,
                                damage: mountedEdits.damageDisclosure !== undefined,
                            }}
                            errorFields={errorFields}
                            disabled={disabled}
                            onChange={updateEdits}
                        />
                    ) : (
                        <View testID="card-additional-details-summary" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 8 }}>
                            <FieldSummary label="Location" value={display.location || 'No location'}
                                sourceCode={card.fieldSources.location}
                                local={mountedEdits.shelfLocation !== undefined}
                                testSuffix="collapsed-location" compact />
                            <FieldSummary label="Publication" value={display.publication === 'publish' ? 'Publish' : 'Private'}
                                sourceCode={card.fieldSources.publication}
                                local={mountedEdits.publicationIntent !== undefined || publicationOverride}
                                testSuffix="collapsed-publication" compact />
                            <FieldSummary label="Language" value={display.language || 'No language'}
                                sourceCode={card.fieldSources.language}
                                local={mountedEdits.originalLanguage !== undefined}
                                testSuffix="collapsed-language" compact />
                            <FieldSummary label="Damage" value={display.damage.hasDamage ? 'Has damage' : 'No damage'}
                                sourceCode={card.fieldSources.damage}
                                local={mountedEdits.damageDisclosure !== undefined}
                                testSuffix="collapsed-damage" compact />
                        </View>
                    )}
                </View>
  );
}
