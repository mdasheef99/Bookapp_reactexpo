import { act, fireEvent, render, within } from '@testing-library/react-native';
import { BatchReviewCard } from '../components/BatchReviewCard';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import { testUuid } from '../testing/ownerUxTestFixtures';

jest.mock('expo-image', () => ({
    Image: (props: Record<string, unknown>) => {
        const { Text } = require('react-native') as typeof import('react-native');
        const { createElement } = require('react') as typeof import('react');
        return createElement(Text, null, String(props.accessibilityLabel));
    },
}));

const defaults = {
    languageHint: 'en', condition: null, location: 'Front shelf',
    priceMinor: null, publication: 'private' as const, batchLabel: '',
};

function reviewCard(overrides: Partial<OwnerBatchReviewCard> = {}): OwnerBatchReviewCard {
    return {
        sessionId: testUuid(10), candidateId: testUuid(21), inputId: testUuid(1),
        ordinal: 1, candidateState: 'ready', candidateVersion: 2,
        metadataState: 'selected', metadataRevision: 3, reviewVersion: 1,
        reviewDisposition: 'reviewed',
        observed: { title: 'Observed Title', authors: ['Author A'], language: 'en', script: 'Latn' },
        metadataSummary: {
            title: 'Matched Metadata Title', authors: ['Author A'], language: 'en',
            coverReference: null, selectionId: testUuid(99),
        },
        review: {
            originalTitle: 'Matched Metadata Title', authors: ['Author A'],
            originalLanguage: 'en', script: 'Latn',
            metadataChoice: { mode: 'selected', selectionId: testUuid(99) },
            quantity: 1, priceMinor: 25_000, baseCondition: 'good',
            damageDisclosure: {
                hasDamage: false, damageTypes: [], damageNote: null,
                isSellable: true, completeReadableSafe: true,
            },
            shelfLocation: 'Front shelf',
            notes: { publicNote: null, internalNote: null },
            publicationIntent: 'private', duplicateIntent: null,
            originalFieldConfirmation: { title: true, authors: [true] },
            candidateDisposition: 'reviewed',
        },
        fieldSources: {
            cover: 'missing', title: 'matched', authors: 'matched', language: 'default',
            condition: 'default', price: 'custom', quantity: 'default',
            location: 'default', publication: 'default', damage: 'default',
        },
        attentionCodes: [], blockers: [], reviewReady: true,
        allowedActions: ['save_review', 'add_to_inventory'],
        updatedAt: '2026-09-16T00:00:00.000Z',
        ...overrides,
    };
}

function renderCard(card: OwnerBatchReviewCard = reviewCard()) {
    const onDraftChange = jest.fn();
    const onAdd = jest.fn(async () => ({ status: 'succeeded' as const }));
    const screen = render(
        <BatchReviewCard
            identity={{ userId: testUuid(90), storeId: testUuid(91) }}
            card={card}
            defaults={defaults}
            isOffline={false}
            canMutate
            removePending={false}
            addPending={false}
            onOpenFullCorrection={jest.fn()}
            onRemove={jest.fn()}
            onAdd={onAdd}
            onDraftChange={onDraftChange}
        />,
    );
    return { ...screen, onDraftChange, onAdd };
}

