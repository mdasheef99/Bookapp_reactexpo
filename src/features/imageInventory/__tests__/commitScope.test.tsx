jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanupAsync, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { InventoryCommitCoordinator } from '../commit/inventoryCommitCoordinator';
import { useInventoryCommitCoordinator } from '../commit/useInventoryCommitCoordinator';
import { pickerCard, pickerIdentity } from '../testing/editionPickerClientFixtures';
import { resetOwnerRequestFence } from '../identity/ownerRequestFence';
import { resetImageInventoryIdentityForTests } from '../queries/ownerUxQueries';

it.each(['userId', 'storeId', 'sessionId'])('hides old outcomes on the first render of a new %s scope', async field => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    const card = pickerCard();
    resetOwnerRequestFence(pickerIdentity); resetImageInventoryIdentityForTests(pickerIdentity);
    jest.spyOn(InventoryCommitCoordinator.prototype, 'addCandidate').mockResolvedValue({ candidateId: card.candidateId,
        status: 'succeeded', stage: 'complete', result: { sessionId: card.sessionId, candidateId: card.candidateId,
            candidateVersion: 9, inventoryId: 'inventory', inventoryVersion: 1, outcome: 'committed_private' } });
    const observations: boolean[] = [];
    const props = { ...pickerIdentity, sessionId: card.sessionId };
    const hook = renderHook((input: typeof props) => {
        const value = useInventoryCommitCoordinator(input, input.sessionId);
        if (input[field as keyof typeof input] !== props[field as keyof typeof props]) observations.push(value.outcomes.size > 0);
        return value;
    }, { initialProps: props, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
    await act(async () => { await hook.result.current.addCandidate({ card, edits: {}, acceptedAuthorityKey: 'unused' }); });
    expect(hook.result.current.outcomes.size).toBe(1);
    hook.rerender({ ...props, [field]: 'new-scope' });
    expect(observations.length).toBeGreaterThan(0);
    expect(observations).not.toContain(true);
    await cleanupAsync(); client.clear(); jest.restoreAllMocks();
});
