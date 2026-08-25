import { fireEvent, render, within } from '@testing-library/react-native';
import {
    applyCompactEdits,
    BatchReviewCard,
} from '../components/BatchReviewCard';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';

// Presentation-boundary stand-in so cover rendering stays assertable.
jest.mock('expo-image', () => ({
    Image: (props: Record<string, unknown>) => {
        const { Text } = require('react-native') as typeof import('react-native');
        const { createElement } = require('react') as typeof import('react');
        return createElement(Text, null, String(props.accessibilityLabel));
    },
}));

const onOpenFullCorrection = jest.fn();
const onRemove = jest.fn();
const onSaveEdits = jest.fn();

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
            card={card(overrides)}
            defaults={defaults}
            isOffline={false}
            canMutate
            onOpenFullCorrection={onOpenFullCorrection}
            onRemove={onRemove}
            onSaveEdits={onSaveEdits}
            removePending={false}
        />,
    );
}

describe('Phase 9 NEW 6G-C compact review card', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('maps every retained source code to the canonical visible badge', () => {
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
        expect(badges).toContain('Detected');
        expect(badges).toContain('Default');
        expect(badges).toContain('Custom');
        expect(badges).toContain('Missing');
        // Internal `matched` never renders as a separate "Matched" badge.
        expect(screen.queryByText('Matched')).toBeNull();
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
        expect(within(locationRow).queryByText('Detected')).toBeNull();
        expect(within(locationRow).queryByText('Matched')).toBeNull();
        expect(within(locationRow).getByText('Default')).toBeTruthy();
    });

    it('saves common-field edits through the retained strict review seam with hidden notes round-tripped', () => {
        const screen = renderCard();
        fireEvent.press(screen.getByTestId('card-condition-open'));
        fireEvent.press(screen.getByText('Acceptable'));
        fireEvent.press(screen.getByText('Save changes'));
        expect(onSaveEdits).toHaveBeenCalledWith(
            '00000000-0000-4000-8000-000000000021',
            { baseCondition: 'acceptable' },
            2,
            3,
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
        const screen = renderCard();
        fireEvent.press(screen.getByText('Open full correction'));
        expect(onOpenFullCorrection).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Choose another match')).toBeNull();
        expect(screen.queryByText('Add to inventory')).toBeNull();
        expect(screen.queryByText(/Add all/iu)).toBeNull();
    });

    it('hides compact editing when no saved review exists and defers to full correction', () => {
        const screen = renderCard({ reviewVersion: null, review: null });
        expect(screen.queryByTestId('card-condition-open')).toBeNull();
        expect(screen.getAllByText(/full correction/iu).length).toBeGreaterThan(0);
    });

    it('shows whole-rupee INR presentation derived from integer minor units', () => {
        const screen = renderCard();
        expect(screen.getByText(/₹250/u)).toBeTruthy();
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

    it('exposes the canonical metadata status for every retained metadata state', () => {
        expect(renderCard({ metadataState: 'selected' }).getByText('Metadata: Matched')).toBeTruthy();
        expect(renderCard({ metadataState: 'manual' }).getByText('Metadata: Manual')).toBeTruthy();
        expect(renderCard({ metadataState: 'no_match' }).getByText('Metadata: No match')).toBeTruthy();
        expect(renderCard({ metadataState: 'pending' }).getByText('Metadata: Pending')).toBeTruthy();
        expect(renderCard({ metadataState: 'failed' }).getByText('Metadata: Needs attention')).toBeTruthy();
        expect(renderCard({ metadataState: 'ambiguous' }).getByText('Metadata: Needs attention')).toBeTruthy();
        expect(renderCard({ metadataState: 'temporarily_unavailable' }).getByText('Metadata: Needs attention')).toBeTruthy();
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

    it('opens the existing full-correction entry from View metadata when allowed', () => {
        const allowed = renderCard({ allowedActions: ['view_metadata'] });
        fireEvent.press(allowed.getByText('View metadata'));
        expect(onOpenFullCorrection).toHaveBeenCalledTimes(1);

        const notAllowed = renderCard({ allowedActions: [] });
        expect(notAllowed.queryByText('View metadata')).toBeNull();
    });
});
