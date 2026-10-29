import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { Modal, TextInput } from 'react-native';
import { router } from 'expo-router';
import { decodeStoreViewResponse, STORE_VIEW_CONTRACT_VERSION, STORE_VIEW_ATTENTION_REASONS } from '../contracts/storeViewContracts';
import { usePublicationCommands } from '@/features/imageInventory/queries/publicationQueries';
import { useStoreViewManagementCommands } from '../queries/storeViewManagementQueries';
import { useStoreViewDetail } from '../queries/storeViewQueries';
import { StoreViewDetailContent } from '../screens/StoreViewDetailScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.setTimeout(30000);

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/features/imageInventory/queries/publicationQueries', () => ({ usePublicationCommands: jest.fn() }));
jest.mock('../queries/storeViewManagementQueries', () => ({ useStoreViewManagementCommands: jest.fn() }));
jest.mock('../queries/storeViewQueries', () => ({ useStoreViewDetail: jest.fn() }));
jest.mock('../queries/storeViewMediaCommands', () => ({
    useStoreViewMediaCommands: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../queries/storeViewMediaQueries', () => ({
    useStoreViewMedia: () => ({ isPending: false, isError: false, data: null, refetch: jest.fn() }),
}));
jest.mock('../queries/storeViewHistoryQueries', () => ({
    useStoreViewHistory: () => ({ isPending: false, isError: false, data: null }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        accent: '#2563eb', bgCard: '#fff', bgSecondary: '#eee', border: '#ddd',
        error: '#b91c1c', success: '#15803d', textPrimary: '#111',
        textSecondary: '#555', textTertiary: '#777',
    } }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/ui/GlassCard', () => ({
    GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const identity = { userId: 'owner-a', storeId: 'store-a' };
const inventoryId = '00000000-0000-4000-8000-000000000001';
const refetch = jest.fn().mockResolvedValue(undefined);
const managementMutate = jest.fn();
const publicationMutate = jest.fn();

function detail(overrides: Record<string, unknown> = {}) {
    return {
        identity: { inventoryId },
        presentation: {
            title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
            publicDescription: 'Public copy.', condition: 'good', publicConditionNote: 'Light wear.',
            hasDamage: false, damageTypes: [], damageNote: null, isSellable: true,
            sellingPriceMinor: 35000,
        },
        stockSummary: { quantityAvailable: 1, stockState: 'low_stock' },
        lifecycle: { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' },
        attention: { attentionState: 'none', attentionReasons: [] },
        capabilities: ['edit_details', 'adjust_stock', 'pause', 'make_private'],
        versions: { inventoryVersion: 3, publicationIntentVersion: 2 },
        mediaSummary: { approvedCount: 1 }, publicState: null,
        privateOperations: { shelfLocation: 'A3', internalNotes: 'Owner note' },
        stock: { quantityTotal: 1, quantityAvailable: 1, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
        historySummary: { publicRevisionCount: 1, latestPublicRevision: null },
        ...overrides,
    } as any;
}

function setDetail(data = detail()) {
    (useStoreViewDetail as jest.Mock).mockReturnValue({
        isPending: false, isError: false, data, refetch,
    });
}


const rows = [
    ['missing_price', "Customers can't see this book until it has a price.", 'Set price'],
    ['missing_condition', 'Add the condition so customers know what to expect.', 'Set condition'],
    ['missing_metadata', 'Add the missing book details before publishing.', 'Add details'],
    ['not_sellable', 'This book is marked as not sellable.', 'Mark as sellable'],
    ['damage_evidence_required', 'Damage information is incomplete. A damaged book needs a damage note, damage types and 1–3 approved damage photos. After adding photos, update and save the damage details to clear this.', 'Add damage details'],
    ['publication_failed', "This book couldn't be published. Try again.", 'Retry'],
    ['subscription_restricted', 'Your subscription restricts publishing this book.', 'View plan'],
    ['entitlement_blocked', 'Your plan does not currently allow publishing this book.', 'View plan'],
    ['active_listing_limit_reached', 'Your plan has reached its active listing limit.', 'View plan'],
    ['moderation_blocked', 'This book is blocked by moderation.', null],
    ['store_policy_blocked', 'Store policy prevents publishing this book.', null],
] as const;
function showReason(reason: string, capabilities: string[] = ['edit_details', 'retry_publication']) {
    setDetail(detail({ attention: { attentionState: 'action_required', attentionReasons: [reason] }, capabilities }));
    return render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
}
beforeEach(() => {
    jest.clearAllMocks();
    setDetail();
    (useStoreViewManagementCommands as jest.Mock).mockReturnValue({ mutateAsync: managementMutate, isPending: false });
    (usePublicationCommands as jest.Mock).mockReturnValue({ mutateAsync: publicationMutate, isPending: false });
    managementMutate.mockResolvedValue({ outcome: 'details_updated' });
    publicationMutate.mockResolvedValue({ outcome: 'retry_requested' });
    refetch.mockResolvedValue({ data: detail(), error: null });
});

describe('Slice 1a price UI', () => {
    it('labels the input in rupees and saves 250 as 25000 paise', async () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-edit'));
        expect(screen.getByLabelText('Selling price (₹)')).toBeTruthy();
        fireEvent.changeText(screen.getByLabelText('Selling price (₹)'), '250');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(managementMutate).toHaveBeenCalledWith(expect.objectContaining({ changes: { sellingPriceMinor: 25000 } })));
        await waitFor(() => expect(screen.getByText('Changes saved.')).toBeTruthy());
    });
    it.each([25050, 2147483647])('saves only title with untouched %i paise', async (price) => {
        setDetail(detail({ presentation: { ...detail().presentation, sellingPriceMinor: price } }));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-edit'));
        fireEvent.changeText(screen.getByTestId('store-view-edit-title'), 'New title');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(managementMutate).toHaveBeenCalledWith(expect.objectContaining({ changes: { title: 'New title' } })));
        await waitFor(() => expect(screen.getByText('Changes saved.')).toBeTruthy());
    });
});

describe('Slice 1a attention rows', () => {
    it('keeps the Attention label outside the value test ID when there are no reasons', () => {
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        const value = screen.getByTestId('store-view-detail-attention');
        expect(value).toHaveTextContent('None', { exact: true });
        expect(within(value).queryByText('Attention')).toBeNull();
        expect(screen.getByText('Attention')).toBeTruthy();
    });
    it('puts the reason rows inside the value test ID without the Attention label', () => {
        const screen = showReason('missing_price');
        const value = within(screen.getByTestId('store-view-detail-attention'));
        expect(value.getByText(rows[0][1])).toBeTruthy();
        expect(value.getByText('Set price')).toBeTruthy();
        expect(value.queryByText('Attention')).toBeNull();
    });
    it('covers exactly every known contract reason', () => {
        expect(rows.map(([reason]) => reason).sort()).toEqual([...STORE_VIEW_ATTENTION_REASONS].sort());
    });
    it.each(rows)('renders %s with its explanation and action', (reason, explanation, button) => {
        const screen = showReason(reason);
        expect(screen.getByText(explanation)).toBeTruthy();
        const action = screen.queryByTestId(`store-view-fix-${reason}`);
        if (button) expect(action).toHaveTextContent(button);
        else expect(action).toBeNull();
    });
    it.each(rows.filter((row) => row[2] && row[2] !== 'View plan'))('hides the %s mutation action without its capability', (reason) => {
        const screen = showReason(reason, ['manage_photos']);
        expect(screen.queryByTestId(`store-view-fix-${reason}`)).toBeNull();
    });
    it.each(rows.slice(0, 5))('%s opens the edit form', (reason) => {
        const screen = showReason(reason);
        fireEvent.press(screen.getByTestId(`store-view-fix-${reason}`));
        expect(screen.getByText('Edit book')).toBeTruthy();
    });
    it('focuses price only after the modal opens, including a second opening', () => {
        const focus = jest.spyOn(TextInput.prototype, 'focus');
        setDetail(detail({ attention: { attentionState: 'action_required', attentionReasons: ['missing_price'] } }));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        fireEvent.press(screen.getByTestId('store-view-fix-missing_price'));
        expect(focus).not.toHaveBeenCalled();
        fireEvent(screen.UNSAFE_getAllByType(Modal)[0], 'show');
        expect(focus).toHaveBeenCalledTimes(1);
        expect(focus.mock.instances[0]).toBe(screen.UNSAFE_getAllByType(TextInput).find((input) => input.props.testID === 'store-view-edit-price-minor')!.instance);
        fireEvent.press(screen.getByText('Cancel'));
        fireEvent.press(screen.getByTestId('store-view-fix-missing_price'));
        fireEvent(screen.UNSAFE_getAllByType(Modal)[0], 'show');
        expect(focus).toHaveBeenCalledTimes(2);
        focus.mockRestore();
    });
    it('offers damage details without a photo action or photo read', () => {
        const media = require('../queries/storeViewMediaQueries');
        const read = jest.spyOn(media, 'useStoreViewMedia');
        const screen = showReason('damage_evidence_required');
        expect(screen.getByText('Add damage details')).toBeTruthy();
        expect(screen.queryByText('Add damage photo')).toBeNull();
        expect(read.mock.calls.every((call: any[]) => call[2] === false)).toBe(true);
        read.mockRestore();
    });
    it('Retry runs the existing publication retry', async () => {
        const screen = showReason('publication_failed', ['retry_publication']);
        fireEvent.press(screen.getByTestId('store-view-fix-publication_failed'));
        await waitFor(() => expect(publicationMutate).toHaveBeenCalledWith(expect.objectContaining({ intent: 'retry' })));
        await waitFor(() => expect(screen.getByText('Publication retry requested.')).toBeTruthy());
    });
    it.each(rows.slice(6, 9))('%s navigates to subscription without capabilities', (reason) => {
        const screen = showReason(reason, []);
        fireEvent.press(screen.getByTestId(`store-view-fix-${reason}`));
        expect(router.push).toHaveBeenCalledWith('/(store-owner)/subscription');
    });
    it.each(['management', 'publication'])('disables every action while %s is busy', (kind) => {
        const hook = kind === 'management' ? useStoreViewManagementCommands : usePublicationCommands;
        (hook as jest.Mock).mockReturnValue({ isPending: true });
        setDetail(detail({ attention: { attentionState: 'action_required', attentionReasons: rows.map((row) => row[0]) }, capabilities: ['edit_details', 'retry_publication'] }));
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        for (const [reason, , button] of rows) if (button) expect(screen.getByTestId(`store-view-fix-${reason}`)).toBeDisabled();
    });
    it('disables reason buttons throughout refreshing after save', async () => {
        refetch.mockReturnValue(new Promise(() => {}));
        const screen = showReason('missing_price');
        fireEvent.press(screen.getByTestId('store-view-fix-missing_price'));
        fireEvent.changeText(screen.getByTestId('store-view-edit-price-minor'), '250');
        fireEvent.press(screen.getByTestId('store-view-save-changes'));
        await waitFor(() => expect(screen.getByText('Changes saved. Updating details…')).toBeTruthy());
        expect(screen.getByTestId('store-view-fix-missing_price')).toBeDisabled();
        screen.unmount();
    });
    it('decodes future reason codes and humanises them without an action', () => {
        const book = detail({ attention: { attentionState: 'action_required', attentionReasons: ['future_reason_code'] } });
        const decoded = decodeStoreViewResponse('read_store_view_detail', { contractVersion: STORE_VIEW_CONTRACT_VERSION, data: book });
        setDetail(decoded);
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        expect(screen.getByText('future reason code')).toBeTruthy();
        expect(screen.queryByTestId('store-view-fix-future_reason_code')).toBeNull();
    });
});
