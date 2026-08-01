import { QueryClient } from '@tanstack/react-query';
import {
    canMarkCandidateFalse,
    variantConflictChanges,
} from '../review/ownerCorrectionWorkflow';
import {
    buildMissedBookRequest,
    createEmptyMissedBookDraft,
} from '../review/missedBookForm';
import {
    imageInventoryKeys,
    coordinateImageInventoryIdentity,
    resetImageInventoryIdentityForTests,
} from '../queries/ownerUxQueries';
import {
    ownerCorrectionKeys,
    synchronizeCorrectionCandidate,
} from '../queries/ownerCorrectionQueries';
import { candidateDetailFixture, testUuid } from '../testing/ownerUxTestFixtures';

describe('Phase 9 Unit 6E correction workflow rules', () => {
    beforeEach(() => resetImageInventoryIdentityForTests());

    it('requires both canonical mark_false and a C07-supported candidate state', () => {
        expect(canMarkCandidateFalse(candidateDetailFixture())).toBe(true);
        expect(canMarkCandidateFalse(candidateDetailFixture({ candidateState: 'failed' }))).toBe(false);
        expect(canMarkCandidateFalse(candidateDetailFixture({ allowedActions: [] }))).toBe(false);
    });

    it('builds the minimal Unicode-preserving missed-book semantic request', () => {
        const draft = {
            ...createEmptyMissedBookDraft(),
            title: ' ಕನ್ನಡ ಪುಸ್ತಕ ',
            authors: [' ಲೇಖಕ '],
            language: 'KN-knda',
        };
        expect(buildMissedBookRequest(draft)).toEqual({
            success: true,
            value: { title: 'ಕನ್ನಡ ಪುಸ್ತಕ', authors: ['ಲೇಖಕ'], language: 'kn-Knda' },
        });
    });

    it('reports every stale proposal field that controls explicit reapply', () => {
        const previous = {
            proposalId: testUuid(10), version: 1, targetType: 'author' as const,
            authorPosition: 0, confirmedSourceText: 'ಮೂಲ', proposedText: 'Moola',
            variantType: 'primary_roman' as const, sourceLanguage: 'kn', sourceScript: 'Knda',
            variantLanguage: 'kn-Latn', variantScript: 'Latn', lifecycleStatus: 'proposed' as const,
            staleConflictReason: null, createdAt: '2026-08-01T00:00:00.000Z',
            allowedActions: ['approve', 'reject', 'replace', 'leave_unresolved'] as Array<'approve' | 'reject' | 'replace' | 'leave_unresolved'>,
        };
        expect(variantConflictChanges(previous, {
            ...previous,
            version: 2,
            proposedText: 'Mula',
            lifecycleStatus: 'stale',
            staleConflictReason: 'materially_changed',
            allowedActions: ['reject', 'replace', 'leave_unresolved'],
        })).toEqual(expect.arrayContaining([
            'Proposal version changed.',
            'Proposed text changed.',
            'Lifecycle status changed.',
            'Stale-conflict reason changed.',
            'Allowed actions changed.',
        ]));
    });

    it('synchronizes canonical candidate state only for the still-active identity and scope', async () => {
        const client = new QueryClient();
        const identity = { userId: testUuid(90), storeId: testUuid(8) };
        await coordinateImageInventoryIdentity(identity, client);
        const canonical = candidateDetailFixture({ candidateVersion: 5 });
        await synchronizeCorrectionCandidate(client, identity, testUuid(1), testUuid(2), canonical);
        expect(client.getQueryData(imageInventoryKeys.candidate(
            identity, testUuid(1), testUuid(2),
        ))).toEqual(canonical);
        await coordinateImageInventoryIdentity({ userId: testUuid(91), storeId: testUuid(8) }, client);
        await synchronizeCorrectionCandidate(client, identity, testUuid(1), testUuid(2), canonical);
        expect(client.getQueryData(imageInventoryKeys.candidate(
            identity, testUuid(1), testUuid(2),
        ))).toBeUndefined();
        client.clear();
    });

    it('identity-binds proposal queries through candidate and lifecycle version', () => {
        const first = ownerCorrectionKeys.variants(
            { userId: testUuid(90), storeId: testUuid(8) }, testUuid(1), testUuid(2),
            [{ proposalId: testUuid(11), version: 2 }],
        );
        const changedProposalVersion = ownerCorrectionKeys.variants(
            { userId: testUuid(90), storeId: testUuid(8) }, testUuid(1), testUuid(2),
            [{ proposalId: testUuid(11), version: 3 }],
        );
        expect(first).toEqual(expect.arrayContaining([
            testUuid(90), testUuid(8), testUuid(1), testUuid(2),
        ]));
        expect(first).not.toEqual(changedProposalVersion);
    });
});
