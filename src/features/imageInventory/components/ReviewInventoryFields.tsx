import { Text, View } from 'react-native';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import type { ReviewDraft, ReviewFieldErrors } from '../review/reviewForm';
import { DuplicateEvidencePanel } from './CandidateEvidencePanels';
import { ReviewFieldError, ReviewToggle } from './ReviewFieldControls';

const conditions = [
    ['new', 'New', 'Unused copy in new condition.'],
    ['like_new', 'Like New', 'Read or handled with almost no visible wear.'],
    ['very_good', 'Very Good', 'Minor wear with no important defects.'],
    ['good', 'Good', 'Visible wear but complete, readable, and usable.'],
    ['acceptable', 'Acceptable', 'Noticeable wear; all important content remains usable.'],
] as const;
const damageTypes = [
    ['cover', 'Cover'],
    ['binding', 'Binding'],
    ['pages', 'Pages'],
    ['water', 'Water'],
    ['staining', 'Staining'],
    ['writing', 'Writing'],
    ['missing_parts', 'Missing parts'],
    ['mould_or_contamination', 'Mould or contamination'],
    ['other', 'Other'],
] as const;

export function ReviewInventoryFields({
    detail,
    draft,
    errors,
    disabled,
    onChange,
    sectionStyle,
}: {
    detail: OwnerCandidateDetail;
    draft: ReviewDraft;
    errors: ReviewFieldErrors;
    disabled: boolean;
    onChange: (next: ReviewDraft) => void;
    sectionStyle: object;
}) {
    const { colors } = useTheme();
    const update = (patch: Partial<ReviewDraft>) => onChange({ ...draft, ...patch });
    return (
        <>
            <View style={sectionStyle}>
                <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>
                    Condition
                </Text>
                {conditions.map(([value, label, hint]) => (
                    <ReviewToggle key={value} label={label} selected={draft.baseCondition === value} hint={hint} onPress={() => update({ baseCondition: value })} disabled={disabled} />
                ))}
                <Text selectable style={{ color: colors.textSecondary }}>
                    {conditions.find(([value]) => value === draft.baseCondition)?.[2]}
                </Text>
                <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Damage</Text>
                <ReviewToggle label="No damage" selected={!draft.hasDamage} onPress={() => update({ hasDamage: false, damageTypes: [], damageNote: '' })} disabled={disabled} />
                <ReviewToggle label="Has damage" selected={draft.hasDamage} onPress={() => update({ hasDamage: true })} disabled={disabled} />
                {draft.hasDamage ? (
                    <View style={{ gap: 8 }}>
                        {damageTypes.map(([value, label]) => (
                            <ReviewToggle
                                key={value}
                                label={label}
                                selected={draft.damageTypes.includes(value)}
                                onPress={() => update({
                                    damageTypes: draft.damageTypes.includes(value)
                                        ? draft.damageTypes.filter((entry) => entry !== value)
                                        : [...draft.damageTypes, value],
                                })}
                                disabled={disabled}
                            />
                        ))}
                        <Input label="Damage note" value={draft.damageNote} onChangeText={(damageNote) => update({ damageNote })} maxLength={1000} disabled={disabled} testID="review-damage-note" />
                    </View>
                ) : null}
                <ReviewToggle label="Complete, readable, and safe" selected={draft.completeReadableSafe} onPress={() => update({ completeReadableSafe: !draft.completeReadableSafe })} disabled={disabled} />
                <ReviewToggle label="Sellable copy" selected={draft.isSellable} onPress={() => update({ isSellable: !draft.isSellable })} disabled={disabled} />
                <ReviewFieldError message={errors.damageDisclosure} />
            </View>

            <View style={sectionStyle}>
                <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>
                    Notes and visibility
                </Text>
                <Input label="Public note (optional)" value={draft.publicNote} onChangeText={(publicNote) => update({ publicNote })} maxLength={1000} disabled={disabled} testID="review-public-note" />
                <Input label="Internal note (optional)" value={draft.internalNote} onChangeText={(internalNote) => update({ internalNote })} maxLength={1000} disabled={disabled} testID="review-internal-note" />
                <ReviewToggle label="Save private" selected={draft.publicationIntent === 'private'} onPress={() => update({ publicationIntent: 'private' })} disabled={disabled} />
                <ReviewToggle label="Publish after review" selected={draft.publicationIntent === 'publish'} onPress={() => update({ publicationIntent: 'publish' })} hint="This records intent only. Unit 6 does not publish inventory." disabled={disabled} />
                {(!draft.isSellable || !draft.completeReadableSafe) ? (
                    <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error }}>
                        Unsellable or unsafe books are saved private.
                    </Text>
                ) : null}
            </View>

            {detail.duplicateAdvice.version !== null ? (
                <View style={sectionStyle}>
                    <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>
                        Possible existing item
                    </Text>
                    <DuplicateEvidencePanel detail={detail} />
                    {detail.duplicateAdvice.allowedIntents.map((action) => (
                        <ReviewToggle
                            key={action}
                            label={{
                                increment_quantity: 'Increase existing quantity',
                                create_separate: 'Keep as a separate item',
                                manual_match: 'Use this existing item',
                            }[action]}
                            selected={draft.duplicateIntent?.action === action}
                            onPress={() => update({
                                duplicateIntent: {
                                    action,
                                    targetInventoryId: action === 'create_separate' ? null : detail.duplicateAdvice.targetInventoryId,
                                    adviceVersion: detail.duplicateAdvice.version as number,
                                },
                            })}
                            disabled={disabled}
                        />
                    ))}
                    <ReviewFieldError message={errors.duplicateIntent} />
                </View>
            ) : null}
        </>
    );
}
