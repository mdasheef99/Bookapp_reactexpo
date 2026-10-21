import { act, fireEvent, render, within } from '@testing-library/react-native';
import {
    applyCompactEdits,
    BatchReviewCard,
} from '../components/BatchReviewCard';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { CandidateCommitOutcome } from '../commit/inventoryCommitCoordinator';
import { candidateDetailFixture, testUuid } from '../testing/ownerUxTestFixtures';

let mockMetadataDetail = candidateDetailFixture();
let mockEditionChoices: import('../contracts/ownerEditionPicker').EditionChoices | undefined;
import { selectedChoices } from '../testing/editionPickerClientFixtures';
import { cardAttentionItems } from '../components/batchReviewStatus';
jest.mock('../components/EditionChoicesReader', () => ({ EditionChoicesReader: ({ onChoices }: any) => {
    const React = require('react');
    React.useEffect(() => { if (mockEditionChoices) onChoices(mockEditionChoices); }, [onChoices]);
    return null;
} }));

// Presentation-boundary stand-in so cover rendering stays assertable.
jest.mock('expo-image', () => ({
    Image: (props: Record<string, unknown>) => {
        const { Text } = require('react-native') as typeof import('react-native');
        const { createElement } = require('react') as typeof import('react');
        return createElement(Text, null, String(props.accessibilityLabel));
    },
}));
jest.mock('../queries/ownerUxQueries', () => ({
    useOwnerInventoryCandidate: () => ({
        data: mockMetadataDetail,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
    }),
}));

const onRemove = jest.fn();
const onSaveEdits = jest.fn();
const onAdd = jest.fn(() => Promise.resolve({ status: 'succeeded' as const }));
const onDraftChange = jest.fn();

function card(overrides: Record<string, unknown> = {}): OwnerBatchReviewCard {
    return {
        sessionId: '00000000-0000-4000-8000-000000000010',
        candidateId: '00000000-0000-4000-8000-000000000021',
        inputId: '00000000-0000-4000-8000-000000000001',
        ordinal: 1,
        candidateState: 'ready',
        candidateVersion: 2,
        metadataState: 'selected',
        metadataRevision: 3,
        reviewVersion: 1,
        reviewDisposition: null,
        observed: {
            title: 'Observed Title',
            authors: ['Author A'],
            language: 'en',
            script: 'Latn',
        },
        metadataSummary: {
            title: 'Matched Metadata Title',
            authors: ['Author A'],
            language: 'en',
            coverReference: 'https://books.google.com/books/content?id=x&printsec=frontcover',
        },
        review: {
            originalTitle: 'Observed Title',
            authors: ['Author A'],
            originalLanguage: 'en',
            script: 'Latn',
            metadataChoice: { mode: 'selected', selectionId: '00000000-0000-4000-8000-000000000099' },
            quantity: 1,
            priceMinor: 25000,
            baseCondition: 'good',
            damageDisclosure: {
                hasDamage: false, damageTypes: [], damageNote: null,
                isSellable: true, completeReadableSafe: true,
            },
            shelfLocation: 'Front shelf',
            notes: { publicNote: 'keep me', internalNote: null },
            publicationIntent: 'private',
            duplicateIntent: null,
            originalFieldConfirmation: { title: true, authors: [true] },
            candidateDisposition: 'reviewed',
        },
        fieldSources: {
            cover: 'matched', title: 'matched', authors: 'matched',
            language: 'default', condition: 'default', price: 'custom',
            quantity: 'default', location: 'default', publication: 'default',
            damage: 'default',
        },
        attentionCodes: [],
        blockers: [],
        reviewReady: true,
        allowedActions: ['save_review', 'view_metadata', 'remove_from_scan'],
        updatedAt: '2026-08-24T00:00:00.000Z',
        ...overrides,
    } as unknown as OwnerBatchReviewCard;
}

const defaults = {
    languageHint: 'en', condition: null, location: 'Front shelf',
    priceMinor: null, quantity: 1, publication: 'private' as const, script: null,
    batchLabel: '',
};

function renderCard(overrides: Record<string, unknown> = {}) {
    return render(
        <BatchReviewCard
            identity={{ userId: testUuid(90), storeId: testUuid(91) }}
            card={card(overrides)}
            defaults={defaults}
            isOffline={false}
            canMutate

            onRemove={onRemove}
            onAdd={onAdd}
            removePending={false}
            addPending={false}
            onDraftChange={onDraftChange}
        />,
    );
}

it('shows only Finding the edition while pending despite saved server blockers', () => {
    const pending = { field: 'metadataChoice' as const, safeMessage: 'Finding the edition…' };
    const value = card({ metadataState: 'pending', blockers: [{ code: 'metadata_choice_missing',
        field: 'metadataChoice', safeMessage: 'Choose metadata before adding.' }] });
    expect(cardAttentionItems({ card: value, hasEdits: false, validationIssues: [pending] })).toEqual([pending]);
    const view = renderCard(value);
    expect(view.getByText('• Finding the edition…')).toBeTruthy();
    expect(view.queryByText('• Choose metadata before adding.')).toBeNull();
});

