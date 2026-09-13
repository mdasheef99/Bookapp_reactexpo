import { act, fireEvent, render, within } from '@testing-library/react-native';
import {
    applyCompactEdits,
    BatchReviewCard,
} from '../components/BatchReviewCard';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { CandidateCommitOutcome } from '../commit/inventoryCommitCoordinator';
import { candidateDetailFixture, testUuid } from '../testing/ownerUxTestFixtures';

let mockMetadataDetail = candidateDetailFixture();

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

const onOpenFullCorrection = jest.fn();
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
            onOpenFullCorrection={onOpenFullCorrection}
            onRemove={onRemove}
            onAdd={onAdd}
            removePending={false}
            addPending={false}
            onDraftChange={onDraftChange}
        />,
    );
}

describe('Phase 9 NEW 6G-C compact review card', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockMetadataDetail = candidateDetailFixture({
            sessionId: card().sessionId,
            candidateId: card().candidateId,
            observed: card().observed,
        });
    });

    it('distinguishes provider-matched fields from vision-detected fields', () => {
        const screen = renderCard({
            fieldSources: {
                cover: 'matched', title: 'detected', authors: 'missing',
                language: 'default', condition: 'custom', price: 'missing',
                quantity: 'default', location: 'default', publication: 'default',
                damage: 'default',
            },
        });
        const badges = screen.getAllByText(/^(Provider matched|Vision detected|Batch default|Custom|Missing)$/u)
            .map((node) => node.props.children);
        expect(badges).toContain('Provider matched');
        expect(badges).toContain('Vision detected');
        expect(badges).toContain('Batch default');
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
        const locationRow = screen.getByTestId('card-location-sources');
        expect(within(locationRow).queryByText('Vision detected')).toBeNull();
        expect(within(locationRow).queryByText('Provider matched')).toBeNull();
        expect(within(locationRow).getAllByText('Batch default').length).toBeGreaterThan(0);
    });

    it('keeps compact edits local until Add and round-trips hidden notes through that strict Save', async () => {
        const screen = renderCard();
        fireEvent.press(screen.getByText('Edit book details'));
        fireEvent.press(screen.getByTestId('card-condition-open'));
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
        fireEvent.press(screen.getByText('Edit book details'));
        fireEvent.press(screen.getByTestId('card-condition-open'));
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

    it('navigates to the existing Unit 6 full-correction controller without inventing new actions', () => {
        const screen = renderCard({ allowedActions: ['view_metadata', 'remove_from_scan'] });
        fireEvent.press(screen.getByText('Open full correction'));
        expect(onOpenFullCorrection).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Choose another match')).toBeNull();
        expect(screen.queryByText('Add to inventory')).toBeNull();
        expect(screen.queryByText(/Add all/iu)).toBeNull();
    });

    it('surfaces per-card Add only from server Save/Add authority and passes the exact mounted draft', async () => {
        const saveOnly = renderCard({ allowedActions: ['save_review'] });
        expect(saveOnly.queryByText('Add to inventory')).toBeNull();
        fireEvent.press(saveOnly.getByText('Edit book details'));
        fireEvent.press(saveOnly.getByTestId('card-condition-open'));
        fireEvent.press(saveOnly.getByText('Acceptable'));
        expect(saveOnly.getByText('Add to inventory')).toBeTruthy();

        const staleReadiness = renderCard({
            allowedActions: ['add_to_inventory'],
            reviewReady: false,
        });
        expect(staleReadiness.queryByText('Add to inventory')).toBeNull();

        const allowed = renderCard({
            allowedActions: ['save_review', 'add_to_inventory'],
        });
        fireEvent.press(allowed.getByText('Edit book details'));
        fireEvent.press(allowed.getByTestId('card-condition-open'));
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
        fireEvent.press(screen.getByText('Edit book details'));
        expect(screen.getByTestId('card-condition-open')).toBeTruthy();
        fireEvent.press(screen.getByTestId('card-condition-open'));
        expect(screen.getByText('Good')).toBeTruthy();
        fireEvent.press(screen.getByText('Edit price'));
        expect(screen.getByTestId('compact-price-picker')).toBeTruthy();
    });

    it('lets review:null metadata Edit manually open identity editing', () => {
        const screen = renderCard({
            reviewVersion: null,
            review: null,
            metadataState: 'no_match',
            metadataSummary: null,
            allowedActions: ['save_review', 'view_metadata'],
        });
        fireEvent.press(screen.getByText('View metadata'));
        fireEvent.press(screen.getByText('Edit manually'));
        expect(screen.getByTestId('compact-identity-editor')).toBeTruthy();
        expect(onDraftChange).toHaveBeenLastCalledWith(card().candidateId, {
            metadataChoice: { mode: 'manual', selectionId: null },
        });
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
            expect(screen.getAllByText(/Live observed title/u).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/Live observed author/u).length).toBeGreaterThan(0);
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
        expect(screen.getAllByText(/Matched Metadata Title/u).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Author A/u).length).toBeGreaterThan(0);
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
        expect(screen.queryByText('Add to inventory')).toBeNull();
        fireEvent.press(screen.getByText('View metadata'));
        fireEvent.press(screen.getByText('Use detected details'));
        fireEvent.press(screen.getByText('Edit book details'));
        fireEvent.press(screen.getByTestId('card-condition-open'));
        fireEvent.press(screen.getByText('Good'));
        fireEvent.press(screen.getByText('Edit price'));
        fireEvent.press(screen.getByText('₹25'));
        expect(screen.queryByText('Save changes')).toBeNull();
        expect(onAdd).not.toHaveBeenCalled();
        expect(screen.getByText('Add to inventory')).toBeTruthy();
        await act(async () => {
            fireEvent.press(screen.getByText('Add to inventory'));
            await Promise.resolve();
        });
        expect(onAdd).toHaveBeenCalledWith(
            expect.objectContaining({ review: null, reviewVersion: null }),
            expect.objectContaining({
                metadataChoice: { mode: 'manual', selectionId: null },
                baseCondition: 'good', priceMinor: 2500,
            }),
            expect.objectContaining({
                originalTitle: 'Observed Title', baseCondition: 'good', priceMinor: 2500,
                metadataChoice: { mode: 'manual', selectionId: null },
            }),
        );
    });

    it('retains Open full correction as the review:null deep-correction escape route', () => {
        const screen = renderCard({ reviewVersion: null, review: null });
        fireEvent.press(screen.getByText('Open full correction'));
        expect(onOpenFullCorrection).toHaveBeenCalledTimes(1);
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
        fireEvent.press(screen.getByText('Edit book details'));
        fireEvent.press(screen.getByText('Edit price'));
        fireEvent.changeText(screen.getByTestId('compact-custom-rupees'), raw);
        fireEvent.press(screen.getByText('Use custom price'));
        expect(onDraftChange).toHaveBeenLastCalledWith(card().candidateId, {
            priceMinor: expected,
        });
    });

    it.each(['12.5', '-1', '21474837'])(
        'rejects invalid custom whole-rupee input %p without changing the draft',
        (raw) => {
            const screen = renderCard();
            fireEvent.press(screen.getByText('Edit book details'));
            fireEvent.press(screen.getByText('Edit price'));
            fireEvent.changeText(screen.getByTestId('compact-custom-rupees'), raw);
            fireEvent.press(screen.getByText('Use custom price'));
            expect(onDraftChange).not.toHaveBeenCalled();
        },
    );

    it('serializes the explicit Not set price choice as null', () => {
        const screen = renderCard();
        fireEvent.press(screen.getByText('Edit book details'));
        fireEvent.press(screen.getByText('Edit price'));
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
        expect(screen.getAllByText(/Selected Metadata Title/u).length).toBeGreaterThan(0);
        expect(screen.queryByText('Raw Scan Title')).toBeNull();
        expect(screen.getAllByText(/Selected Author/u).length).toBeGreaterThan(0);
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
        expect(screen.getAllByText(/Owner Corrected Title/u).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Selected Metadata Title/u)).toBeNull();
        expect(screen.getAllByText(/Corrected Author/u).length).toBeGreaterThan(0);
    });

    it('keeps the dense editor set behind one clear card action', () => {
        const screen = renderCard();
        expect(screen.getByText('Edit book details')).toBeTruthy();
        [
            'Edit title and authors', 'Edit language', 'Edit condition',
            'Edit price', 'Edit quantity', 'Edit location',
            'Edit publication', 'Edit damage',
        ].forEach((label) => expect(screen.queryByText(label)).toBeNull());

        fireEvent.press(screen.getByText('Edit book details'));
        [
            'Edit title and authors', 'Edit language', 'Edit condition',
            'Edit price', 'Edit quantity', 'Edit location',
            'Edit publication', 'Edit damage',
        ].forEach((label) => expect(screen.getByText(label)).toBeTruthy());

        fireEvent.press(screen.getByText('Edit condition'));
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

    it('exposes a useful metadata status for every retained metadata state', () => {
        expect(renderCard({ metadataState: 'selected' }).getAllByText('Provider matched').length).toBeGreaterThan(0);
        expect(renderCard({ metadataState: 'manual' }).getByText('Manual details')).toBeTruthy();
        expect(renderCard({ metadataState: 'no_match' }).getByText('No provider match')).toBeTruthy();
        expect(renderCard({ metadataState: 'pending' }).getByText('Finding metadata')).toBeTruthy();
        expect(renderCard({ metadataState: 'failed' }).getByText('Metadata failed')).toBeTruthy();
        expect(renderCard({ metadataState: 'ambiguous' }).getByText('Metadata needs review')).toBeTruthy();
        expect(renderCard({ metadataState: 'temporarily_unavailable' }).getByText('Metadata unavailable')).toBeTruthy();
    });

    it('shows the saved damage answer with its canonical source badge', () => {
        const noDamage = renderCard();
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
        expect(damaged.getByText('Damage: Has damage')).toBeTruthy();
    });

    it('shows private publication when an unsafe damage edit forces strict private serialization', async () => {
        const screen = renderCard({
            review: {
                ...(card().review as Record<string, unknown>),
                publicationIntent: 'publish',
            },
        });
        expect(screen.getByText('Publication: Prepare to publish')).toBeTruthy();

        fireEvent.press(screen.getByText('Edit book details'));
        fireEvent.press(screen.getByText('Edit damage'));
        fireEvent.press(screen.getByText('Has damage'));
        fireEvent.press(screen.getByText('Cover'));
        fireEvent.changeText(screen.getByTestId('compact-damage-note'), 'Bent corner');
        fireEvent.press(screen.getByText('Sellable copy'));

        expect(screen.getByText('Publication: Private')).toBeTruthy();
        expect(screen.queryByText('Publication: Prepare to publish')).toBeNull();
        expect(screen.getByTestId('card-publication-overlay').props.children).toBe('Custom');

        await act(async () => {
            fireEvent.press(screen.getByText('Add to inventory'));
            await Promise.resolve();
        });
        expect(onAdd).toHaveBeenCalledWith(
            expect.objectContaining({ candidateId: card().candidateId }),
            expect.objectContaining({
                damageDisclosure: expect.objectContaining({ isSellable: false }),
            }),
            expect.objectContaining({
                publicationIntent: 'private',
                damageDisclosure: expect.objectContaining({ isSellable: false }),
            }),
        );
    });

    it('opens bounded metadata separately while full correction keeps its retained route callback', () => {
        const allowed = renderCard({ allowedActions: ['view_metadata'] });
        fireEvent.press(allowed.getByText('View metadata'));
        expect(allowed.getByText('Book metadata')).toBeTruthy();
        expect(allowed.getByTestId('metadata-no-selected-details')).toBeTruthy();
        expect(allowed.getByText('Use detected details')).toBeTruthy();
        expect(allowed.getByText('Edit manually')).toBeTruthy();
        expect(onOpenFullCorrection).not.toHaveBeenCalled();

        fireEvent.press(allowed.getByText('Close metadata'));
        fireEvent.press(allowed.getByText('Open full correction'));
        expect(onOpenFullCorrection).toHaveBeenCalledTimes(1);

        const notAllowed = renderCard({ allowedActions: [] });
        expect(notAllowed.queryByText('View metadata')).toBeNull();
    });

    it('keeps Use detected and Edit manually bounded to explicit manual/null identity edits', () => {
        const detected = renderCard({ allowedActions: ['view_metadata'] });
        fireEvent.press(detected.getByText('View metadata'));
        fireEvent.press(detected.getByText('Use detected details'));
        expect(onDraftChange).toHaveBeenLastCalledWith(card().candidateId, expect.objectContaining({
            originalTitle: mockMetadataDetail.observed.title,
            metadataChoice: { mode: 'manual', selectionId: null },
        }));

        const manual = renderCard({ allowedActions: ['view_metadata'] });
        fireEvent.press(manual.getByText('View metadata'));
        fireEvent.press(manual.getByText('Edit manually'));
        expect(manual.getByTestId('compact-identity-editor')).toBeTruthy();
        expect(onDraftChange).toHaveBeenLastCalledWith(card().candidateId, {
            metadataChoice: { mode: 'manual', selectionId: null },
        });
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
        fireEvent.press(screen.getByText('View metadata'));
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
                onOpenFullCorrection={onOpenFullCorrection} onRemove={onRemove}
                onAdd={onAdd} removePending={false} addPending={false}
                onDraftChange={onDraftChange}
                onAuthorityStateChange={onAuthorityStateChange}
            />,
        );
        fireEvent.press(screen.getByText('Edit book details'));
        fireEvent.press(screen.getByTestId('card-condition-open'));
        fireEvent.press(screen.getByText('Acceptable'));
        screen.rerender(
            <BatchReviewCard
                identity={{ userId: testUuid(90), storeId: testUuid(91) }}
                card={{ ...initial, candidateVersion: 3 }} defaults={defaults}
                isOffline={false} canMutate onOpenFullCorrection={onOpenFullCorrection}
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
        expect(screen.getByText('Condition: Acceptable')).toBeTruthy();
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
                onOpenFullCorrection={onOpenFullCorrection} onRemove={onRemove}
                onAdd={onAdd} removePending={false} addPending={false}
                onDraftChange={onDraftChange} addOutcome={outcome}
            />,
        );

        expect(screen.getByText('Needs attention')).toBeTruthy();
        expect(screen.queryByText('Ready')).toBeNull();
    });
});
