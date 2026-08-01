import { supabase } from '@/lib/supabase';
import {
    OwnerCorrectionClientError,
    ownerCorrectionService,
} from '../api/ownerCorrectionService';
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

    it('uses the fixed false reason and strictly decodes the returned candidate UUID', async () => {
        rpcResult({ data: testUuid(2), error: null }, true);
        await ownerCorrectionService.markFalse({
            candidateId: testUuid(2),
            expectedCandidateVersion: 4,
            idempotencyKey: 'false:00000000-0000-4000-8000-000000000001',
            commandId: testUuid(4),
        }, identity);
        expect(rpc).toHaveBeenCalledWith('phase9_skip_candidate', {
            p_candidate_id: testUuid(2),
            p_expected_version: 4,
            p_reason: 'false_detection',
            p_idempotency_key: 'false:00000000-0000-4000-8000-000000000001',
            p_command_id: testUuid(4),
        });
        rpcResult({ data: { candidate_id: testUuid(2) }, error: null }, true);
        await expect(ownerCorrectionService.markFalse({
            candidateId: testUuid(2), expectedCandidateVersion: 4,
            idempotencyKey: 'false:00000000-0000-4000-8000-000000000002',
            commandId: testUuid(5),
        }, identity)).rejects.toMatchObject({ code: 'P9_INTERNAL_ERROR' });
    });

    it('decodes M24 rows, filters to expected proposal IDs, and excludes provenance', async () => {
        rpcResult({ data: [
            {
                proposal_id: testUuid(11), concurrency_version: 2, target_type: 'title',
                author_position: null, confirmed_source_text: 'ಮೂಲ', proposed_text: 'Moola',
                variant_type: 'primary_roman', source_language: 'kn', source_script: 'Knda',
                variant_language: 'kn-Latn', variant_script: 'Latn', lifecycle_status: 'proposed',
                generation_source: 'model', provider_key: 'private-provider', model_key: 'private-model',
                model_version: 'private', prompt_version: 'private', schema_version: 'v1',
                automatic_activation_denial_reason: 'rollout_not_approved', stale_conflict_reason: null,
                created_at: '2026-08-01T00:00:00.000Z',
                allowed_actions: ['approve', 'reject', 'replace', 'leave_unresolved'],
            },
            {
                proposal_id: testUuid(12), concurrency_version: 1, target_type: 'author',
                author_position: 0, confirmed_source_text: 'Other', proposed_text: 'Other',
                variant_type: 'primary_roman', source_language: 'kn', source_script: 'Knda',
                variant_language: 'kn-Latn', variant_script: 'Latn', lifecycle_status: 'proposed',
                generation_source: 'model', provider_key: 'secret', model_key: 'secret', model_version: 'secret',
                prompt_version: 'secret', schema_version: 'v1', automatic_activation_denial_reason: null,
                stale_conflict_reason: null, created_at: '2026-07-31T00:00:00.000Z',
                allowed_actions: ['reject', 'leave_unresolved'],
            },
        ], error: null });
        const rows = await ownerCorrectionService.resolveExpectedVariants(
            testUuid(8),
            [{ proposalId: testUuid(11), version: 2 }],
            identity,
        );
        expect(rows).toEqual([expect.objectContaining({
            proposalId: testUuid(11),
            allowedActions: ['approve', 'reject', 'replace', 'leave_unresolved'],
        })]);
        expect(rows[0]).not.toHaveProperty('providerKey');
        expect(JSON.stringify(rows)).not.toContain('private-model');
        expect(rpc).toHaveBeenCalledWith('phase9_owner_search_variant_review', {
            p_store_id: testUuid(8), p_status: null, p_target_type: null,
            p_cursor_created_at: null, p_cursor_proposal_id: null, p_limit: 100,
        });
    });

    it('fails closed when a bounded M24 scan cannot resolve every expected proposal', async () => {
        rpcResult({ data: [], error: null });
        await expect(ownerCorrectionService.resolveExpectedVariants(
            testUuid(8), [{ proposalId: testUuid(11), version: 2 }], identity,
        )).rejects.toMatchObject({ code: 'P9_INTERNAL_ERROR' });
    });

    it('maps decide and replacement exactly and enforces Latn/English translation rules', async () => {
        rpcResult({ data: {
            decision_id: testUuid(20), proposal_id: testUuid(11), status: 'active', version: 3, replayed: false,
        }, error: null }, true);
        await ownerCorrectionService.decideVariant({
            storeId: testUuid(8), proposalId: testUuid(11), expectedVersion: 2,
            action: 'approve', reason: 'owner_approved', note: null,
            idempotencyKey: 'variant:00000000-0000-4000-8000-000000000001',
        }, identity);
        expect(rpc).toHaveBeenLastCalledWith('phase9_owner_decide_search_variant', {
            p_store_id: testUuid(8), p_proposal_id: testUuid(11), p_expected_version: 2,
            p_action: 'approve', p_reason: 'owner_approved', p_note: null,
            p_idempotency_key: 'variant:00000000-0000-4000-8000-000000000001',
        });

        await expect(ownerCorrectionService.replaceVariant({
            storeId: testUuid(8), sourceProposalId: testUuid(11), expectedVersion: 2,
            variantText: 'English title', variantLanguage: 'kn-Latn', variantScript: 'Latn',
            variantType: 'translation_candidate', reason: 'owner_replaced', note: null,
            idempotencyKey: 'variant:00000000-0000-4000-8000-000000000002',
        }, identity)).rejects.toMatchObject({ code: 'P9_REQUEST_INVALID' });
        expect(rpc).toHaveBeenCalledTimes(1);
    });

    it('keeps the C06/C07 and M24/M25 idempotency error systems distinct and hides raw errors', async () => {
        rpcResult({ data: null, error: { message: 'P9_IDEMPOTENCY_MISMATCH raw sql' } }, true);
        await expect(ownerCorrectionService.markFalse({
            candidateId: testUuid(2), expectedCandidateVersion: 4,
            idempotencyKey: 'false:00000000-0000-4000-8000-000000000001', commandId: testUuid(4),
        }, identity)).rejects.toMatchObject({ code: 'P9_IDEMPOTENCY_MISMATCH' });
        rpcResult({ data: null, error: { message: 'P9_IDEMPOTENCY_CONFLICT private row' } }, true);
        const failure = await ownerCorrectionService.decideVariant({
            storeId: testUuid(8), proposalId: testUuid(11), expectedVersion: 2,
            action: 'reject', reason: 'owner_rejected', note: null,
            idempotencyKey: 'variant:00000000-0000-4000-8000-000000000001',
        }, identity).catch((error) => error);
        expect(failure).toBeInstanceOf(OwnerCorrectionClientError);
        expect(failure).toMatchObject({ code: 'P9_IDEMPOTENCY_CONFLICT' });
        expect(String(failure)).not.toContain('private row');
    });

    it.each([
        ['C06', () => ownerCorrectionService.addManualCandidate({
            sessionId: testUuid(1), title: 'Book', authors: [], language: 'en',
            idempotencyKey: 'missed:00000000-0000-4000-8000-000000000001',
            commandId: testUuid(2),
        }, identity)],
        ['C07', () => ownerCorrectionService.markFalse({
            candidateId: testUuid(2), expectedCandidateVersion: 4,
            idempotencyKey: 'false:00000000-0000-4000-8000-000000000001',
            commandId: testUuid(4),
        }, identity)],
        ['M24', () => ownerCorrectionService.resolveExpectedVariants(
            identity.storeId, [{ proposalId: testUuid(11), version: 2 }], identity,
        )],
        ['M25', () => ownerCorrectionService.decideVariant({
            storeId: identity.storeId, proposalId: testUuid(11), expectedVersion: 2,
            action: 'reject', reason: 'owner_rejected', note: null,
            idempotencyKey: 'variant:00000000-0000-4000-8000-000000000001',
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
        const request = ownerCorrectionService.markFalse({
            candidateId: testUuid(2), expectedCandidateVersion: 4,
            idempotencyKey: 'false:00000000-0000-4000-8000-000000000001',
            commandId: testUuid(4),
        }, identity);
        await Promise.resolve();
        beginOwnerIdentityTransition();
        await expect(request).rejects.toMatchObject({ code: 'P9_AUTH_REQUIRED' });
        expect(builder.abortSignal.mock.calls[0][0].aborted).toBe(true);
        resolveRpc?.({ data: null, error: null });
    });
});
