import { supabase } from '@/lib/supabase';
import { ownerCorrectionService } from '../api/ownerCorrectionService';
import { testUuid } from '../testing/ownerUxTestFixtures';
import {
    beginOwnerIdentityTransition,
    resetOwnerRequestFence,
} from '../identity/ownerRequestFence';

jest.mock('@/lib/supabase', () => ({
    supabase: {
        auth: { getUser: jest.fn() },
        rpc: jest.fn(),
    },
}));

const rpc = supabase.rpc as jest.Mock;
const getUser = supabase.auth.getUser as jest.Mock;
const identity = { userId: testUuid(90), storeId: testUuid(8) };
const rpcResult = (result: unknown, once = false) => {
    const builder = { abortSignal: jest.fn().mockResolvedValue(result) };
    if (once) rpc.mockReturnValueOnce(builder);
    else rpc.mockReturnValue(builder);
    return builder;
};

describe('Phase 9 Unit 6E correction RPC contracts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetOwnerRequestFence(identity);
        getUser.mockResolvedValue({ data: { user: { id: testUuid(90) } }, error: null });
    });

    it('normalizes strict C06 input and maps the exact named RPC arguments', async () => {
        rpcResult({ data: testUuid(3), error: null });
        await expect(ownerCorrectionService.addManualCandidate({
            sessionId: testUuid(1),
            title: '  ಕನ್ನಡ ಪುಸ್ತಕ  ',
            authors: [' ಲೇಖಕ ಒಬ್ಬರು ', 'Author Two'],
            language: 'KN-knda',
            idempotencyKey: 'missed:00000000-0000-4000-8000-000000000001',
            commandId: testUuid(2),
        }, identity)).resolves.toEqual({ candidateId: testUuid(3), authenticatedUserId: testUuid(90) });
        expect(rpc).toHaveBeenCalledWith('phase9_add_manual_candidate', {
            p_session_id: testUuid(1),
            p_title: 'ಕನ್ನಡ ಪುಸ್ತಕ',
            p_authors: ['ಲೇಖಕ ಒಬ್ಬರು', 'Author Two'],
            p_language: 'kn-Knda',
            p_idempotency_key: 'missed:00000000-0000-4000-8000-000000000001',
            p_command_id: testUuid(2),
        });
    });

    it.each([
        { title: '', authors: [], language: 'en' },
        { title: '<script>alert(1)</script>', authors: [], language: 'en' },
        { title: 'Book', authors: ['Author', ' Author '], language: 'en' },
        { title: 'Book', authors: [], language: 'not_a_tag' },
        { title: 'Book', authors: [], language: 'en', quantity: 1 },
    ])('rejects invalid or unsupported C06 input before transport', async (input) => {
        await expect(ownerCorrectionService.addManualCandidate({
            sessionId: testUuid(1),
            idempotencyKey: 'missed:00000000-0000-4000-8000-000000000001',
            commandId: testUuid(2),
            ...input,
        }, identity)).rejects.toMatchObject({ code: 'P9_REQUEST_INVALID' });
        expect(rpc).not.toHaveBeenCalled();
    });

    it.each([
        ['C06', () => ownerCorrectionService.addManualCandidate({
            sessionId: testUuid(1), title: 'Book', authors: [], language: 'en',
            idempotencyKey: 'missed:00000000-0000-4000-8000-000000000001',
            commandId: testUuid(2),
        }, identity)],
    ] as const)('blocks %s transport when identity changes during auth resolution', async (_name, invoke) => {
        let resolveAuth!: (value: unknown) => void;
        getUser.mockReturnValue(new Promise((resolve) => { resolveAuth = resolve; }));
        const request = invoke();
        beginOwnerIdentityTransition();
        resolveAuth({ data: { user: { id: identity.userId } }, error: null });
        await expect(request).rejects.toMatchObject({ code: 'P9_AUTH_REQUIRED' });
        expect(rpc).not.toHaveBeenCalled();
    });

    it('aborts an active correction transport when identity changes', async () => {
        let resolveRpc!: (value: unknown) => void;
        const builder = {
            abortSignal: jest.fn((signal: AbortSignal) => new Promise((resolve) => {
                signal.addEventListener('abort', () => resolve({ data: null, error: null }), { once: true });
                resolveRpc = resolve;
            })),
        };
        rpc.mockReturnValue(builder);
        const request = ownerCorrectionService.addManualCandidate({
            sessionId: testUuid(1), title: 'Book', authors: [], language: 'en',
            idempotencyKey: 'missed:00000000-0000-4000-8000-000000000001',
            commandId: testUuid(4),
        }, identity);
        await Promise.resolve();
        beginOwnerIdentityTransition();
        await expect(request).rejects.toMatchObject({ code: 'P9_AUTH_REQUIRED' });
        expect(builder.abortSignal.mock.calls[0][0].aborted).toBe(true);
        resolveRpc?.({ data: null, error: null });
    });
});