it('shows the chosen edition summary until edition choices load', () => {
    mockEditionChoices = undefined;
    const view = renderCard({ metadataSummary: { ...card().metadataSummary, title: 'Observed Title' } });
    expect(view.getByText('Edition chosen')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Edit title for Book 1: Observed Title'));
    fireEvent.changeText(view.getByTestId('card-title-input'), 'Changed title');
    fireEvent(view.getByTestId('card-title-input'), 'blur');
    expect(view.getByText('No edition chosen — title or author changed')).toBeTruthy();
});

it('shows only pending attention and a pending edition line with ready stale choices', () => {
    const choices = selectedChoices();
    mockEditionChoices = choices;
    const value = card({ sessionId: choices.sessionId, candidateId: choices.candidateId,
        metadataState: 'pending', blockers: [{ code: 'metadata_choice_missing',
            field: 'metadataChoice', safeMessage: 'Choose metadata before adding.' }] });
    const view = render(<BatchReviewCard identity={{ userId: testUuid(90), storeId: testUuid(91) }}
        card={value} defaults={defaults} canMutate isOffline={false} removePending={false} addPending={false}
        commandSlot={{ claimSlot: () => 'slot', releaseSlot: jest.fn(), isCommandActive: () => false }}
        onRemove={onRemove} onAdd={onAdd} onDraftChange={onDraftChange} />);
    expect(view.getByText('• Finding the edition…')).toBeTruthy();
    expect(view.getByText('Finding edition…')).toBeTruthy();
    expect(view.queryByText('Ready')).toBeNull();
    mockEditionChoices = undefined;
});

it.each(['selection', 'session', 'candidate', 'manual'] as const)('does not display an untrusted %s edition snapshot', mismatch => {
    const choices = selectedChoices({ sessionId: card().sessionId, candidateId: card().candidateId });
    choices.selection = { ...choices.selection!, snapshot: { ...choices.selection!.snapshot, publisher: 'Stale publisher' } };
    const value = card({ metadataSummary: { ...choices.selection.snapshot, selectionId: choices.selection.selectionId },
        review: { ...card().review!, originalTitle: 'Title B',
            metadataChoice: mismatch === 'manual' ? { mode: 'manual', selectionId: null }
                : { mode: 'selected', selectionId: mismatch === 'selection' ? testUuid(99) : choices.selection.selectionId } } });
    if (mismatch === 'session') choices.sessionId = testUuid(98);
    if (mismatch === 'candidate') choices.candidateId = testUuid(98);
    mockEditionChoices = choices;
    const view = render(<BatchReviewCard identity={{ userId: testUuid(90), storeId: testUuid(91) }}
        card={value} defaults={defaults} canMutate isOffline={false} removePending={false} addPending={false}
        commandSlot={{ claimSlot: () => 'slot', releaseSlot: jest.fn(), isCommandActive: () => false }}
        onRemove={onRemove} onAdd={onAdd} onDraftChange={onDraftChange} />);
    expect(view.queryByText('Stale publisher · 2002')).toBeNull();
    expect(view.getByText('Edition chosen')).toBeTruthy();
    mockEditionChoices = undefined;
});

it('shows the identity-changed edition line for an untrusted snapshot after a title edit', () => {
    const choices = selectedChoices({ sessionId: card().sessionId, candidateId: card().candidateId });
    mockEditionChoices = choices;
    const value = card({ metadataSummary: { ...card().metadataSummary, title: 'Observed Title' } });
    const view = render(<BatchReviewCard identity={{ userId: testUuid(90), storeId: testUuid(91) }}
        card={value} defaults={defaults} canMutate isOffline={false} removePending={false} addPending={false}
        commandSlot={{ claimSlot: () => 'slot', releaseSlot: jest.fn(), isCommandActive: () => false }}
        onRemove={onRemove} onAdd={onAdd} onDraftChange={onDraftChange} />);
    expect(view.getByText('Edition chosen')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Edit title for Book 1: Observed Title'));
    fireEvent.changeText(view.getByTestId('card-title-input'), 'Changed title');
    fireEvent(view.getByTestId('card-title-input'), 'blur');
    expect(view.getByText('No edition chosen — title or author changed')).toBeTruthy();
    mockEditionChoices = undefined;
});

describe('Phase 9 NEW 6G-C compact review card', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockMetadataDetail = candidateDetailFixture({
            sessionId: card().sessionId,
            candidateId: card().candidateId,
            observed: card().observed,
        });
    });

    it('removes identity source chips while keeping value source cues', () => {
        const screen = renderCard({
            fieldSources: {
                cover: 'matched', title: 'detected', authors: 'missing',
                language: 'default', condition: 'custom', price: 'missing',
                quantity: 'default', location: 'default', publication: 'default',
                damage: 'default',
            },
        });
        const badges = screen.getAllByText(/^(Detected|Default|Custom|Missing)$/u)
            .map((node) => node.props.children);
        expect(badges).not.toContain('Detected');
        expect(badges).toContain('Default');
        expect(badges).toContain('Custom');
        expect(badges).toContain('Missing');
    });

    it('never renders a Detected or Matched source for location', () => {
        const screen = renderCard({
            fieldSources: {
                cover: 'matched', title: 'matched', authors: 'matched',
                language: 'detected', condition: 'default', price: 'default',
                quantity: 'default', location: 'default', publication: 'default',
                damage: 'default',
            },
        });
        expect(screen.queryByTestId('card-location-sources')).toBeNull();
        fireEvent.press(screen.getByTestId('card-additional-details-toggle'));
        const locationRow = screen.getByTestId('card-location-sources');
        expect(within(locationRow).getByText('Location: Front shelf')).toBeTruthy();
        expect(within(screen.getByTestId('card-location-field')).queryByText('Detected')).toBeNull();
        expect(within(locationRow).getAllByText('Default')).toHaveLength(3);
    });

    it('keeps compact edits local until Add and round-trips hidden notes through that strict Save', async () => {
        const screen = renderCard();
        fireEvent.press(screen.getByTestId('card-condition-field'));
        fireEvent.press(screen.getByText('Acceptable'));
        expect(screen.queryByText('Save changes')).toBeNull();
        expect(onSaveEdits).not.toHaveBeenCalled();
        await act(async () => {
            fireEvent.press(screen.getByText('Add to inventory'));
            await Promise.resolve();
        });
        expect(onAdd).toHaveBeenCalledWith(
            expect.objectContaining({ candidateId: card().candidateId }),
            { baseCondition: 'acceptable' },
            expect.objectContaining({ baseCondition: 'acceptable' }),
        );
        // The parent applies compact edits onto the complete saved review so
        // hidden notes round-trip unchanged through the strict Save.
        const saved = card().review as Record<string, unknown>;
        const merged = applyCompactEdits(saved, { baseCondition: 'acceptable' });
        expect(merged.baseCondition).toBe('acceptable');
        expect(merged.notes).toEqual({ publicNote: 'keep me', internalNote: null });
        expect(merged.candidateDisposition).toBe('reviewed');
    });

    it('replaces the persisted badge with a presentation-only local Custom marker for an unsaved edit', () => {
        const screen = renderCard({ fieldSources: card().fieldSources });
        fireEvent.press(screen.getByTestId('card-condition-field'));
        fireEvent.press(screen.getByText('Very Good'));
        expect(screen.getByTestId('card-condition-overlay').props.children).toBe('Custom');
        // The overlay alone cannot manufacture commit/readiness authority.
        expect(onSaveEdits).not.toHaveBeenCalled();
    });

    it('keeps Remove from scan confirmation-gated and distinct from false detection', () => {
        const screen = renderCard();
        fireEvent.press(screen.getByText('Remove from this scan'));
        expect(onRemove).not.toHaveBeenCalled();
        fireEvent.press(screen.getByText('Remove book from scan'));
        expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('keeps metadata-only cards within compact review', () => {
        const screen = renderCard({ allowedActions: ['view_metadata', 'remove_from_scan'] });
        expect(screen.queryByRole('button', { name: 'Open full correction' })).toBeNull();
        expect(screen.queryByText('Choose another match')).toBeNull();
        expect(screen.queryByText('Add to inventory')).toBeNull();
        expect(screen.queryByText(/Add all/iu)).toBeNull();
    });

    it('surfaces per-card Add only from server Save/Add authority and passes the exact mounted draft', async () => {
        const saveOnly = renderCard({ allowedActions: ['save_review'] });
        expect(saveOnly.getByText('Add to inventory')).toBeTruthy();
        fireEvent.press(saveOnly.getByTestId('card-condition-field'));
        fireEvent.press(saveOnly.getByText('Acceptable'));
        expect(saveOnly.getByText('Add to inventory')).toBeTruthy();

        const staleReadiness = renderCard({
            allowedActions: ['add_to_inventory'],
            reviewReady: false,
        });
        expect(staleReadiness.getByText('Add to inventory')).toBeTruthy();

        const allowed = renderCard({
            allowedActions: ['save_review', 'add_to_inventory'],
        });
        fireEvent.press(allowed.getByTestId('card-condition-field'));
        fireEvent.press(allowed.getByText('Acceptable'));
        await act(async () => {
            fireEvent.press(allowed.getByText('Add to inventory'));
            await Promise.resolve();
        });
        expect(onAdd).toHaveBeenCalledWith(
            expect.objectContaining({ candidateId: card().candidateId }),
            { baseCondition: 'acceptable' },
            expect.objectContaining({ baseCondition: 'acceptable' }),
        );
        const visibleButUnauthorized = renderCard({ allowedActions: ['view_metadata'] });
        expect(visibleButUnauthorized.queryByText('Add to inventory')).toBeNull();
    });

    it('lets a review:null card reach missing condition and price editors', () => {
        const screen = renderCard({
            reviewVersion: null,
            review: null,
            fieldSources: {
                ...card().fieldSources,
                condition: 'missing',
                price: 'missing',
            },
            blockers: [
                { code: 'condition_missing', candidateId: card().candidateId, inputId: null,
                    field: 'baseCondition', safeMessage: 'Condition is required.' },
                { code: 'price_invalid', candidateId: card().candidateId, inputId: null,
                    field: 'priceMinor', safeMessage: 'Price is required.' },
            ],
        });
        expect(screen.getByTestId('card-condition-field')).toBeTruthy();
        fireEvent.press(screen.getByTestId('card-condition-field'));
        expect(screen.getByText('Good')).toBeTruthy();
        fireEvent.press(screen.getByTestId('card-price-field'));
        expect(screen.getByTestId('card-price-picker')).toBeTruthy();
    });

    it('shows specific local missing fields instead of only the generic missing-review blocker', () => {
        const screen = renderCard({
            candidateState: 'needs_review', reviewVersion: null, review: null,
            reviewDisposition: null, reviewReady: false,
            blockers: [{
                code: 'review_missing', candidateId: card().candidateId, inputId: null,
                field: null, safeMessage: 'Review this book.',
            }],
            fieldSources: {
                ...card().fieldSources, condition: 'missing', price: 'missing',
            },
            allowedActions: ['save_review'],
        });

        const validationSummary = within(screen.getByTestId('card-add-validation'));
        expect(validationSummary.getByText(/Set a whole-rupee selling price\./)).toBeTruthy();
        expect(validationSummary.getByText(/Choose a condition\./)).toBeTruthy();
        expect(validationSummary.queryByText(/Review this book\./)).toBeNull();
        expect(screen.getByText('Add to inventory')).toBeDisabled();

        fireEvent.press(screen.getByTestId('card-condition-field'));
        fireEvent.press(screen.getByText('Good'));
        const editedSummary = within(screen.getByTestId('card-add-validation'));
        expect(editedSummary.getByText(/Set a whole-rupee selling price\./)).toBeTruthy();
        expect(editedSummary.queryByText(/Review this book\./)).toBeNull();
    });

    it.each(['pending', 'no_match', 'ambiguous'] as const)(
        'keeps never-reviewed observed identity visible while metadata is %s',
        (metadataState) => {
            const screen = renderCard({
                reviewVersion: null, review: null, metadataState, metadataSummary: null,
                observed: {
                    title: 'Live observed title', authors: ['Live observed author'],
                    language: 'fr', script: 'Latn',
                },
                fieldSources: {
                    ...card().fieldSources,
                    cover: 'missing', title: 'detected', authors: 'detected',
                    language: 'detected',
                },
            });
            expect(screen.getByText(/Live observed title/u)).toBeTruthy();
            expect(screen.getByText(/Live observed author/u)).toBeTruthy();
            fireEvent.press(screen.getByTestId('card-additional-details-toggle'));
            expect(screen.getByText('Language: fr')).toBeTruthy();
        },
    );

    it('shows selected metadata identity on a never-reviewed card', () => {
        const screen = renderCard({
            reviewVersion: null, review: null, reviewDisposition: null,
            metadataState: 'selected',
            fieldSources: {
                ...card().fieldSources,
                title: 'matched', authors: 'matched', language: 'matched',
            },
        });
        expect(screen.getByText(/Matched Metadata Title/u)).toBeTruthy();
        expect(screen.getByText(/Author A/u)).toBeTruthy();
    });

    it('builds a valid local review:null draft without autosave and keeps Add Save-gated', async () => {
        const screen = renderCard({
            reviewVersion: null,
            review: null,
            metadataState: 'no_match',
            metadataSummary: null,
            allowedActions: ['save_review', 'view_metadata'],
            fieldSources: {
                ...card().fieldSources,
                title: 'detected', authors: 'detected', language: 'detected',
                condition: 'missing', price: 'missing',
            },
        });
        expect(screen.getByText('Add to inventory')).toBeDisabled();
        fireEvent.press(screen.getByTestId('card-condition-field'));
        fireEvent.press(screen.getByText('Good'));
        fireEvent.press(screen.getByTestId('card-price-field'));
        fireEvent.press(screen.getByText('₹25'));
        expect(screen.queryByText('Save changes')).toBeNull();
        expect(onAdd).not.toHaveBeenCalled();
        expect(screen.getByText('Add to inventory')).toBeTruthy();
        expect(screen.getByText('Add to inventory')).not.toBeDisabled();
        await act(async () => {
            fireEvent.press(screen.getByText('Add to inventory'));
            await Promise.resolve();
        });
        expect(onAdd).toHaveBeenCalledWith(
            expect.objectContaining({ review: null, reviewVersion: null }),
            expect.objectContaining({
                baseCondition: 'good', priceMinor: 2500,
            }),
            expect.objectContaining({
                originalTitle: 'Observed Title', baseCondition: 'good', priceMinor: 2500,
                metadataChoice: { mode: 'manual', selectionId: null },
            }),
        );
    });

    it('keeps a review:null card within compact review', () => {
        const screen = renderCard({ reviewVersion: null, review: null });
        expect(screen.queryByRole('button', { name: 'Open full correction' })).toBeNull();
    });

    it('shows whole-rupee INR presentation derived from integer minor units', () => {
        const screen = renderCard();
        expect(screen.getByText(/₹250/u)).toBeTruthy();
    });

    it.each([
        ['', null],
        ['   ', null],
        ['0', 0],
        ['125', 12_500],
    ])('treats custom whole-rupee input %p as %p minor units', (raw, expected) => {
        const screen = renderCard();
        fireEvent.press(screen.getByTestId('card-price-field'));
        fireEvent.changeText(screen.getByTestId('card-custom-rupees'), raw);
        fireEvent.press(screen.getByLabelText('Use custom price'));
        expect(onDraftChange).toHaveBeenLastCalledWith(card().candidateId, {
            priceMinor: expected,
        });
    });

    it.each(['12.5', '-1', '21474837'])(
        'rejects invalid custom whole-rupee input %p without changing the draft',
        (raw) => {
            const screen = renderCard();
            fireEvent.press(screen.getByTestId('card-price-field'));
            fireEvent.changeText(screen.getByTestId('card-custom-rupees'), raw);
            fireEvent.press(screen.getByLabelText('Use custom price'));
            expect(onDraftChange).not.toHaveBeenCalled();
        },
    );

    it('serializes the explicit Not set price choice as null', () => {
        const screen = renderCard();
        fireEvent.press(screen.getByTestId('card-price-field'));
        fireEvent.press(screen.getByText('Not set'));
        expect(onDraftChange).toHaveBeenLastCalledWith(card().candidateId, {
            priceMinor: null,
        });
    });

    it('prefers accepted selected metadata over raw observed values for title and authors', () => {
        const screen = renderCard({
            observed: { title: 'Raw Scan Title', authors: ['Scan Author'], language: 'en', script: 'Latn' },
            metadataSummary: {
                title: 'Selected Metadata Title',
                authors: ['Selected Author'],
                language: 'en',
                coverReference: null,
            },
            fieldSources: {
                cover: 'missing', title: 'matched', authors: 'matched',
                language: 'default', condition: 'default', price: 'custom',
                quantity: 'default', location: 'default', publication: 'default',
                damage: 'default',
            },
        });
        expect(screen.getByText(/Selected Metadata Title/u)).toBeTruthy();
        expect(screen.getByText(/Selected Author/u)).toBeTruthy();
    });

    it('shows the saved custom identity when the server source is custom', () => {
        const screen = renderCard({
            review: {
                ...(card().review as Record<string, unknown>),
                originalTitle: 'Owner Corrected Title',
                authors: ['Corrected Author'],
            },
            observed: { title: 'Raw Scan Title', authors: ['Scan Author'], language: 'en', script: 'Latn' },
            fieldSources: {
                cover: 'missing', title: 'custom', authors: 'custom',
                language: 'detected', condition: 'default', price: 'custom',
                quantity: 'default', location: 'default', publication: 'default',
                damage: 'default',
            },
        });
        expect(screen.getByText(/Owner Corrected Title/u)).toBeTruthy();
        expect(screen.getByText(/Corrected Author/u)).toBeTruthy();
    });

    it('keeps the dense editor set behind one clear card action', () => {
        const screen = renderCard();
        expect(screen.getByText(/Matched Metadata Title/u)).toBeTruthy();
        expect(screen.getByText(/Author A/u)).toBeTruthy();

        expect(screen.getByTestId('card-price-field')).toBeTruthy();
        expect(screen.getByLabelText('Quantity: 1')).toBeTruthy();
        expect(screen.getByTestId('card-quantity-decrease')).toBeTruthy();
        expect(screen.getByTestId('card-quantity-increase')).toBeTruthy();
        expect(screen.getByTestId('card-condition-field')).toBeTruthy();
        expect(screen.queryByTestId('card-location-sources')).toBeNull();
        fireEvent.press(screen.getByTestId('card-additional-details-toggle'));
        expect(screen.getByTestId('card-location-sources')).toBeTruthy();
        const details = screen.getByTestId('card-location-sources');
        expect(within(details).getByText('Location: Front shelf')).toBeTruthy();
        expect(within(details).getByText('Publication: Private')).toBeTruthy();
        expect(within(details).getByText('Language: en')).toBeTruthy();
        expect(within(details).getByText('Damage: No damage')).toBeTruthy();

        fireEvent.press(screen.getByTestId('card-condition-field'));
        fireEvent.press(screen.getByText('Acceptable'));
        expect(screen.queryByText('Save changes')).toBeNull();
        expect(screen.getByText('Add to inventory')).toBeTruthy();
    });

    it('uses saved/custom language before selected and observed language', () => {
        const screen = renderCard({
            observed: { ...card().observed, language: 'fr' },
            metadataSummary: { ...card().metadataSummary!, language: 'de' },
            review: { ...(card().review as Record<string, unknown>), originalLanguage: 'hi' },
            fieldSources: { ...card().fieldSources, language: 'custom' },
        });
        fireEvent.press(screen.getByTestId('card-additional-details-toggle'));
        expect(screen.getByText('Language: hi')).toBeTruthy();
        expect(screen.queryByText('Language: fr')).toBeNull();
    });

    it('renders a bounded cover thumbnail or an explicit Missing placeholder, never scan media', () => {
        const withCover = renderCard({
            fieldSources: {
                cover: 'matched', title: 'matched', authors: 'matched',
                language: 'default', condition: 'default', price: 'custom',
                quantity: 'default', location: 'default', publication: 'default',
                damage: 'default',
            },
        });
        expect(withCover.getByText('Book 1 cover')).toBeTruthy();

        const withoutCover = renderCard({ metadataSummary: { ...card().metadataSummary!, coverReference: null } });
        expect(withoutCover.getByLabelText('Book 1 cover placeholder')).toBeTruthy();
        expect(withoutCover.getByText('No cover')).toBeTruthy();
    });

    it('renders and labels a representative-edition cover when the selected edition has no cover', () => {
        const screen = renderCard({
            metadataSummary: {
                ...card().metadataSummary!, coverReference: null,
                representativeCover: {
                    coverReference: 'https://books.google.com/books/content?id=alternate',
                    sourceRelation: 'representative_edition',
                    sourceAdapter: 'google_books', sourceAdapterVersion: '1.0.0',
                    sourceRecordId: 'alternate-volume',
                    selectionPolicyVersion: 'p9-representative-cover-v1',
                },
            },
            fieldSources: { ...card().fieldSources, cover: 'representative' },
        });
        expect(screen.getByText('Book 1 representative edition cover')).toBeTruthy();
        expect(screen.getByText('Representative edition cover')).toBeTruthy();
    });

    it('replaces metadata status text with the pending or unchosen edition line', () => {
        expect(renderCard({ metadataState: 'pending' }).getByText('Finding edition…')).toBeTruthy();
        const view = renderCard({ metadataState: 'no_match', metadataSummary: null });
        expect(view.getByText('No edition chosen')).toBeTruthy();
        expect(view.queryByLabelText(/Metadata status:/u)).toBeNull();
    });

    it('shows the saved damage answer with its canonical source badge', () => {
        const noDamage = renderCard();
        fireEvent.press(noDamage.getByTestId('card-additional-details-toggle'));
        expect(noDamage.getByText('Damage: No damage')).toBeTruthy();
        const damaged = renderCard({
            review: {
                ...(card().review as Record<string, unknown>),
                damageDisclosure: {
                    hasDamage: true, damageTypes: ['cover'], damageNote: 'Bent corner',
                    isSellable: true, completeReadableSafe: true,
                },
            },
            fieldSources: {
                ...card().fieldSources,
                damage: 'custom',
            },
        });
        fireEvent.press(damaged.getByTestId('card-additional-details-toggle'));
        expect(damaged.getByText('Damage: Has damage')).toBeTruthy();
    });

    it('shows private publication when an unsafe damage edit forces strict private serialization', async () => {
        const screen = renderCard({
            review: {
                ...(card().review as Record<string, unknown>),
                publicationIntent: 'publish',
            },
        });
        fireEvent.press(screen.getByTestId('card-additional-details-toggle'));
        expect(screen.getByText('Publication: Prepare to publish')).toBeTruthy();

        const details = screen.getByTestId('card-location-sources');
        expect(within(details).getByText('Damage: No damage')).toBeTruthy();
        expect(within(details).getByText('Publication: Prepare to publish')).toBeTruthy();
        expect(within(details).queryByTestId('card-publication-overlay')).toBeNull();

        await act(async () => {
            fireEvent.press(screen.getByText('Add to inventory'));
            await Promise.resolve();
        });
        expect(onAdd).toHaveBeenCalledWith(
            expect.objectContaining({ candidateId: card().candidateId }),
            {},
            expect.objectContaining({
                publicationIntent: 'publish',
                damageDisclosure: expect.objectContaining({ isSellable: true }),
            }),
        );
    });

    it('shows one edition button and no View metadata', () => {
        const screen = renderCard({ allowedActions: ['view_metadata'] });
        expect(screen.queryByText('View metadata')).toBeNull();
        expect(screen.getAllByRole('button', { name: 'Find or change edition' })).toHaveLength(1);
        fireEvent.press(screen.getByLabelText('Find or change edition'));
        expect(screen.getByRole('header', { name: 'Find or change edition' })).toBeTruthy();
        expect(screen.queryByText('Detected details')).toBeNull();
        fireEvent.press(screen.getByText('Close metadata'));
        expect(screen.queryByRole('button', { name: 'Open full correction' })).toBeNull();
    });

    it('shows the bounded selected metadata snapshot, cover, and a clear provider status', () => {
        mockMetadataDetail = candidateDetailFixture({
            metadata: {
                state: 'selected', revision: 7, selectionVersion: 1,
                selectionId: testUuid(99), canonicalEditionId: testUuid(98),
                snapshot: {
                    title: 'Selected detail title', authors: ['Selected detail author'],
                    language: 'en', subtitle: 'A selected subtitle',
                    description: 'A selected description.',
                    isbn10: '1234567890', isbn13: '1234567890123',
                    publisher: 'Bounded Publisher', publishedDate: '2026',
                    script: 'Latn', editionStatement: 'First', series: null,
                    volume: null, format: 'Paperback', pageCount: 240,
                    categories: ['Fiction', 'Mystery'],
                    coverReference: 'https://books.google.com/books/content?id=selected',
                },
            },
        });
        const screen = renderCard({ allowedActions: ['view_metadata'] });
        fireEvent.press(screen.getByLabelText('Find or change edition'));
        expect(screen.getByTestId('selected-metadata-details')).toBeTruthy();
        expect(screen.getByText('Status: Provider metadata selected')).toBeTruthy();
        expect(screen.getByText('Title: Selected detail title')).toBeTruthy();
        expect(screen.getByText('Subtitle: A selected subtitle')).toBeTruthy();
        expect(screen.getByText('Description: A selected description.')).toBeTruthy();
        expect(screen.getByText('Categories / genre: Fiction, Mystery')).toBeTruthy();
        expect(screen.getByText('Cover for Selected detail title')).toBeTruthy();
        expect(screen.getByText('Publisher: Bounded Publisher')).toBeTruthy();
        expect(screen.queryByTestId('metadata-no-selected-details')).toBeNull();
    });

    it('requires an explicit choice when canonical authority changes under mounted edits', () => {
        const initial = card();
        const onAuthorityStateChange = jest.fn();
        const screen = render(
            <BatchReviewCard
                identity={{ userId: testUuid(90), storeId: testUuid(91) }}
                card={initial} defaults={defaults} isOffline={false} canMutate
                onRemove={onRemove}
                onAdd={onAdd} removePending={false} addPending={false}
                onDraftChange={onDraftChange}
                onAuthorityStateChange={onAuthorityStateChange}
            />,
        );
        fireEvent.press(screen.getByTestId('card-condition-field'));
        fireEvent.press(screen.getByText('Acceptable'));
        screen.rerender(
            <BatchReviewCard
                identity={{ userId: testUuid(90), storeId: testUuid(91) }}
                card={{ ...initial, candidateVersion: 3 }} defaults={defaults}
                isOffline={false} canMutate
                onRemove={onRemove} onAdd={onAdd} removePending={false}
                addPending={false} onDraftChange={onDraftChange}
                onAuthorityStateChange={onAuthorityStateChange}
            />,
        );
        expect(screen.getByTestId('compact-authority-changed')).toBeTruthy();
        expect(onAuthorityStateChange).toHaveBeenLastCalledWith(initial.candidateId, true);
        expect(screen.getByText('Add to inventory')).toBeDisabled();
        fireEvent.press(screen.getByText('Reapply compact edits'));
        expect(onAuthorityStateChange).toHaveBeenLastCalledWith(initial.candidateId, false);
        expect(screen.getByText('Add to inventory')).not.toBeDisabled();
        expect(screen.getByText('Acceptable')).toBeTruthy();
    });

    it('does not display Ready after an add outcome makes the card ineligible', () => {
        const outcome: CandidateCommitOutcome = {
            candidateId: card().candidateId,
            status: 'no_longer_eligible',
            stage: 'revalidate',
        };
        const screen = render(
            <BatchReviewCard
                identity={{ userId: testUuid(90), storeId: testUuid(91) }}
                card={card()} defaults={defaults} isOffline={false} canMutate
                onRemove={onRemove}
                onAdd={onAdd} removePending={false} addPending={false}
                onDraftChange={onDraftChange} addOutcome={outcome}
            />,
        );

        expect(screen.getByText('Needs attention')).toBeTruthy();
        expect(screen.queryByText('Ready')).toBeNull();
    });

    it('added card shows Added to Inventory without Store View navigation', () => {
        const outcome: CandidateCommitOutcome = {
            candidateId: card().candidateId,
            status: 'succeeded',
            stage: 'complete',
            result: {
                sessionId: card().sessionId,
                candidateId: card().candidateId,
                candidateVersion: 3,
                inventoryId: testUuid(97),
                inventoryVersion: 1,
                outcome: 'committed_private',
            },
        };
        const screen = render(
            <BatchReviewCard
                identity={{ userId: testUuid(90), storeId: testUuid(91) }}
                card={card()} defaults={defaults} isOffline={false} canMutate
                onRemove={onRemove} onAdd={onAdd}
                removePending={false} addPending={false} onDraftChange={onDraftChange}
                addOutcome={outcome}
            />,
        );

        const success = screen.getByTestId(`add-to-inventory-success-${card().candidateId}`);
        expect(within(success).getByText('Added to Inventory')).toBeTruthy();
        expect(within(success).getByText('Added to Inventory').props.accessibilityLiveRegion)
            .toBe('polite');
        expect(within(success).queryByText('View in Store View')).toBeNull();
        expect(within(success).queryAllByRole('button')).toHaveLength(0);
        expect(screen.queryByText('View in Store View')).toBeNull();
    });
});

function mountEdition(snapshotPatch: Partial<NonNullable<ReturnType<typeof selectedChoices>['selection']>['snapshot']> = {}) {
    const choices = selectedChoices({ sessionId: card().sessionId, candidateId: card().candidateId,
        candidateVersion: 2, metadataRevision: 3, reviewVersion: 1 });
    choices.selection = { ...choices.selection!, snapshot: { ...choices.selection!.snapshot,
        title: 'Matched Metadata Title', authors: ['Author A'], ...snapshotPatch } };
    mockEditionChoices = choices;
    return render(<BatchReviewCard identity={{ userId: testUuid(90), storeId: testUuid(91) }}
        card={card({ metadataSummary: { ...choices.selection.snapshot, selectionId: choices.selection.selectionId },
            review: { ...card().review!, originalTitle: choices.selection.snapshot.title,
                metadataChoice: { mode: 'edition_option', selectionId: choices.selection.selectionId } } })}
        defaults={defaults} isOffline={false} canMutate removePending={false} addPending={false}
        commandSlot={{ claimSlot: jest.fn(), releaseSlot: jest.fn(), isCommandActive: () => false }}
        onRemove={onRemove} onAdd={onAdd} onDraftChange={onDraftChange} />);
}
it('edition line shows the chosen edition and clears on a title change', () => {
    const view = mountEdition({ publisher: 'Publisher', publishedDate: 'April 1, 1999', isbn13: '9781234567890' });
    expect(view.getByText('Publisher · 1999 · 9781234567890')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Edit title for Book 1: Matched Metadata Title'));
    fireEvent.changeText(view.getByTestId('card-title-input'), 'Changed title');
    fireEvent(view.getByTestId('card-title-input'), 'blur');
    expect(view.getByText('No edition chosen — title or author changed')).toBeTruthy();
});
it.each([
    [{ publisher: null, publishedDate: '1989', isbn10: '1234567890' }, '1989 · 1234567890'],
    [{ publisher: null, publishedDate: '12345', isbn10: null }, 'Edition chosen'],
])('edition line omits absent parts and falls back to ISBN-10: %p', (patch, expected) => {
    expect(mountEdition(patch).getByText(expected)).toBeTruthy();
});
it('edition line is announced', () => {
    const view = mountEdition();
    expect(view.getByText('Chosen publisher · 2002').props.accessibilityLiveRegion).toBe('polite');
    expect(view.getByText('Chosen publisher · 2002').props.accessibilityLabel).toBe('Chosen publisher · 2002');
    expect(view.getByTestId('card-review-status').props.accessibilityLiveRegion).toBe('polite');
});

// Post-scan SDD-1 §6 (4a), AC4-1: compact review has no full-correction exit.
it('has no Open full correction action', () => {
    const screen = renderCard();
    expect(screen.queryByRole('button', { name: 'Open full correction' })).toBeNull();
});
it('explains a card that cannot be changed without directing to removed correction', () => {
    const screen = renderCard({ review: null, reviewVersion: null, allowedActions: ['view_metadata'] });
    expect(screen.getByText("This book can't be changed now.")).toBeTruthy();
    expect(screen.queryByText(/Open full correction/iu)).toBeNull();
});
it('does not show the cannot-change hint for a saved review without save_review', () => {
    const screen = renderCard({ allowedActions: ['view_metadata'] });
    expect(screen.queryByText("This book can't be changed now.")).toBeNull();
});
