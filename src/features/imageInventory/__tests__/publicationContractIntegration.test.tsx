import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import InventoryItem from '@/features/stores/components/InventoryItem';
import { publicationService, PublicationClientError } from '../api/publicationService';
import { supabase } from '@/lib/supabase';
import { usePublicationCommands } from '../queries/publicationQueries';
import { parseOwnerIngestionRequest } from '../../../../supabase/functions/_shared/imageInventory/contracts/ingestion';
import { executeOwnerIngestion } from '../../../../supabase/functions/_shared/imageInventory/runtime/ownerIngestion';
import { ownerUxErrorFromException } from '../../../../supabase/functions/_shared/imageInventory/contracts/ownerUxErrors';

jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
const invoke = supabase.functions.invoke as jest.Mock;
const uuid = (last: number) => `00000000-0000-4000-8000-${String(last).padStart(12, '0')}`;
jest.setTimeout(60_000);
type Generated = {
    fixture: { inventoryId: string; ownerId: string }; commandId: string; idempotencyKey: string;
    data?: Record<string, unknown>; error?: string;
};
const generatedResults = process.env.UNIT7B_RUNTIME_PAYLOAD
    ? JSON.parse(process.env.UNIT7B_RUNTIME_PAYLOAD) as Record<string, Generated>
    : null;

async function runtimeResult(options: { transient?: boolean; priceMinor?: number } = {}) {
    const mode = options.priceMinor === 0 ? 'deterministic' : options.transient ? 'transient' : 'published';
    const generated = generatedResults?.[mode];
    if (!generated) throw new Error('UNIT7B runtime database evidence is required');
    const fixture = generated.fixture;
    const rpc = async (name: string, _params: Record<string, unknown>) => {
        if (name !== 'phase9_set_publication_state_v2') throw new Error('unexpected RPC');
        if (generated.error) return { data: null, error: new Error(generated.error) };
        return { data: generated.data, error: null };
    };
    const request = parseOwnerIngestionRequest({
        action: 'set_publication_state', contractVersion: 'phase9-publication-v1',
        inventoryId: fixture.inventoryId, expectedInventoryVersion: 1,
        expectedPublicationIntentVersion: 1, intent: 'publish',
        idempotencyKey: generated.idempotencyKey, commandId: generated.commandId,
    });
    try {
        return { envelope: await executeOwnerIngestion(request, fixture.ownerId,
            { rpc, storage: { from: jest.fn() } } as any, {} as any), fixture };
    } catch (error) {
        return { error: ownerUxErrorFromException(error), fixture };
    }
}

(generatedResults ? describe : describe.skip)('real publication server to client to UI contract', () => {
    beforeEach(() => onlineManager.setOnline(true));

    it('U7B-RT19 realistic Edge responses pass through the real decoder query model and publication controls', async () => {
        const runtime = await runtimeResult();
        invoke.mockResolvedValueOnce({ data: runtime.envelope, error: null });
        const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
        const invalidate = jest.spyOn(client, 'invalidateQueries');
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        const hook = renderHook(() => usePublicationCommands({ userId: uuid(8), storeId: uuid(9) }), { wrapper });
        let decoded: Awaited<ReturnType<typeof publicationService.setState>> | undefined;
        await act(async () => {
            decoded = await hook.result.current.mutateAsync({
                inventoryId: runtime.fixture.inventoryId, inventoryVersion: 1,
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
        fireEvent.press(screen.getByTestId(`pause-${decoded.inventoryId}`));
        expect(pause).toHaveBeenCalledWith(decoded.inventoryId);
        hook.unmount();
        client.clear();
    });

    it('publication_failed response decodes and exposes Retry publication', async () => {
        const runtime = await runtimeResult({ transient: true });
        invoke.mockResolvedValueOnce({ data: runtime.envelope, error: null });
        const decoded = await publicationService.readStatus(runtime.fixture.inventoryId);
        const retry = jest.fn();
        const screen = render(<InventoryItem item={{
            id: decoded.inventoryId, title: 'Failed publication', condition: 'good',
            quantity_available: 2, selling_price_minor: 500, visibility_status: 'draft',
            listing_quality_status: 'ready', publication_status: decoded.publicationStatus,
            publication_retryable: decoded.publicationRetryable,
        }} onRetryPublication={retry} />);
        fireEvent.press(screen.getByTestId(`retry-publication-${decoded.inventoryId}`));
        expect(retry).toHaveBeenCalledWith(decoded.inventoryId);
        expect(screen.queryByTestId(`publish-${decoded.inventoryId}`)).toBeNull();
    });

    it('deterministic eligibility 4xx decodes as corrective and never transient Retry state', async () => {
        const runtime = await runtimeResult({ priceMinor: 0 });
        invoke.mockResolvedValueOnce({ data: null, error: { context: {
            json: async () => runtime.error?.body,
        } } });
        await expect(publicationService.setState({
            inventoryId: uuid(1), expectedInventoryVersion: 1,
            expectedPublicationIntentVersion: 1, intent: 'publish',
            idempotencyKey: 'publication-command-0001', commandId: uuid(2),
        })).rejects.toMatchObject<Partial<PublicationClientError>>({
            code: 'P9_PUBLICATION_INELIGIBLE', retryable: false,
        });
        const screen = render(<InventoryItem item={{
            id: uuid(1), title: 'Needs damage evidence', condition: 'good',
            quantity_available: 2, selling_price_minor: 500, visibility_status: 'draft',
            listing_quality_status: 'ready', publication_status: 'private',
            publication_retryable: false,
        }} />);
        expect(screen.queryByTestId(`retry-publication-${uuid(1)}`)).toBeNull();
    });

    it('malformed runtime envelope fails closed in the real client decoder', async () => {
        const runtime = await runtimeResult();
        invoke.mockResolvedValueOnce({ data: { ...runtime.envelope, incompatible: true }, error: null });
        await expect(publicationService.readStatus(runtime.fixture.inventoryId))
            .rejects.toMatchObject({ code: 'P9_RESPONSE_INVALID', retryable: false });
    });
});
