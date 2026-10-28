jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { BatchReviewCard } from '../components/BatchReviewCard';
import type { CandidateCommitAuthority } from '../commit/inventoryCommitTypes';
import { useCompactReviewAuthority } from '../commit/useInventoryCommitCoordinator';
import { pickerCard, pickerDetail, selectedChoices, pickerReview, pickerDefaults, deferred } from '../testing/editionPickerClientFixtures';
import { candidateCommitAuthorityKey } from '../commit/inventoryCommitPolicy';

// SDD-1 section 2/D2-3: only this command's response grants draft authority.
const initial = pickerCard(selectedChoices(), pickerReview);
const saved = pickerCard(selectedChoices({ candidateVersion: 6, reviewVersion: 2 }), pickerReview);
const acknowledgement: CandidateCommitAuthority = { kind: 'save', commandId: 'save-command',
    detail: pickerDetail(selectedChoices({ candidateVersion: 6, reviewVersion: 2 }), pickerReview) };
const base = { card: initial, review: pickerReview, hasEdits: true, hasBufferedIdentity: false,
    addPending: false, savedIdentityRevision: null };

it.each(['equal review', 'metadata revision', 'manual reset'])('does not adopt external authority from %s equality', kind => {
    const hook = renderHook((props: typeof base) => useCompactReviewAuthority(props), { initialProps: base });
    const review = kind === 'manual reset' ? { ...pickerReview,
        metadataChoice: { mode: 'manual' as const, selectionId: null } } : pickerReview;
    hook.rerender({ ...base, addPending: true, card: { ...saved, review,
        metadataRevision: kind === 'metadata revision' ? saved.metadataRevision + 1 : saved.metadataRevision } });
    expect(hook.result.current.authorityChanged).toBe(true);
    expect(hook.result.current.acceptedAuthority.current).toBe(candidateCommitAuthorityKey(initial));
});

it.each([true, false])('adopts the actual Save and informs the parent (cache rendered while pending: %s)', pending => {
    const onAdoptAuthority = jest.fn();
    const props = { ...base, addAuthorities: [acknowledgement], onAdoptAuthority };
    const hook = renderHook((input: typeof props) => useCompactReviewAuthority(input), { initialProps: props });
    hook.rerender({ ...props, card: saved, addPending: pending });
    expect(hook.result.current.authorityChanged).toBe(false);
    expect(hook.result.current.acceptedAuthority.current).toBe(candidateCommitAuthorityKey(saved));
    expect(onAdoptAuthority).toHaveBeenCalledWith(candidateCommitAuthorityKey(saved));
});

it('keeps a genuine conflict and its parent block when success arrives, including buffered text', () => {
    const onAuthorityStateChange = jest.fn();
    const props = { ...base, onAuthorityStateChange, addAuthorities: [acknowledgement], addOutcome: undefined as any };
    const hook = renderHook((input: typeof props) => useCompactReviewAuthority(input), { initialProps: props });
    const external = { ...saved, candidateVersion: 7, reviewVersion: 3,
        review: { ...pickerReview, priceMinor: 99_000 } };
    hook.rerender({ ...props, card: external, hasBufferedIdentity: true });
    expect(hook.result.current.authorityChanged).toBe(true);
    hook.rerender({ ...props, card: external, hasBufferedIdentity: true,
        addOutcome: { candidateId: initial.candidateId, status: 'succeeded', stage: 'complete' } });
    expect(hook.result.current.authorityChanged).toBe(true);
    expect(onAuthorityStateChange).not.toHaveBeenCalledWith(initial.candidateId, false);
});

it('retains the mounted compact edits and parent conflict when the outstanding Add returns success', async () => {
    const result = deferred<unknown>();
    const onAuthorityStateChange = jest.fn(), onDraftChange = jest.fn();
    const card = pickerCard(selectedChoices(), { ...pickerReview, priceMinor: 25_000 });
    const props = { identity: { userId: 'owner', storeId: 'store' }, defaults: pickerDefaults,
        isOffline: false, canMutate: true, removePending: false, onRemove: jest.fn(),
        onAdd: jest.fn(() => result.promise), onDraftChange, onAuthorityStateChange };
    const screen = render(<BatchReviewCard {...props} card={card} addPending={false} />);
    fireEvent.press(screen.getByTestId('card-price-field'));
    fireEvent.changeText(screen.getByTestId('card-custom-rupees'), '150');
    fireEvent.press(screen.getByLabelText('Use custom price'));
    await act(async () => { fireEvent.press(screen.getByText('Add to inventory')); });
    const external = { ...card, candidateVersion: card.candidateVersion + 2, reviewVersion: 3,
        review: { ...card.review!, priceMinor: 99_000 } };
    screen.rerender(<BatchReviewCard {...props} card={external} addPending />);
    expect(screen.getByTestId('compact-authority-changed')).toBeTruthy();
    await act(async () => { result.resolve({ status: 'succeeded' }); });
    expect(screen.getByTestId('compact-authority-changed')).toBeTruthy();
    expect(screen.getByTestId('card-price-overlay')).toBeTruthy();
    expect(onDraftChange).not.toHaveBeenCalledWith(card.candidateId, {});
    expect(onAuthorityStateChange).not.toHaveBeenCalledWith(card.candidateId, false);
});
