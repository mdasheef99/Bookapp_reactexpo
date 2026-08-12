import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import InventoryItem from '@/features/stores/components/InventoryItem';
import { publicationService, PublicationClientError } from '../api/publicationService';
import { supabase } from '@/lib/supabase';
import { usePublicationCommands } from '../queries/publicationQueries';

jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
const invoke = supabase.functions.invoke as jest.Mock;
const uuid = (last: number) => `00000000-0000-4000-8000-${String(last).padStart(12, '0')}`;

const serverResult = (overrides = {}) => ({
    contractVersion: 'phase9-publication-v1',
    data: {
        inventoryId: uuid(1), inventoryVersion: 1, publicationIntentVersion: 2,
        publicationStatus: 'published', visibilityStatus: 'published',
        publicationRetryable: false, publicationFailureReason: null,
        outcome: 'published', listingId: uuid(2), ...overrides,
    },
});

describe('real publication server to client to UI contract', () => {
    beforeEach(() => onlineManager.setOnline(true));

    it('U7B-RT19 realistic Edge responses pass through the real decoder query model and publication controls', async () => {
        invoke.mockResolvedValueOnce({ data: serverResult(), error: null });
        const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
        const invalidate = jest.spyOn(client, 'invalidateQueries');
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        const hook = renderHook(() => usePublicationCommands({ userId: uuid(8), storeId: uuid(9) }), { wrapper });
        let decoded: Awaited<ReturnType<typeof publicationService.setState>> | undefined;
        await act(async () => {
            decoded = await hook.result.current.mutateAsync({
                inventoryId: uuid(1), inventoryVersion: 1,
                publicationIntentVersion: 1, intent: 'publish',
            });
        });
        if (!decoded) throw new Error('publication query returned no result');
        expect(invalidate).toHaveBeenCalledWith({ queryKey: expect.arrayContaining([
            'phase9', 'ownerInventory',
        ]) });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['marketplace'] });
        const pause = jest.fn();
        const screen = render(<InventoryItem item={{
            id: decoded.inventoryId, title: 'Published book', condition: 'good',
            quantity_available: 2, selling_price_minor: 500,
            visibility_status: decoded.visibilityStatus,
            listing_quality_status: 'ready', publication_status: decoded.publicationStatus,
            publication_retryable: decoded.publicationRetryable,
        }} onPause={pause} />);
        fireEvent.press(screen.getByTestId(`pause-${uuid(1)}`));
        expect(pause).toHaveBeenCalledWith(uuid(1));
        hook.unmount();
        client.clear();
    });

    it('publication_failed response decodes and exposes Retry publication', async () => {
        invoke.mockResolvedValueOnce({ data: serverResult({
            publicationStatus: 'publication_failed', visibilityStatus: 'draft',
            publicationRetryable: true, publicationFailureReason: 'projection_temporarily_unavailable',
            outcome: 'committed_publication_failed', listingId: null,
        }), error: null });
        const decoded = await publicationService.readStatus(uuid(1));
        const retry = jest.fn();
        const screen = render(<InventoryItem item={{
            id: decoded.inventoryId, title: 'Failed publication', condition: 'good',
            quantity_available: 2, selling_price_minor: 500, visibility_status: 'draft',
            listing_quality_status: 'ready', publication_status: decoded.publicationStatus,
            publication_retryable: decoded.publicationRetryable,
        }} onRetryPublication={retry} />);
        fireEvent.press(screen.getByTestId(`retry-publication-${uuid(1)}`));
        expect(retry).toHaveBeenCalledWith(uuid(1));
        expect(screen.queryByTestId(`publish-${uuid(1)}`)).toBeNull();
    });

    it('deterministic eligibility 4xx decodes as corrective and never transient Retry state', async () => {
        invoke.mockResolvedValueOnce({ data: null, error: { context: {
            json: async () => ({ error: 'P9_MEDIA_NOT_APPROVED', retryable: false,
                message: 'Add approved damage photos before publishing.' }),
        } } });
        await expect(publicationService.setState({
            inventoryId: uuid(1), expectedInventoryVersion: 1,
            expectedPublicationIntentVersion: 1, intent: 'publish',
            idempotencyKey: 'publication-command-0001', commandId: uuid(2),
        })).rejects.toMatchObject<Partial<PublicationClientError>>({
            code: 'P9_MEDIA_NOT_APPROVED', retryable: false,
        });
        const screen = render(<InventoryItem item={{
            id: uuid(1), title: 'Needs damage evidence', condition: 'good',
            quantity_available: 2, selling_price_minor: 500, visibility_status: 'draft',
            listing_quality_status: 'ready', publication_status: 'private',
            publication_retryable: false,
        }} />);
        expect(screen.queryByTestId(`retry-publication-${uuid(1)}`)).toBeNull();
    });
});
