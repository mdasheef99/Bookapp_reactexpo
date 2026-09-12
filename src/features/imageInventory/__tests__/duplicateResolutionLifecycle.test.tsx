import { act, renderHook } from '@testing-library/react-native';
import { useResolveDuplicateOwnerInventoryInput } from '../queries/ownerUxInputQueries';
import { resetOwnerRequestFence } from '../identity/ownerRequestFence';

const mockIdentity = { userId: 'owner', storeId: 'store' };
const mockResolve = jest.fn();
const mockInvalidate = jest.fn();
jest.mock('../api/ownerUxService', () => ({ ownerUxService: {
    resolveDuplicateInput: (...args: unknown[]) => mockResolve(...args),
} }));
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
    useMutation: (options: unknown) => options,
}));
jest.mock('../queries/ownerUxQueries', () => ({
    getResolvedImageInventoryIdentity: () => mockIdentity,
    imageInventoryKeys: Object.fromEntries(['discovery', 'session', 'inputs', 'readiness', 'identity']
        .map((name) => [name, () => [name]])),
}));

beforeEach(() => { jest.clearAllMocks(); resetOwnerRequestFence(mockIdentity); });

it.each(['session change', 'unmount'])('fences a pending duplicate request on %s', async (transition) => {
    let finish!: (value: unknown) => void;
    mockResolve.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const hook = renderHook<ReturnType<typeof useResolveDuplicateOwnerInventoryInput>, { sessionId: string }>(
        ({ sessionId }) => useResolveDuplicateOwnerInventoryInput(mockIdentity, sessionId),
        { initialProps: { sessionId: 'first' } });
    const options = hook.result.current as any;
    const result = options.mutationFn({ sessionId: 'first' }).catch((error: Error) => error);
    const signal = mockResolve.mock.calls[0][1] as AbortSignal;
    if (transition === 'unmount') hook.unmount();
    else hook.rerender({ sessionId: 'second' });
    expect(signal.aborted).toBe(true);
    await act(async () => { finish({ sessionId: 'first' }); });
    expect(await result).toBeInstanceOf(Error);
    await options.onSuccess({ sessionId: 'first' });
    expect(mockInvalidate).not.toHaveBeenCalled();
});

it('rejects a response for a different session before success', async () => {
    mockResolve.mockResolvedValue({ sessionId: 'other' });
    const hook = renderHook(() => useResolveDuplicateOwnerInventoryInput(mockIdentity, 'first'));
    await expect((hook.result.current as any).mutationFn({ sessionId: 'first' }))
        .rejects.toThrow('OWNER_INPUT_AUTHORITY_CHANGED');
});
