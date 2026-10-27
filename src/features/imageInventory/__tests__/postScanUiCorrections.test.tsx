jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanupAsync, fireEvent, render, renderHook, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { OwnerUxClientError, ownerUxService } from '../api/ownerUxService';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { ownerBatchReviewService } from '../api/ownerBatchReviewService';
import { useOwnerBatchReview } from '../queries/ownerBatchReviewReads';
import { ownerBatchReviewKeys } from '../queries/ownerBatchReviewKeys';
import { pickerChoices, pickerCard, pickerDetail, pickerDefaults, deferred } from '../testing/editionPickerClientFixtures';
import { formatInrFromMinor } from '../scanSetup/scanSetupForm';
import { InventoryCommitCoordinator } from '../commit/inventoryCommitCoordinator';
import { useInventoryCommitCoordinator } from '../commit/useInventoryCommitCoordinator';
import { candidateCommitAuthorityKey } from '../commit/inventoryCommitPolicy';
import { resetOwnerRequestFence } from '../identity/ownerRequestFence';
import { acceptEditionChoices } from '../queries/ownerEditionPickerCache';
import { ownerEditionPickerKeys } from '../queries/ownerEditionPickerKeys';
import { imageInventoryKeys, resetImageInventoryIdentityForTests } from '../queries/ownerUxQueries';
import { editionChoices, editionMetadata } from '../../../../supabase/functions/__tests__/fixtures/phase9/editionPickerContracts';
import { BatchReviewCard } from '../components/BatchReviewCard';
import { AddCandidateToInventoryAction } from '../components/AddCandidateToInventoryAction';
import type { OwnerBatchReview, OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import { candidateDetailFixture, testUuid } from '../testing/ownerUxTestFixtures';

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

function renderCard(card: OwnerBatchReviewCard = reviewCard(),
    cardDefaults: Parameters<typeof BatchReviewCard>[0]['defaults'] = defaults) {
    const onDraftChange = jest.fn();
    const onAdd = jest.fn(async () => ({ status: 'succeeded' as const }));
    const screen = render(
        <BatchReviewCard
            identity={{ userId: testUuid(90), storeId: testUuid(91) }}
            card={card}
            defaults={cardDefaults}
            isOffline={false}
            canMutate
            removePending={false}
            addPending={false}
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
            onRemove: jest.fn(),
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
            onRemove: jest.fn(),
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
            onRemove: jest.fn(),
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
            onRemove: jest.fn(),
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
                removePending={false} addPending={false} onRemove={jest.fn()}
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
            onRemove: jest.fn(),
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
            onRemove: jest.fn(),
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
            onRemove: jest.fn(),
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

describe('card Ready badge uses the add-now rule', () => {
    it('shows Ready for a reset saved review that Add will re-save', () => {
        const screen = renderCard(reviewCard({ reviewReady: false, allowedActions: ['save_review'] }));

        expect(within(screen.getByTestId('card-review-status')).getByText('Ready')).toBeTruthy();
        expect(screen.getByText('Add to inventory')).not.toBeDisabled();
    });

    it('uses Needs details for the fall-through review label', () => {
        const screen = renderCard(reviewCard({ reviewReady: false, allowedActions: ['view_metadata'] }));
        expect(within(screen.getByTestId('card-review-status')).getByText('Needs details')).toBeTruthy();
        expect(screen.queryByText('Add to inventory')).toBeNull();
    });

    it('announces a changed review while keeping other eligibility messages', () => {
        const card = reviewCard();
        const props = { card, disabled: false, isOffline: false, pending: false, onAdd: jest.fn(),
            outcome: { candidateId: card.candidateId, status: 'no_longer_eligible' as const,
                stage: 'revalidate' as const, code: 'review_changed' } };
        const screen = render(<AddCandidateToInventoryAction {...props} />);
        const message = screen.getByText('This book changed. Check it and press Add again.');
        expect(message.props.accessibilityLiveRegion).toBe('polite');
        expect(screen.queryByText('This book is no longer eligible. Review the latest saved details.')).toBeNull();
        screen.rerender(<AddCandidateToInventoryAction {...props}
            outcome={{ ...props.outcome, code: 'P9_CANDIDATE_VERSION_CONFLICT' }} />);
        expect(screen.getByText('This book is no longer eligible. Review the latest saved details.')).toBeTruthy();
        expect(screen.queryByText('This book changed. Check it and press Add again.')).toBeNull();
    });

    it('keeps a different first-save conflict generic without confirmation evidence', () => {
        const card = reviewCard({ review: null, reviewVersion: null, metadataState: 'selected' });
        const outcome = { candidateId: card.candidateId, status: 'no_longer_eligible' as const,
            stage: 'save' as const, code: 'P9_STATE_CONFLICT' };
        const props = { card, disabled: false, isOffline: false, pending: false, onAdd: jest.fn(), outcome };
        const screen = render(<AddCandidateToInventoryAction {...props} />);
        expect(screen.queryByText(/Confirm the suggested edition first/)).toBeNull();
        expect(screen.getByText('This book is no longer eligible. Review the latest saved details.')).toBeTruthy();
        // Selected metadata alone cannot identify the reason for a Save conflict.
        screen.rerender(<AddCandidateToInventoryAction {...props} card={reviewCard({ metadataState: 'selected' })} />);
        expect(screen.getByText('This book is no longer eligible. Review the latest saved details.')).toBeTruthy();
        screen.rerender(<AddCandidateToInventoryAction {...props}
            outcome={{ ...outcome, code: 'P9_CANDIDATE_VERSION_CONFLICT' }} />);
        expect(screen.getByText('This book is no longer eligible. Review the latest saved details.')).toBeTruthy();
    });

    it('asks the Owner to check the latest details after a refusal before any request', () => {
        const card = reviewCard();
        const screen = render(<AddCandidateToInventoryAction card={card} disabled={false} isOffline={false}
            pending={false} onAdd={jest.fn()}
            outcome={{ candidateId: card.candidateId, status: 'no_longer_eligible', stage: 'claim' }} />);
        expect(screen.getByText('This book changed after your edits. Check the latest details and press Add again.')).toBeTruthy();
    });

    it('keeps Add enabled after review_changed and disabled after a version conflict', () => {
        const card = reviewCard();
        const props = { card, disabled: false, isOffline: false, pending: false, onAdd: jest.fn(),
            outcome: { candidateId: card.candidateId, status: 'no_longer_eligible' as const,
                stage: 'revalidate' as const, code: 'review_changed' } };
        const screen = render(<AddCandidateToInventoryAction {...props} />);
        expect(screen.getByText('Add to inventory')).not.toBeDisabled();
        fireEvent.press(screen.getByText('Add to inventory'));
        expect(props.onAdd).toHaveBeenCalledTimes(1);
        screen.rerender(<AddCandidateToInventoryAction {...props}
            outcome={{ ...props.outcome, code: 'P9_CANDIDATE_VERSION_CONFLICT' }} />);
        expect(screen.getByText('Add to inventory')).toBeDisabled();
        fireEvent.press(screen.getByText('Add to inventory'));
        expect(props.onAdd).toHaveBeenCalledTimes(1);
    });

    it('does not show Ready for a server-ready review that cannot be added', () => {
        const screen = renderCard(reviewCard({ allowedActions: ['view_metadata'] }));

        expect(within(screen.getByTestId('card-review-status')).queryByText('Ready')).toBeNull();
        expect(screen.queryByText('Add to inventory')).toBeNull();
    });

    it('shows Adding, not Ready, while the card is being added', () => {
        const screen = render(
            <BatchReviewCard
                identity={{ userId: testUuid(90), storeId: testUuid(91) }}
                card={reviewCard()} defaults={defaults} isOffline={false} canMutate
                removePending={false} addPending
                onRemove={jest.fn()} onAdd={jest.fn()} onDraftChange={jest.fn()}
            />,
        );

        expect(within(screen.getByTestId('card-review-status')).getByText('Adding')).toBeTruthy();
    });

    it('shows Ready, not the generic review blocker, for a complete unsaved draft that Add will save', () => {
        const screen = renderCard(reviewCard({
            candidateState: 'needs_review', reviewVersion: null, review: null,
            reviewDisposition: null, reviewReady: false,
            blockers: [{ code: 'review_missing', candidateId: reviewCard().candidateId, inputId: null,
                field: null, safeMessage: 'Review this book.' }],
            fieldSources: { ...reviewCard().fieldSources, price: 'default' },
            allowedActions: ['save_review'],
        }), { ...defaults, condition: 'good' as const, priceMinor: 25000 });

        expect(within(screen.getByTestId('card-review-status')).getByText('Ready')).toBeTruthy();
        expect(screen.queryByText(/Review this book\./)).toBeNull();
        expect(screen.getByText('Add to inventory')).not.toBeDisabled();
    });

    it('does not show Ready for a possible duplicate', () => {
        const screen = renderCard(reviewCard({ candidateState: 'possible_duplicate' }));

        expect(within(screen.getByTestId('card-review-status')).getByText('Needs attention')).toBeTruthy();
    });
});

it.each([
    [{ priceMinor: 0 }, 'Enter a price above ₹0.'],
    [{ baseCondition: undefined }, 'Choose a condition.'],
    [{ quantity: 0 }, 'Set a quantity from 1 to 10,000.'],
    [{ authors: [] }, 'Add an author.'],
] as const)('zero price card is not Ready (and other missing requirements): %p', (patch, message) => {
    const base = reviewCard();
    const value = { ...base, review: { ...base.review!, ...patch },
        fieldSources: { ...base.fieldSources, authors: 'custom' as const } } as OwnerBatchReviewCard;
    const screen = renderCard(value);
    expect(within(screen.getByTestId('card-review-status')).getByText('Needs attention')).toBeTruthy();
    expect(screen.getByText('• ' + message)).toBeTruthy();
    expect(screen.getByText('Add to inventory')).toBeDisabled();
    fireEvent.press(screen.getByText('Add to inventory'));
    expect(screen.onAdd).not.toHaveBeenCalled();
});


describe('Add refusal authority recovery', () => {
    const identity = { userId: testUuid(90), storeId: testUuid(91) };
    let client: QueryClient;
    beforeEach(() => {
        client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
        resetOwnerRequestFence(identity);
        resetImageInventoryIdentityForTests(identity);
    });
    afterEach(async () => { await cleanupAsync(); client.clear(); jest.restoreAllMocks(); });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    it('keeps other cards addable after one card Save refusal', async () => {
        const cards = [21, 22].map(id => reviewCard({ candidateId: testUuid(id), review: null,
            reviewVersion: null, reviewReady: false, allowedActions: ['save_review'] }));
        jest.spyOn(ownerUxService, 'updateCandidateReview').mockRejectedValue(
            new OwnerUxClientError('P9_STATE_CONFLICT', false, 'Automatic suggestion needs confirmation.'),
        );
        function MountedCards() {
            const coordinator = useInventoryCommitCoordinator(identity, cards[0].sessionId);
            return <>{cards.map(card => <BatchReviewCard key={card.candidateId} identity={identity} card={card}
                defaults={{ ...defaults, priceMinor: 15_000, condition: 'good' }} isOffline={false}
                canMutate={!coordinator.inFlight.has(card.candidateId) && !coordinator.isCommandActive(card.candidateId)}
                removePending={false} addPending={coordinator.inFlight.has(card.candidateId)}
                addOutcome={coordinator.outcomes.get(card.candidateId)} onRemove={jest.fn()} onDraftChange={jest.fn()}
                onAdd={(current, edits, review) => coordinator.addCandidate({ card: current, edits, review,
                    acceptedAuthorityKey: candidateCommitAuthorityKey(current) })} />)}</>;
        }
        const screen = render(<MountedCards />, { wrapper });
        const first = within(screen.getByTestId('card-' + cards[0].candidateId));
        const other = within(screen.getByTestId('card-' + cards[1].candidateId));
        expect(first.getByText('Add to inventory')).not.toBeDisabled();
        expect(other.getByText('Add to inventory')).not.toBeDisabled();
        await act(async () => { fireEvent.press(first.getByText('Add to inventory')); });
        expect(first.getByText('Add to inventory')).toBeDisabled();
        expect(other.getByText('Add to inventory')).not.toBeDisabled();
    });

    it.each(['individual', 'bulk'])('retires the %s hook refusal after accepted confirmation and forwards supplied selling edits', async (mode) => {
        const base = reviewCard();
        const card = reviewCard({ review: null, reviewVersion: null, reviewReady: false,
            allowedActions: ['save_review'] });
        const review = { ...base.review!, priceMinor: 31_000, baseCondition: 'acceptable' as const };
        const value = { card, review, edits: { priceMinor: review.priceMinor, baseCondition: review.baseCondition },
            acceptedAuthorityKey: candidateCommitAuthorityKey(card) };
        const save = jest.spyOn(ownerUxService, 'updateCandidateReview').mockRejectedValueOnce(
            new OwnerUxClientError('P9_STATE_CONFLICT', false, 'Session state blocks this Save.'),
        );
        const hook = renderHook(() => useInventoryCommitCoordinator(identity, card.sessionId), { wrapper });
        await act(async () => {
            if (mode === 'bulk') await hook.result.current.addAll([value]);
            else await hook.result.current.addCandidate(value);
        });
        const refused = hook.result.current.outcomes.get(card.candidateId);
        expect(refused).toMatchObject({ status: 'no_longer_eligible', stage: 'save' });
        const screen = render(<AddCandidateToInventoryAction card={card} disabled={false}
            isOffline={false} pending={false} outcome={refused} onAdd={jest.fn()} />);
        expect(screen.getByText('Add to inventory')).toBeDisabled();
        const choices = { ...editionChoices, sessionId: card.sessionId, candidateId: card.candidateId,
            candidateVersion: card.candidateVersion, metadataRevision: card.metadataRevision, reviewVersion: null };
        // Same-authority reads and other candidates cannot retire this refusal.
        await act(async () => {
            client.setQueryData(ownerEditionPickerKeys.choices(identity, card.sessionId, card.candidateId), choices);
            client.setQueryData(imageInventoryKeys.candidate(identity, card.sessionId, card.candidateId),
                candidateDetailFixture({ candidateVersion: 1, metadata: { ...candidateDetailFixture().metadata, revision: 1 } }));
            client.setQueryData(ownerEditionPickerKeys.choices(identity, card.sessionId, testUuid(22)),
                { ...choices, candidateId: testUuid(22), candidateVersion: 99 });
        });
        expect(hook.result.current.outcomes.get(card.candidateId)).toBe(refused);
        const confirmed = { ...choices, candidateVersion: card.candidateVersion + 1,
            metadataRevision: card.metadataRevision + 1, selection: {
                selectionId: testUuid(99), source: 'current_suggestion' as const,
                optionId: null, snapshot: editionMetadata, confirmedByOwner: true,
            } };
        await act(async () => {
            acceptEditionChoices(client, identity, card, confirmed, 'selection');
        });
        await waitFor(() => expect(hook.result.current.outcomes.has(card.candidateId)).toBe(false));
        screen.rerender(<AddCandidateToInventoryAction card={card} disabled={false}
            isOffline={false} pending={false} outcome={hook.result.current.outcomes.get(card.candidateId)} onAdd={jest.fn()} />);
        expect(screen.getByText('Add to inventory')).not.toBeDisabled();
        const latest = { ...card, candidateVersion: confirmed.candidateVersion, metadataRevision: confirmed.metadataRevision };
        const detail = candidateDetailFixture({ sessionId: card.sessionId, candidateId: card.candidateId,
            candidateState: 'ready', candidateVersion: latest.candidateVersion + 1,
            metadata: { ...candidateDetailFixture().metadata, state: 'selected', revision: latest.metadataRevision,
                selectionId: testUuid(99) }, review: { value: review, reviewVersion: 1 },
            readiness: { reviewReady: true, blockers: [], derivedFromCandidateVersion: latest.candidateVersion + 1,
                derivedFromMetadataRevision: latest.metadataRevision, derivedFromDuplicateAdviceVersion: null },
            allowedActions: ['save_review', 'add_to_inventory'] });
        save.mockResolvedValue(detail);
        jest.spyOn(ownerUxService, 'readCandidate').mockResolvedValue(detail);
        const commit = jest.spyOn(ownerUxService, 'addCandidateToInventory').mockResolvedValue({
            sessionId: card.sessionId, candidateId: card.candidateId, candidateVersion: detail.candidateVersion + 1,
            inventoryId: testUuid(80), inventoryVersion: 1, outcome: 'committed_private',
        });
        await act(async () => {
            await hook.result.current.addCandidate({ ...value, card: latest,
                acceptedAuthorityKey: candidateCommitAuthorityKey(latest) });
        });
        expect(hook.result.current.outcomes.get(card.candidateId)?.status).toBe('succeeded');
        expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ review: expect.objectContaining({
            priceMinor: 31_000, baseCondition: 'acceptable',
        }) }), expect.anything());
        expect(commit).toHaveBeenCalledTimes(1);
    });

    it.each(['individual revalidate', 'individual commit', 'bulk revalidate', 'bulk commit'])(
        'keeps the %s refusal at the authority saved by that same Add', async (scenario) => {
            const card = reviewCard();
            const review = { ...card.review!, priceMinor: 31_000 };
            const detail = candidateDetailFixture({ sessionId: card.sessionId, candidateId: card.candidateId,
                candidateState: 'ready', candidateVersion: card.candidateVersion + 1,
                metadata: { ...candidateDetailFixture().metadata, state: 'selected', revision: card.metadataRevision,
                    selectionId: testUuid(99) }, review: { value: review, reviewVersion: card.reviewVersion! + 1 },
                readiness: { reviewReady: true, blockers: [], derivedFromCandidateVersion: card.candidateVersion + 1,
                    derivedFromMetadataRevision: card.metadataRevision, derivedFromDuplicateAdviceVersion: null },
                allowedActions: ['save_review', 'add_to_inventory'] });
            const save = jest.spyOn(ownerUxService, 'updateCandidateReview').mockResolvedValue(detail);
            jest.spyOn(ownerUxService, 'readCandidate').mockResolvedValue(scenario.endsWith('revalidate')
                ? { ...detail, allowedActions: ['save_review'] } : detail);
            const commit = jest.spyOn(ownerUxService, 'addCandidateToInventory').mockRejectedValue(
                new OwnerUxClientError('P9_STATE_CONFLICT', false, 'Refused at saved authority.'),
            );
            const hook = renderHook(() => useInventoryCommitCoordinator(identity, card.sessionId), { wrapper });
            await act(async () => {
                const value = { card, edits: { priceMinor: review.priceMinor }, review,
                    acceptedAuthorityKey: candidateCommitAuthorityKey(card) };
                if (scenario.startsWith('bulk')) await hook.result.current.addAll([value]);
                else await hook.result.current.addCandidate(value);
            });
            expect(save).toHaveBeenCalledTimes(1);
            expect(commit).toHaveBeenCalledTimes(scenario.endsWith('commit') ? 1 : 0);
            const refusal = hook.result.current.outcomes.get(card.candidateId);
            expect(refusal).toMatchObject({ status: 'no_longer_eligible',
                stage: scenario.endsWith('commit') ? 'commit' : 'revalidate' });
            await act(async () => {
                client.setQueryData(imageInventoryKeys.candidate(identity, card.sessionId, card.candidateId), detail);
            });
            expect(hook.result.current.outcomes.get(card.candidateId)).toBe(refusal);
            await act(async () => {
                client.setQueryData(imageInventoryKeys.candidate(identity, card.sessionId, card.candidateId),
                    { ...detail, candidateVersion: detail.candidateVersion + 1 });
            });
            await waitFor(() => expect(hook.result.current.outcomes.has(card.candidateId)).toBe(false));
        });

    it.each(['current', 'missing', 'confirmed', 'old candidate', 'old metadata', 'old review',
        'other candidate', 'other session', 'other selection', 'other conflict'])(
        'uses conditional suggestion guidance only with current scoped evidence: %s', async (kind) => {
            const card = reviewCard();
            const choices = pickerChoices({ sessionId: card.sessionId, candidateId: card.candidateId,
                candidateVersion: card.candidateVersion, metadataRevision: card.metadataRevision,
                reviewVersion: card.reviewVersion, selection: { source: 'current_suggestion', optionId: null,
                    selectionId: testUuid(99), confirmedByOwner: kind === 'confirmed', snapshot: editionMetadata } });
            if (kind === 'missing') choices.selection = null;
            if (kind === 'old candidate') choices.candidateVersion -= 1;
            if (kind === 'old metadata') choices.metadataRevision -= 1;
            if (kind === 'old review') choices.reviewVersion = null;
            if (kind === 'other candidate') choices.candidateId = testUuid(22);
            if (kind === 'other session') choices.sessionId = testUuid(11);
            if (kind === 'other selection') choices.selection!.selectionId = testUuid(100);
            jest.spyOn(ownerEditionPickerService, 'readEditionChoices').mockResolvedValue(choices);
            const commandSlot = { claimSlot: jest.fn(() => 'slot'), releaseSlot: jest.fn(), isCommandActive: () => false };
            const screen = render(<BatchReviewCard identity={identity} card={card} defaults={defaults}
                isOffline={false} canMutate removePending={false} addPending={false} commandSlot={commandSlot}
                onAdd={jest.fn()} onRemove={jest.fn()} onDraftChange={jest.fn()}
                addOutcome={{ candidateId: card.candidateId, status: 'no_longer_eligible', stage: 'save',
                    code: kind === 'other conflict' ? 'P9_CANDIDATE_VERSION_CONFLICT' : 'P9_STATE_CONFLICT' }} />, { wrapper });
            await waitFor(() => expect(client.getQueryState(
                ownerEditionPickerKeys.choices(identity, card.sessionId, card.candidateId))?.fetchStatus).toBe('idle'));
            const guidance = 'Check the latest details. If this is the suggested edition, open Find or change edition and tap Confirm current suggestion.';
            if (kind === 'current') expect(screen.getByText(guidance)).toBeTruthy();
            else {
                expect(screen.queryByText(guidance)).toBeNull();
                expect(screen.getByText('This book is no longer eligible. Review the latest saved details.')).toBeTruthy();
            }
        });

    it('shows success without a draft conflict after refusal, picker confirmation, and its own first Save', async () => {
        let choices = pickerChoices({ selection: { selectionId: testUuid(30), source: 'current_suggestion',
            optionId: null, snapshot: { ...editionMetadata, title: 'Chosen edition', authors: ['Chosen author'] },
            confirmedByOwner: false } });
        let card = pickerCard(choices), detail = pickerDetail(choices);
        const cardDefaults = { ...pickerDefaults, priceMinor: null, condition: null, quantity: 1 as const };
        const batch = (): OwnerBatchReview => ({ sessionId: card.sessionId, status: 'active', sessionVersion: 1,
            presentationRevision: card.candidateVersion, defaults: cardDefaults, batchLabel: null,
            counts: { detected: 1, processing: 0, needsAttention: 0, reviewReadySaved: 0,
                committed: 0, ownerRemoved: 0, falseDetections: 0 }, items: [card], updatedAt: card.updatedAt });
        const confirmedRead = deferred<OwnerBatchReview>();
        let holdConfirmedRead = true;
        jest.spyOn(ownerBatchReviewService, 'readBatchReview').mockImplementation(async () =>
            choices.selection?.confirmedByOwner && holdConfirmedRead ? confirmedRead.promise : batch());
        jest.spyOn(ownerEditionPickerService, 'readEditionChoices').mockImplementation(async () => choices);
        jest.spyOn(ownerUxService, 'readCandidate').mockImplementation(async () => detail);
        const select = jest.spyOn(ownerEditionPickerService, 'selectEdition').mockImplementation(async () => {
            choices = { ...choices, candidateVersion: choices.candidateVersion + 1,
                metadataRevision: choices.metadataRevision + 1, selection: { ...choices.selection!, confirmedByOwner: true } };
            card = pickerCard(choices); detail = pickerDetail(choices);
            return choices;
        });
        const save = jest.spyOn(ownerUxService, 'updateCandidateReview').mockRejectedValueOnce(
            new OwnerUxClientError('P9_STATE_CONFLICT', false, 'Automatic suggestion needs confirmation.'),
        ).mockImplementation(async (request) => {
            choices = { ...choices, candidateVersion: choices.candidateVersion + 1, reviewVersion: 1 };
            card = pickerCard(choices, request.review); detail = pickerDetail(choices, request.review);
            return detail;
        });
        const committed = deferred<void>();
        const commit = jest.spyOn(ownerUxService, 'addCandidateToInventory').mockImplementation(async (request) => {
            await committed.promise;
            return {
                sessionId: request.sessionId, candidateId: request.candidateId, candidateVersion: request.expectedCandidateVersion + 1,
                inventoryId: testUuid(80), inventoryVersion: 1, outcome: 'committed_private' as const,
            };
        });
        const draftChange = jest.fn();
        function MountedCard() {
            const batchReview = useOwnerBatchReview(identity, choices.sessionId);
            const coordinator = useInventoryCommitCoordinator(identity, choices.sessionId);
            const current = batchReview.data?.items[0];
            return current ? <BatchReviewCard identity={identity} card={current} defaults={cardDefaults}
                isOffline={false} canMutate={!coordinator.inFlight.has(current.candidateId)} removePending={false}
                addPending={coordinator.inFlight.has(current.candidateId)} addOutcome={coordinator.outcomes.get(current.candidateId)}
                addAuthorities={coordinator.authorities.get(current.candidateId)}
                commandSlot={coordinator} onRemove={jest.fn()} onDraftChange={draftChange}
                onEditionSelection={() => { void batchReview.refetch(); }}
                onAdd={(card, edits, review) => coordinator.addCandidate({ card, edits, review,
                    acceptedAuthorityKey: candidateCommitAuthorityKey(card) })} /> : null;
        }
        const screen = render(<MountedCard />, { wrapper });
        await screen.findByTestId('card-price-field');
        expect(screen.getByText('Add to inventory')).toBeDisabled();
        fireEvent.press(screen.getByTestId('card-price-field'));
        fireEvent.changeText(screen.getByTestId('card-custom-rupees'), '150');
        fireEvent.press(screen.getByLabelText('Use custom price'));
        fireEvent.press(screen.getByTestId('card-condition-field'));
        fireEvent.press(screen.getByLabelText('Good'));
        expect(screen.getByTestId('card-review-status')).toHaveProp('accessibilityLabel', 'Ready');
        await act(async () => { fireEvent.press(screen.getByText('Add to inventory')); });
        await screen.findByText('Check the latest details. If this is the suggested edition, open Find or change edition and tap Confirm current suggestion.');
        expect(screen.getByText('Add to inventory')).toBeDisabled();
        fireEvent.press(screen.getByText('Find or change edition'));
        await screen.findByText('Confirm current suggestion');
        await act(async () => { fireEvent.press(screen.getByText('Confirm current suggestion')); });
        await screen.findByText('Edition saved.');
        expect(select).toHaveBeenCalledWith(expect.objectContaining({ source: 'current_suggestion',
            selectionId: testUuid(30), expectedCandidateVersion: 4, expectedMetadataRevision: 7 }), expect.anything());
        expect(draftChange).toHaveBeenLastCalledWith(card.candidateId, expect.objectContaining({
            priceMinor: 15_000, baseCondition: 'good', metadataChoice: { mode: 'edition_option', selectionId: testUuid(30) },
        }), candidateCommitAuthorityKey(card));
        fireEvent.press(screen.getByText('Close metadata'));
        // Choice adoption alone cannot bypass the batch card's current-authority gate.
        expect(screen.getByText('Add to inventory')).toBeDisabled();
        await act(async () => { holdConfirmedRead = false; confirmedRead.resolve(batch()); });
        await waitFor(() => expect(screen.getByText('Add to inventory')).not.toBeDisabled());
        expect(screen.queryByTestId('compact-authority-changed')).toBeNull();
        expect(screen.getByTestId('card-price-overlay')).toBeTruthy();
        expect(screen.getByTestId('card-condition-overlay')).toBeTruthy();
        expect(within(screen.getByTestId('card-price-field')).getByText(formatInrFromMinor(15_000))).toBeTruthy();
        expect(within(screen.getByTestId('card-condition-field')).getByText('Good')).toBeTruthy();
        await act(async () => { fireEvent.press(screen.getByText('Add to inventory')); });
        await waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
        card = { ...card, candidateState: 'commit_in_progress', allowedActions: [] };
        await act(async () => {
            await client.invalidateQueries({ queryKey: ownerBatchReviewKeys.batchReview(identity, card.sessionId) });
        });
        await waitFor(() => expect(screen.getByTestId('card-review-status')).toHaveProp('accessibilityLabel', 'Adding'));
        expect(screen.queryByTestId('compact-authority-changed')).toBeNull();
        await act(async () => { committed.resolve(); });
        await screen.findByText('Added to Inventory');
        expect(screen.queryByTestId('compact-authority-changed')).toBeNull();
        expect(screen.getByTestId('card-review-status')).toHaveProp('accessibilityLabel', 'Added');
        expect(save).toHaveBeenCalledTimes(2);
        expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ review: expect.objectContaining({
            priceMinor: 15_000, baseCondition: 'good',
            metadataChoice: { mode: 'edition_option', selectionId: testUuid(30) },
        }) }), expect.anything());
        expect(commit).toHaveBeenCalledTimes(1);
    });

    it.each(['succeeded', 'still_pending', 'failed_retryable'] as const)(
        'keeps a %s outcome when authority advances', async (status) => {
            const card = reviewCard();
            const outcome = { candidateId: card.candidateId, status, stage: 'commit' as const };
            jest.spyOn(InventoryCommitCoordinator.prototype, 'addCandidate').mockResolvedValue(outcome);
            const hook = renderHook(() => useInventoryCommitCoordinator(identity, card.sessionId), { wrapper });
            await act(async () => { await hook.result.current.addCandidate({ card, edits: {},
                acceptedAuthorityKey: candidateCommitAuthorityKey(card) }); });
            await act(async () => {
                client.setQueryData(ownerEditionPickerKeys.choices(identity, card.sessionId, card.candidateId), {
                    ...editionChoices, sessionId: card.sessionId, candidateId: card.candidateId,
                    candidateVersion: card.candidateVersion + 1, metadataRevision: card.metadataRevision + 1,
                    reviewVersion: card.reviewVersion! + 1,
                });
            });
            expect(hook.result.current.outcomes.get(card.candidateId)).toBe(outcome);
        });

    it.each(['candidateVersion', 'metadataRevision', 'reviewVersion'] as const)(
        'retires a claim refusal when only %s advances', async (field) => {
            const card = reviewCard();
            const hook = renderHook(() => useInventoryCommitCoordinator(identity, card.sessionId), { wrapper });
            await act(async () => { await hook.result.current.addCandidate({ card, edits: {}, acceptedAuthorityKey: 'stale' }); });
            expect(hook.result.current.outcomes.get(card.candidateId)?.stage).toBe('claim');
            await act(async () => {
                client.setQueryData(ownerEditionPickerKeys.choices(identity, card.sessionId, card.candidateId), {
                    ...editionChoices, sessionId: card.sessionId, candidateId: card.candidateId,
                    candidateVersion: card.candidateVersion, metadataRevision: card.metadataRevision,
                    reviewVersion: card.reviewVersion, [field]: card[field]! + 1,
                });
            });
            await waitFor(() => expect(hook.result.current.outcomes.has(card.candidateId)).toBe(false));
        });
});
