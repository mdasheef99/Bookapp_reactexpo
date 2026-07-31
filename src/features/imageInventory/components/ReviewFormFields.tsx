import { Text, View } from 'react-native';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import type {
    ReviewDraft,
    ReviewFieldErrors,
} from '../review/reviewForm';
import { MetadataEvidencePanel } from './CandidateEvidencePanels';
import {
    ReviewAction,
    ReviewFieldError,
    ReviewToggle,
} from './ReviewFieldControls';
import { ReviewInventoryFields } from './ReviewInventoryFields';

export function ReviewFormFields({
    detail,
    draft,
    errors,
    disabled,
    onChange,
}: {
    detail: OwnerCandidateDetail;
    draft: ReviewDraft;
    errors: ReviewFieldErrors;
    disabled: boolean;
    onChange: (next: ReviewDraft) => void;
}) {
    const { colors } = useTheme();
    const update = (patch: Partial<ReviewDraft>) => onChange({ ...draft, ...patch });
    const updateAuthor = (index: number, value: string) => {
        const authors = [...draft.authors];
        authors[index] = value;
        const confirmed = [...draft.originalFieldConfirmation.authors];
        confirmed[index] = false;
        update({
            authors,
            originalFieldConfirmation: {
                ...draft.originalFieldConfirmation,
                authors: confirmed,
            },
        });
    };
    const section = {
        gap: 10,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        backgroundColor: colors.bgCard,
    } as const;
    return (
        <View style={{ gap: 16 }}>
            <View style={section}>
                <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>
                    Original book text
                </Text>
                <Text selectable style={{ color: colors.textSecondary }}>
                    Preserve the title and authors in the language printed on the book.
                </Text>
                <Input
                    label="Original title"
                    value={draft.originalTitle}
                    onChangeText={(originalTitle) => update({
                        originalTitle,
                        originalFieldConfirmation: {
                            ...draft.originalFieldConfirmation,
                            title: false,
                        },
                    })}
                    disabled={disabled}
                    maxLength={512}
                    testID="review-original-title"
                />
                <ReviewFieldError message={errors.originalTitle} />
                <ReviewToggle
                    label="I confirm this title"
                    selected={draft.originalFieldConfirmation.title}
                    onPress={() => update({
                        originalFieldConfirmation: {
                            ...draft.originalFieldConfirmation,
                            title: !draft.originalFieldConfirmation.title,
                        },
                    })}
                    testID="confirm-title"
                    disabled={disabled}
                />
                {draft.authors.map((author, index) => (
                    <View key={`author-${index}`} style={{ gap: 8 }}>
                        <Input
                            label={`Author ${index + 1}`}
                            value={author}
                            onChangeText={(value) => updateAuthor(index, value)}
                            disabled={disabled}
                            maxLength={256}
                            testID={`review-author-${index}`}
                        />
                        <ReviewToggle
                            label={`I confirm author ${index + 1}`}
                            selected={draft.originalFieldConfirmation.authors[index] ?? false}
                            onPress={() => {
                                const authors = [...draft.originalFieldConfirmation.authors];
                                authors[index] = !authors[index];
                                update({
                                    originalFieldConfirmation: {
                                        ...draft.originalFieldConfirmation,
                                        authors,
                                    },
                                });
                            }}
                            testID={`confirm-author-${index}`}
                            disabled={disabled}
                        />
                        <ReviewAction
                            label={`Remove author ${index + 1}`}
                            disabled={disabled}
                            onPress={() => {
                                const authors = draft.authors.filter((_, position) => position !== index);
                                const confirmed = draft.originalFieldConfirmation.authors
                                    .filter((_, position) => position !== index);
                                update({
                                    authors,
                                    originalFieldConfirmation: {
                                        ...draft.originalFieldConfirmation,
                                        authors: confirmed,
                                    },
                                });
                            }}
                        />
                    </View>
                ))}
                <ReviewAction
                    label="Add author"
                    disabled={disabled || draft.authors.length >= 20}
                    onPress={() => update({
                        authors: [...draft.authors, ''],
                        originalFieldConfirmation: {
                            ...draft.originalFieldConfirmation,
                            authors: [...draft.originalFieldConfirmation.authors, false],
                        },
                    })}
                />
                <Input
                    label="Language tag"
                    value={draft.originalLanguage}
                    onChangeText={(originalLanguage) => update({ originalLanguage })}
                    disabled={disabled}
                    maxLength={35}
                    testID="review-language"
                />
                <Input
                    label="Script (optional)"
                    value={draft.script}
                    onChangeText={(script) => update({ script })}
                    disabled={disabled}
                    maxLength={4}
                    testID="review-script"
                />
            </View>

            <View style={section}>
                <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>
                    Book details
                </Text>
                <Text selectable style={{ color: colors.textSecondary }}>
                    {detail.metadata.state === 'selected' ? 'Book details matched' : 'Manual book details'}
                </Text>
                <MetadataEvidencePanel detail={detail} />
                <ReviewFieldError message={errors.metadataChoice} />
                {detail.metadata.state === 'selected' ? (
                    <View style={{ gap: 8 }}>
                        <ReviewToggle
                            label="Use matched details"
                            selected={draft.metadataMode === 'selected'}
                            onPress={() => update({
                                metadataMode: 'selected',
                                selectionId: detail.metadata.selectionId,
                            })}
                            disabled={disabled}
                        />
                        <ReviewToggle
                            label="Use manual details"
                            selected={draft.metadataMode === 'manual'}
                            onPress={() => update({ metadataMode: 'manual', selectionId: null })}
                            disabled={disabled}
                        />
                    </View>
                ) : null}
                <Input label="Quantity" value={draft.quantity} onChangeText={(quantity) => update({ quantity })} keyboardType="number-pad" disabled={disabled} testID="review-quantity" />
                <ReviewFieldError message={errors.quantity} />
                <Input label="Price in paise" value={draft.priceMinor} onChangeText={(priceMinor) => update({ priceMinor })} keyboardType="number-pad" disabled={disabled} testID="review-price-minor" />
                <ReviewFieldError message={errors.priceMinor} />
                {/^(?:0|[1-9]\d*)$/u.test(draft.priceMinor) ? (
                    <Text selectable style={{ color: colors.textSecondary }}>
                        ₹{(Number(draft.priceMinor) / 100).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                    </Text>
                ) : null}
                <Input label="Shelf location" value={draft.shelfLocation} onChangeText={(shelfLocation) => update({ shelfLocation })} disabled={disabled} maxLength={120} testID="review-location" />
                <ReviewFieldError message={errors.shelfLocation} />
            </View>
            <ReviewInventoryFields
                detail={detail}
                draft={draft}
                errors={errors}
                disabled={disabled}
                onChange={onChange}
                sectionStyle={section}
            />
        </View>
    );
}