describe('Phase 9 Unit 6G bounded post-scan UI corrections', () => {
    it('shows secondary value source cues in collapsed and expanded card states', () => {
        const base = reviewCard();
        const screen = renderCard(reviewCard({
            fieldSources: { ...base.fieldSources, language: 'matched',
                location: 'custom', publication: 'default', damage: 'missing' },
        }));
        const collapsed = within(screen.getByTestId('card-additional-details-summary'));
        for (const label of ['Detected', 'Custom', 'Default', 'Missing']) {
            expect(collapsed.getByText(label)).toBeTruthy();
        }
        fireEvent.press(screen.getByTestId('card-additional-details-toggle'));
        const expanded = within(screen.getByTestId('card-location-sources'));
        for (const label of ['Detected', 'Custom', 'Default', 'Missing']) {
            expect(expanded.getByText(label)).toBeTruthy();
        }
    });
    it('disables compact editing without a saved review or Save permission', () => {
        const screen = renderCard(reviewCard({
            review: null, reviewVersion: null, reviewReady: false,
            allowedActions: ['view_metadata'],
        }));
        expect(screen.getByLabelText('Edit title for Book 1: Matched Metadata Title')).toBeDisabled();
        expect(screen.getByLabelText('Edit authors for Book 1: Author A')).toBeDisabled();
        expect(screen.getByTestId('card-price-field')).toBeDisabled();
        fireEvent.press(screen.getByTestId('card-additional-details-toggle'));
        expect(screen.getByTestId('card-location-field')).toBeDisabled();
        expect(screen.onDraftChange).not.toHaveBeenCalled();
    });

    it('offers Add for a valid unsaved review with Save authority and blocks saved Save-only no-ops', () => {
        const unsaved = reviewCard({
            review: null, reviewVersion: null, reviewReady: false,
            allowedActions: ['save_review'],
        });
        const props = {
            identity: { userId: testUuid(90), storeId: testUuid(91) },
            card: unsaved,
            defaults: { ...defaults, condition: 'good' as const, priceMinor: 25000 },
            isOffline: false, canMutate: true, removePending: false, addPending: false,
            onOpenFullCorrection: jest.fn(), onRemove: jest.fn(),
            onAdd: jest.fn(async () => ({ status: 'succeeded' as const })),
            onDraftChange: jest.fn(),
        };
        const screen = render(<BatchReviewCard {...props} />);
        expect(screen.getByText('Add to inventory')).not.toBeDisabled();

        const saved = reviewCard({ allowedActions: ['save_review'] });
        screen.rerender(<BatchReviewCard {...props} card={saved} />);
        expect(screen.getByText('Add to inventory')).toBeDisabled();
    });

    it.each([
        ['title', 'Edit title for Book 1: Matched Metadata Title', 'card-title-input',
            'Owner buffered title', 'originalTitle'],
        ['authors', 'Edit authors for Book 1: Author A', 'card-author-0',
            'Owner buffered author', 'authors'],
    ] as const)('holds individual Add while %s text is buffered, then submits the finished edit',
        async (_field, editLabel, inputId, newText, reviewField) => {
            const screen = renderCard();
            fireEvent.press(screen.getByLabelText(editLabel));
            fireEvent.changeText(screen.getByTestId(inputId), newText);
            expect(screen.getByText('Add to inventory')).toBeDisabled();
            fireEvent.press(screen.getByText('Add to inventory'));
            expect(screen.onAdd).not.toHaveBeenCalled();
            expect(screen.onDraftChange).not.toHaveBeenCalled();

            if (reviewField === 'originalTitle') fireEvent(screen.getByTestId(inputId), 'blur');
            else fireEvent.press(screen.getByLabelText('Done editing authors'));
            expect(screen.getByText('Add to inventory')).not.toBeDisabled();
            await act(async () => {
                fireEvent.press(screen.getByText('Add to inventory'));
                await Promise.resolve();
            });
            expect(screen.onAdd).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ [reviewField]: reviewField === 'authors' ? [newText] : newText }),
                expect.objectContaining({ [reviewField]: reviewField === 'authors' ? [newText] : newText }),
            );
        });

    it('holds buffered title text behind compare and Reapply when server authority changes', () => {
        const initial = reviewCard();
        const props = {
            identity: { userId: testUuid(90), storeId: testUuid(91) },
            card: initial, defaults, isOffline: false, canMutate: true,
            removePending: false, addPending: false,
            onOpenFullCorrection: jest.fn(), onRemove: jest.fn(),
            onAdd: jest.fn(async () => ({ status: 'succeeded' as const })),
            onDraftChange: jest.fn(), onAuthorityStateChange: jest.fn(),
        };
        const screen = render(<BatchReviewCard {...props} />);
        fireEvent.press(screen.getByLabelText('Edit title for Book 1: Matched Metadata Title'));
        fireEvent.changeText(screen.getByTestId('card-title-input'), 'Owner buffered title');
        const latest = reviewCard({ candidateVersion: 3,
            review: { ...initial.review!, originalTitle: 'Server title' },
            fieldSources: { ...initial.fieldSources, title: 'custom' },
        });
        screen.rerender(<BatchReviewCard {...props} card={latest} />);
        expect(screen.getByTestId('compact-authority-changed')).toBeTruthy();
        expect(screen.getByText('Add to inventory')).toBeDisabled();
        expect(props.onDraftChange).not.toHaveBeenCalled();
        fireEvent.press(screen.getByText('Reapply compact edits'));
        expect(props.onDraftChange).toHaveBeenCalledWith(initial.candidateId,
            expect.objectContaining({ originalTitle: 'Owner buffered title' }));
        expect(screen.getByText('Owner buffered title')).toBeTruthy();
    });

    it('reapplies a title returned to its old value while its editor stays open', () => {
        const initial = reviewCard();
        const props = {
            identity: { userId: testUuid(90), storeId: testUuid(91) },
            card: initial, defaults, isOffline: false, canMutate: true,
            removePending: false, addPending: false,
            onOpenFullCorrection: jest.fn(), onRemove: jest.fn(),
            onAdd: jest.fn(async () => ({ status: 'succeeded' as const })),
            onDraftChange: jest.fn(), onAuthorityStateChange: jest.fn(),
        };
        const screen = render(<BatchReviewCard {...props} />);
        fireEvent.press(screen.getByLabelText('Edit title for Book 1: Matched Metadata Title'));
        fireEvent.changeText(screen.getByTestId('card-title-input'), 'Temporary title');
        fireEvent.changeText(screen.getByTestId('card-title-input'), 'Matched Metadata Title');
        screen.rerender(<BatchReviewCard {...props} card={reviewCard({ candidateVersion: 3,
            review: { ...initial.review!, originalTitle: 'Server title' },
        })} />);
        fireEvent.press(screen.getByText('Reapply compact edits'));
        expect(props.onDraftChange).toHaveBeenCalledWith(initial.candidateId,
            expect.objectContaining({ originalTitle: 'Matched Metadata Title' }));
        expect(screen.getByText('Matched Metadata Title')).toBeTruthy();
    });

    it('reapplies an author returned to its old value while its editor stays open', () => {
        const initial = reviewCard();
        const props = {
            identity: { userId: testUuid(90), storeId: testUuid(91) },
            card: initial, defaults, isOffline: false, canMutate: true,
            removePending: false, addPending: false,
            onOpenFullCorrection: jest.fn(), onRemove: jest.fn(),
            onAdd: jest.fn(async () => ({ status: 'succeeded' as const })),
            onDraftChange: jest.fn(), onAuthorityStateChange: jest.fn(),
        };
        const screen = render(<BatchReviewCard {...props} />);
        fireEvent.press(screen.getByLabelText('Edit authors for Book 1: Author A'));
        fireEvent.changeText(screen.getByTestId('card-author-0'), 'Temporary author');
        fireEvent.changeText(screen.getByTestId('card-author-0'), 'Author A');
        screen.rerender(<BatchReviewCard {...props} card={reviewCard({ candidateVersion: 3,
            review: { ...initial.review!, authors: ['Server author'] },
        })} />);
        fireEvent.press(screen.getByText('Reapply compact edits'));
        expect(props.onDraftChange).toHaveBeenCalledWith(initial.candidateId,
            expect.objectContaining({ authors: ['Author A'] }));
        expect(screen.getByText('Author A')).toBeTruthy();
    });

    it('clears the pending identity marker when an open card unmounts', () => {
        const onPendingIdentityChange = jest.fn();
        const screen = render(
            <BatchReviewCard identity={{ userId: testUuid(90), storeId: testUuid(91) }}
                card={reviewCard()} defaults={defaults} isOffline={false} canMutate
                removePending={false} addPending={false}
                onOpenFullCorrection={jest.fn()} onRemove={jest.fn()}
                onAdd={jest.fn(async () => ({ status: 'succeeded' as const }))}
                onDraftChange={jest.fn()}
                onPendingIdentityChange={onPendingIdentityChange} />,
        );
        fireEvent.press(screen.getByLabelText('Edit title for Book 1: Matched Metadata Title'));
        expect(onPendingIdentityChange).toHaveBeenLastCalledWith(
            reviewCard().candidateId, true, '2:3:1',
        );
        screen.unmount();
        expect(onPendingIdentityChange).toHaveBeenLastCalledWith(
            reviewCard().candidateId, false, '2:3:1',
        );
    });

    it('discards buffered author text when Use latest is selected after authority changes', () => {
        const initial = reviewCard();
        const props = {
            identity: { userId: testUuid(90), storeId: testUuid(91) },
            card: initial, defaults, isOffline: false, canMutate: true,
            removePending: false, addPending: false,
            onOpenFullCorrection: jest.fn(), onRemove: jest.fn(),
            onAdd: jest.fn(async () => ({ status: 'succeeded' as const })),
            onDraftChange: jest.fn(), onAuthorityStateChange: jest.fn(),
        };
        const screen = render(<BatchReviewCard {...props} />);
        fireEvent.press(screen.getByLabelText('Edit authors for Book 1: Author A'));
        fireEvent.changeText(screen.getByTestId('card-author-0'), 'Owner buffered author');
        const latest = reviewCard({ candidateVersion: 3,
            review: { ...initial.review!, authors: ['Server author'] },
            fieldSources: { ...initial.fieldSources, authors: 'custom' },
        });
        screen.rerender(<BatchReviewCard {...props} card={latest} />);
        expect(screen.getByTestId('compact-authority-changed')).toBeTruthy();
        expect(props.onDraftChange).not.toHaveBeenCalled();
        fireEvent.press(screen.getByText('Use latest saved review'));
        expect(screen.getByText('Server author')).toBeTruthy();
        expect(screen.queryByText('Owner buffered author')).toBeNull();
    });

    it('reapplies buffered author text only after choosing Reapply', () => {
        const initial = reviewCard();
        const props = {
            identity: { userId: testUuid(90), storeId: testUuid(91) },
            card: initial, defaults, isOffline: false, canMutate: true,
            removePending: false, addPending: false,
            onOpenFullCorrection: jest.fn(), onRemove: jest.fn(),
            onAdd: jest.fn(async () => ({ status: 'succeeded' as const })),
            onDraftChange: jest.fn(), onAuthorityStateChange: jest.fn(),
        };
        const screen = render(<BatchReviewCard {...props} />);
        fireEvent.press(screen.getByLabelText('Edit authors for Book 1: Author A'));
        fireEvent.changeText(screen.getByTestId('card-author-0'), 'Owner buffered author');
        const latest = reviewCard({ candidateVersion: 3,
            review: { ...initial.review!, authors: ['Server author'] },
            fieldSources: { ...initial.fieldSources, authors: 'custom' },
        });
        screen.rerender(<BatchReviewCard {...props} card={latest} />);
        expect(props.onDraftChange).not.toHaveBeenCalled();
        fireEvent.press(screen.getByText('Reapply compact edits'));
        expect(props.onDraftChange).toHaveBeenCalledWith(initial.candidateId,
            expect.objectContaining({ authors: ['Owner buffered author'] }));
        expect(screen.getByText('Owner buffered author')).toBeTruthy();
    });

    it('keeps fields editable when new authority arrives without a local draft', () => {
        const initial = reviewCard();
        const props = {
            identity: { userId: testUuid(90), storeId: testUuid(91) },
            card: initial, defaults, isOffline: false, canMutate: true,
            removePending: false, addPending: false,
            onOpenFullCorrection: jest.fn(), onRemove: jest.fn(),
            onAdd: jest.fn(async () => ({ status: 'succeeded' as const })),
            onDraftChange: jest.fn(),
        };
        const screen = render(<BatchReviewCard {...props} />);
        screen.rerender(<BatchReviewCard {...props} card={reviewCard({ candidateVersion: 3 })} />);
        expect(screen.queryByTestId('compact-authority-changed')).toBeNull();
        expect(screen.getByLabelText('Edit title for Book 1: Matched Metadata Title')).not.toBeDisabled();
        expect(screen.getByTestId('card-price-field')).not.toBeDisabled();
    });
    it('does not create a Custom draft when title or authors are closed unchanged', () => {
        const screen = renderCard();
        screen.onDraftChange.mockClear();

        fireEvent.press(screen.getByLabelText('Edit title for Book 1: Matched Metadata Title'));
        fireEvent(screen.getByTestId('card-title-input'), 'blur');
        expect(screen.onDraftChange).not.toHaveBeenCalled();

        fireEvent.press(screen.getByLabelText('Edit authors for Book 1: Author A'));
        fireEvent.press(screen.getByLabelText('Done editing authors'));
        expect(screen.onDraftChange).not.toHaveBeenCalled();
        expect(screen.queryByText('Edited · saved when added')).toBeNull();
    });

    it('does not create a Custom draft for safe-text-equivalent whitespace edits', () => {
        const screen = renderCard();
        screen.onDraftChange.mockClear();

        fireEvent.press(screen.getByLabelText('Edit title for Book 1: Matched Metadata Title'));
        fireEvent.changeText(screen.getByTestId('card-title-input'), '  Matched   Metadata Title  ');
        fireEvent(screen.getByTestId('card-title-input'), 'blur');

        fireEvent.press(screen.getByLabelText('Edit authors for Book 1: Author A'));
        fireEvent.changeText(screen.getByTestId('card-author-0'), ' Author   A ');
        fireEvent.press(screen.getByLabelText('Done editing authors'));

        expect(screen.onDraftChange).not.toHaveBeenCalled();
        expect(screen.queryByText('Edited · saved when added')).toBeNull();
    });

    it('does not create a Custom draft for NFC-equivalent title and author edits', () => {
        const base = reviewCard();
        if (!base.review) throw new Error('Review fixture must be present.');
        const card = reviewCard({
            review: { ...base.review, originalTitle: 'Café', authors: ['Café'] },
            metadataSummary: {
                ...base.metadataSummary!, title: 'Café', authors: ['Café'],
            },
        });
        const screen = renderCard(card);
        screen.onDraftChange.mockClear();

        fireEvent.press(screen.getByLabelText('Edit title for Book 1: Café'));
        fireEvent.changeText(screen.getByTestId('card-title-input'), 'Cafe\u0301');
        fireEvent(screen.getByTestId('card-title-input'), 'blur');

        fireEvent.press(screen.getByLabelText('Edit authors for Book 1: Café'));
        fireEvent.changeText(screen.getByTestId('card-author-0'), 'Cafe\u0301');
        fireEvent.press(screen.getByLabelText('Done editing authors'));

        expect(screen.onDraftChange).not.toHaveBeenCalled();
        expect(screen.queryByText('Edited · saved when added')).toBeNull();
    });

    it('commits a real author change once when Done is pressed', () => {
        const screen = renderCard();
        screen.onDraftChange.mockClear();

        fireEvent.press(screen.getByLabelText('Edit authors for Book 1: Author A'));
        fireEvent.changeText(screen.getByTestId('card-author-0'), 'Author B');
        expect(screen.onDraftChange).not.toHaveBeenCalled();

        fireEvent.press(screen.getByLabelText('Done editing authors'));
        expect(screen.onDraftChange).toHaveBeenCalledTimes(1);
        expect(screen.onDraftChange).toHaveBeenCalledWith(
            reviewCard().candidateId,
            { authors: ['Author B'] },
        );
    });

    it('uses editable textbox semantics for title and bounded ordered author controls', () => {
        const screen = renderCard();
        const titleControl = screen.getByLabelText('Edit title for Book 1: Matched Metadata Title');
        expect(titleControl.props.accessibilityRole).toBe('button');
        fireEvent.press(titleControl);

        const titleInput = screen.getByTestId('card-title-input');
        expect(titleInput.props.accessibilityRole).toBeUndefined();
        expect(titleInput.props.maxLength).toBe(512);
        fireEvent.changeText(titleInput, 'Corrected title');
        fireEvent(titleInput, 'blur');

        const authorsControl = screen.getByLabelText('Edit authors for Book 1: Author A');
        expect(authorsControl.props.accessibilityRole).toBe('button');
        fireEvent.press(authorsControl);
        expect(screen.getByTestId('card-author-0').props.maxLength).toBe(256);

        fireEvent.press(screen.getByText('Add author'));
        fireEvent.changeText(screen.getByTestId('card-author-1'), 'Author B');
        expect(screen.onDraftChange).toHaveBeenCalledTimes(1);
        expect(screen.onDraftChange).toHaveBeenLastCalledWith(
            reviewCard().candidateId,
            { originalTitle: 'Corrected title' },
        );

        fireEvent.press(screen.getByLabelText('Remove author 2'));
        expect(screen.queryByTestId('card-author-1')).toBeNull();
        fireEvent.press(screen.getByLabelText('Done editing authors'));
        expect(screen.onDraftChange).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('card-authors-editor')).toBeNull();
    });

    it('keeps language, location, publication, and complete damage editing on the compact card', () => {
        const screen = renderCard();
        fireEvent.press(screen.getByTestId('card-additional-details-toggle'));
        expect(screen.getByText('Location · Publication · Language · Damage')).toBeTruthy();

        const details = screen.getByTestId('card-location-sources');
        ['location', 'publication', 'language', 'damage'].forEach((field) => {
            expect(within(details).getByTestId(`card-${field}-field`)).toBeTruthy();
        });

        fireEvent.press(within(details).getByTestId('card-language-field'));
        fireEvent.changeText(screen.getByTestId('card-language-search'), 'Hindi');
        fireEvent.press(screen.getByText('Hindi'));
        expect(screen.onDraftChange).toHaveBeenLastCalledWith(
            reviewCard().candidateId,
            expect.objectContaining({ originalLanguage: 'hi' }),
        );

        fireEvent.press(screen.getByTestId('card-location-field'));
        fireEvent.changeText(screen.getByTestId('card-custom-location'), 'Window display');
        fireEvent.press(screen.getByText('Use custom location'));
        expect(screen.getByText('Location: Window display')).toBeTruthy();

        fireEvent.press(screen.getByTestId('card-publication-field'));
        fireEvent.press(screen.getByText('Prepare to publish'));
        expect(screen.getByText('Publication: Prepare to publish')).toBeTruthy();

        fireEvent.press(screen.getByTestId('card-damage-field'));
        fireEvent.press(screen.getByText('Has damage'));
        fireEvent.press(screen.getByTestId('card-damage-type-cover'));
        fireEvent.changeText(screen.getByTestId('card-damage-note'), 'Bent corner');
        expect(screen.getByText('Types: Cover')).toBeTruthy();
        expect(screen.getByText('Note: Bent corner')).toBeTruthy();
        expect(screen.getAllByText('Complete, readable, and safe: Yes').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Sellable copy: Yes').length).toBeGreaterThan(0);
    });

    it('shows but disables Add until the mounted compact draft is strict-valid', () => {
        const screen = renderCard(reviewCard({
            candidateState: 'needs_review', reviewVersion: null, review: null,
            reviewDisposition: null, reviewReady: false,
            blockers: [
                { code: 'price_invalid', candidateId: reviewCard().candidateId, inputId: null,
                    field: 'priceMinor', safeMessage: 'Price is required.' },
                { code: 'condition_missing', candidateId: reviewCard().candidateId, inputId: null,
                    field: 'baseCondition', safeMessage: 'Condition is required.' },
            ],
            fieldSources: {
                ...reviewCard().fieldSources, condition: 'missing', price: 'missing',
            },
            allowedActions: ['save_review'],
        }));

        expect(screen.getByText('Add to inventory')).toBeDisabled();
        expect(screen.getByTestId('card-add-validation')).toBeTruthy();

        fireEvent.press(screen.getByTestId('card-condition-field'));
        fireEvent.press(screen.getByText('Good'));
        fireEvent.press(screen.getByTestId('card-price-field'));
        fireEvent.press(screen.getByText('₹25'));

        expect(screen.getByText('Add to inventory')).not.toBeDisabled();
        expect(screen.queryByTestId('card-add-validation')).toBeNull();
    });

    it('updates the card status from the current draft after required fields are fixed', () => {
        const screen = renderCard(reviewCard({
            candidateState: 'needs_review', reviewVersion: null, review: null,
            reviewDisposition: null, reviewReady: false,
            blockers: [
                { code: 'price_invalid', candidateId: reviewCard().candidateId, inputId: null,
                    field: 'priceMinor', safeMessage: 'Price is required.' },
                { code: 'condition_missing', candidateId: reviewCard().candidateId, inputId: null,
                    field: 'baseCondition', safeMessage: 'Condition is required.' },
            ],
            fieldSources: {
                ...reviewCard().fieldSources, condition: 'missing', price: 'missing',
            },
            allowedActions: ['save_review'],
        }));

        expect(within(screen.getByTestId('card-review-status')).getByText('Needs attention')).toBeTruthy();
        fireEvent.press(screen.getByTestId('card-condition-field'));
        fireEvent.press(screen.getByText('Good'));
        fireEvent.press(screen.getByTestId('card-price-field'));
        fireEvent.press(screen.getByText('₹25'));

        expect(within(screen.getByTestId('card-review-status')).getByText('Ready')).toBeTruthy();
        expect(screen.queryByText('Price is required.')).toBeNull();
        expect(screen.queryByText('Condition is required.')).toBeNull();
        expect(screen.getByText('Edited · saved when added')).toBeTruthy();
        expect(screen.queryByText('Unsaved changes')).toBeNull();
    });

    it('opens one editor at a time and identifies the selected condition', () => {
        const screen = renderCard();
        fireEvent.press(screen.getByTestId('card-price-field'));
        expect(screen.getByTestId('card-price-picker')).toBeTruthy();
        fireEvent.press(screen.getByTestId('card-condition-field'));
        expect(screen.queryByTestId('card-price-picker')).toBeNull();
        const picker = screen.getByTestId('card-condition-picker');
        expect(within(picker).getByLabelText('Good').props.accessibilityState.selected).toBe(true);
        fireEvent.press(screen.getByLabelText('Close editor'));
        expect(screen.queryByTestId('card-condition-picker')).toBeNull();
    });

    it('makes inline editing discoverable and explains invalid title and custom price input', () => {
        const screen = renderCard();
        expect(screen.getByLabelText('Edit title for Book 1: Matched Metadata Title')).toBeTruthy();
        expect(screen.getByLabelText('Edit authors for Book 1: Author A')).toBeTruthy();

        fireEvent.press(screen.getByLabelText('Edit title for Book 1: Matched Metadata Title'));
        const titleInput = screen.getByTestId('card-title-input');
        fireEvent.changeText(titleInput, '');
        fireEvent(titleInput, 'blur');
        expect(screen.getByText(/Add a title\./)).toBeTruthy();

        fireEvent.press(screen.getByTestId('card-price-field'));
        fireEvent.changeText(screen.getByTestId('card-custom-rupees'), 'not a price');
        fireEvent.press(screen.getByLabelText('Use custom price'));
        expect(screen.getByText('Enter a whole-rupee amount.')).toBeTruthy();
    });
});
