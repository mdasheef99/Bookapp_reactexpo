import { OwnerUxClientError } from '../api/ownerUxService';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';
import {
    CandidateCommandRegistry,
    InventoryCommitCoordinator,
    type CandidateCommitDraft,
    type InventoryCommitCoordinatorDependencies,
} from '../commit/inventoryCommitCoordinator';
import { candidateDetailFixture, testUuid } from '../testing/ownerUxTestFixtures';

const sessionId = testUuid(1);
const inventoryId = testUuid(90);

const review: OwnerCandidateReview = {
    originalTitle: 'Review title', authors: ['Review author'], originalLanguage: 'en', script: 'Latn',
    metadataChoice: { mode: 'manual', selectionId: null }, quantity: 1, priceMinor: 100,
    baseCondition: 'good', damageDisclosure: {
        hasDamage: false, damageTypes: [], damageNote: null, isSellable: true,
        completeReadableSafe: true,
    },
    shelfLocation: 'A1', notes: { publicNote: null, internalNote: null },
    publicationIntent: 'private', duplicateIntent: null,
    originalFieldConfirmation: { title: true, authors: [true] },
    candidateDisposition: 'reviewed',
};

function draft(index: number, overrides: Partial<OwnerBatchReviewCard> = {}): CandidateCommitDraft {
    const candidateId = testUuid(index + 10);
    return {
        card: {
            sessionId, candidateId, inputId: testUuid(2), ordinal: index,
            candidateState: 'ready', candidateVersion: 4, metadataState: 'manual',
            metadataRevision: 7, reviewVersion: 2, reviewDisposition: 'reviewed',
            observed: { title: `Book ${index}`, authors: ['Author'], language: 'en', script: 'Latn' },
            metadataSummary: null, review, fieldSources: {
                cover: 'missing', title: 'custom', authors: 'custom', language: 'custom',
                condition: 'custom', price: 'custom', quantity: 'default', location: 'custom',
                publication: 'default', damage: 'default',
            },
            attentionCodes: [], blockers: [], reviewReady: true,
            allowedActions: ['save_review', 'add_to_inventory'],
            updatedAt: '2026-08-25T00:00:00.000Z',
            ...overrides,
        },
        edits: {},
    };
}

function readyDetail(candidateId: string, overrides: Partial<OwnerCandidateDetail> = {}) {
    return candidateDetailFixture({
        sessionId, candidateId, candidateState: 'ready', candidateVersion: 5,
        allowedActions: ['save_review', 'add_to_inventory'],
        review: { value: review, reviewVersion: 3 },
        readiness: {
            reviewReady: true, blockers: [], derivedFromCandidateVersion: 5,
            derivedFromMetadataRevision: 7, derivedFromDuplicateAdviceVersion: null,
        },
        metadata: {
            ...candidateDetailFixture().metadata,
            revision: 7,
        },
        ...overrides,
    });
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

async function eventually(assertion: () => void) {
    for (let count = 0; count < 50; count += 1) {
        try { assertion(); return; } catch { await Promise.resolve(); }
    }
    assertion();
}

function harness(custom: Partial<InventoryCommitCoordinatorDependencies> = {}) {
    let serial = 0;
    const saveReview = jest.fn(async (request) => readyDetail(request.candidateId));
    const readCandidate = jest.fn(async (_session: string, candidateId: string) => readyDetail(candidateId));
    const commitCandidate = jest.fn(async (request) => ({
        sessionId: request.sessionId, candidateId: request.candidateId,
        candidateVersion: request.expectedCandidateVersion + 1,
        inventoryId, inventoryVersion: 1, outcome: 'committed_private' as const,
    }));
    const synchronizeSuccess = jest.fn(async () => undefined);
    const synchronizeIneligible = jest.fn(async () => undefined);
    const dependencies: InventoryCommitCoordinatorDependencies = {
        saveReview, readCandidate, commitCandidate, synchronizeSuccess,
        synchronizeIneligible,
        createIdempotencyKey: (prefix) => `${prefix}:fixed-command-${++serial}`,
        createCommandId: () => testUuid(100 + ++serial),
        ...custom,
    };
    const registry = new CandidateCommandRegistry();
    const coordinator = new InventoryCommitCoordinator(dependencies, registry);
    return {
        coordinator,
        registry,
        saveReview: dependencies.saveReview as jest.Mock,
        readCandidate: dependencies.readCandidate as jest.Mock,
        commitCandidate: dependencies.commitCandidate as jest.Mock,
        synchronizeSuccess: dependencies.synchronizeSuccess as jest.Mock,
        synchronizeIneligible: dependencies.synchronizeIneligible as jest.Mock,
    };
}

describe('Phase 9 NEW 6G-D inventory commit coordinator', () => {
    it('waits for canonical Save success before Add and blocks Add when Save fails', async () => {
        const save = deferred<OwnerCandidateDetail>();
        const first = harness({ saveReview: jest.fn(() => save.promise) });
        const item = { ...draft(1), edits: { baseCondition: 'acceptable' as const } };
        const pending = first.coordinator.addCandidate(item);
        expect(first.commitCandidate).not.toHaveBeenCalled();
        save.resolve(readyDetail(item.card.candidateId));
        await expect(pending).resolves.toMatchObject({ status: 'succeeded' });
        expect(first.saveReview).toHaveBeenCalledTimes(1);
        expect(first.commitCandidate).toHaveBeenCalledTimes(1);

        const failure = harness({ saveReview: jest.fn(async () => { throw new Error('save failed'); }) });
        await expect(failure.coordinator.addCandidate(item)).resolves.toMatchObject({
            status: 'failed_retryable', stage: 'save',
        });
        expect(failure.commitCandidate).not.toHaveBeenCalled();
    });

    it('revalidates current server authority immediately before M39 and fails closed', async () => {
        const item = draft(1);
        const changed = readyDetail(item.card.candidateId, {
            allowedActions: [],
            readiness: {
                reviewReady: false, blockers: [], derivedFromCandidateVersion: 5,
                derivedFromMetadataRevision: 7, derivedFromDuplicateAdviceVersion: null,
            },
        });
        const test = harness({ readCandidate: jest.fn(async () => changed) });
        await expect(test.coordinator.addCandidate(item)).resolves.toMatchObject({
            status: 'no_longer_eligible', stage: 'revalidate',
        });
        expect(test.readCandidate).toHaveBeenCalledTimes(1);
        expect(test.commitCandidate).not.toHaveBeenCalled();
    });

    it('freezes exact-N identity and never admits later candidates or changed aggregate membership', async () => {
        const test = harness();
        const candidates = [draft(1), draft(2), draft(3)];
        const command = test.coordinator.freezeAddAll(candidates);
        expect(command.exactN).toBe(3);
        expect(command.candidateIds).toEqual(candidates.map((item) => item.card.candidateId));

        candidates.push(draft(4));
        candidates[1] = { ...candidates[1], edits: { quantity: 9 } };
        const result = await test.coordinator.runAddAll(command);
        expect(result.exactN).toBe(3);
        expect(result.outcomes.map((outcome) => outcome.candidateId)).toEqual(command.candidateIds);
        expect(test.commitCandidate).toHaveBeenCalledTimes(3);
        expect(test.commitCandidate.mock.calls.flatMap((call) => [call[0].candidateId]))
            .not.toContain(candidates[3].card.candidateId);
    });

    it('runs N=8 with a hard maximum of three in-flight candidate chains', async () => {
        let current = 0;
        let highWater = 0;
        const gates = new Map<string, ReturnType<typeof deferred<ReturnType<
            InventoryCommitCoordinatorDependencies['commitCandidate']
        > extends Promise<infer T> ? T : never>>>();
        const commitCandidate = jest.fn((request) => {
            current += 1;
            highWater = Math.max(highWater, current);
            const gate = deferred<any>();
            gates.set(request.candidateId, gate);
            return gate.promise.finally(() => { current -= 1; });
        });
        const test = harness({ commitCandidate });
        const command = test.coordinator.freezeAddAll(Array.from({ length: 8 }, (_, index) => draft(index + 1)));
        const pending = test.coordinator.runAddAll(command);
        await eventually(() => expect(gates.size).toBe(3));
        expect(highWater).toBe(3);
        const resolved = new Set<string>();
        const release = async (which: 'first' | 'last') => {
            const available = [...gates.entries()].filter(([candidateId]) => !resolved.has(candidateId));
            const [candidateId, gate] = which === 'first' ? available[0] : available.at(-1)!;
            const previousSize = gates.size;
            resolved.add(candidateId);
            gate.resolve({ sessionId, candidateId, candidateVersion: 6, inventoryId: testUuid(90), inventoryVersion: 1, outcome: 'committed_private' });
            if (previousSize < 8) await eventually(() => expect(gates.size).toBe(previousSize + 1));
        };
        // Complete the initial three out of order, then continue releasing the
        // newest request. Result aggregation must not depend on completion order.
        await release('last');
        await release('first');
        while (resolved.size < 8) await release('last');
        const result = await pending;
        expect(result).toMatchObject({ exactN: 8, succeeded: 8 });
        expect(result.outcomes.map((outcome) => outcome.candidateId)).toEqual(command.candidateIds);
        expect(highWater).toBe(3);
    });

    it('arbitrates card Add versus Add-all synchronously in both directions', async () => {
        const gate = deferred<any>();
        const first = harness({ commitCandidate: jest.fn(() => gate.promise) });
        const item = draft(1);
        const cardPending = first.coordinator.addCandidate(item);
        await eventually(() => expect(first.registry.isClaimed(item.card.candidateId)).toBe(true));
        const bulkWhileCard = first.coordinator.freezeAddAll([item]);
        await expect(first.coordinator.runAddAll(bulkWhileCard)).resolves.toMatchObject({ busy: 1 });
        gate.resolve({ sessionId, candidateId: item.card.candidateId, candidateVersion: 6, inventoryId, inventoryVersion: 1, outcome: 'committed_private' });
        await cardPending;

        const secondGate = deferred<any>();
        const second = harness({ commitCandidate: jest.fn(() => secondGate.promise) });
        const bulk = second.coordinator.freezeAddAll([item]);
        const bulkPending = second.coordinator.runAddAll(bulk);
        await expect(second.coordinator.addCandidate(item)).resolves.toMatchObject({ status: 'busy' });
        secondGate.resolve({ sessionId, candidateId: item.card.candidateId, candidateVersion: 6, inventoryId, inventoryVersion: 1, outcome: 'committed_private' });
        await bulkPending;
    });

    it('reports mixed partial success without collapsing or auto-recommitting success', async () => {
        const items = [draft(1), { ...draft(2), edits: { quantity: 2 } }, draft(3)];
        const readCandidate = jest.fn(async (_session: string, candidateId: string) => {
            if (candidateId === items[2].card.candidateId) return readyDetail(candidateId, {
                allowedActions: [], readiness: {
                    reviewReady: false, blockers: [], derivedFromCandidateVersion: 5,
                    derivedFromMetadataRevision: 7, derivedFromDuplicateAdviceVersion: null,
                },
            });
            return readyDetail(candidateId);
        });
        const saveReview = jest.fn(async (request) => {
            if (request.candidateId === items[1].card.candidateId) {
                throw new OwnerUxClientError('P9_INTERNAL_ERROR', true, 'Temporary failure');
            }
            return readyDetail(request.candidateId);
        });
        const commitCandidate = jest.fn(async (request) => {
            return { sessionId, candidateId: request.candidateId, candidateVersion: 6,
                inventoryId, inventoryVersion: 1, outcome: 'committed_private' as const };
        });
        const test = harness({ readCandidate, saveReview, commitCandidate });
        const command = test.coordinator.freezeAddAll(items);
        const result = await test.coordinator.runAddAll(command);
        expect(result.outcomes).toEqual(expect.arrayContaining([
            expect.objectContaining({ candidateId: items[0].card.candidateId, status: 'succeeded' }),
            expect.objectContaining({ candidateId: items[1].card.candidateId, status: 'failed_retryable' }),
            expect.objectContaining({ candidateId: items[2].card.candidateId, status: 'no_longer_eligible' }),
        ]));
        expect(result).toMatchObject({ succeeded: 1, failedRetryable: 1, noLongerEligible: 1 });
    });

    it('retries ambiguous M39 with the exact identity and never duplicates committed items', async () => {
        const item = draft(1);
        const calls: unknown[] = [];
        const commitCandidate = jest.fn(async (request) => {
            calls.push(request);
            if (calls.length === 1) throw new OwnerUxClientError(
                'P9_INTERNAL_ERROR', true, 'The result is unclear.',
            );
            return { sessionId, candidateId: request.candidateId, candidateVersion: 6,
                inventoryId, inventoryVersion: 1, outcome: 'committed_private' as const };
        });
        const test = harness({ commitCandidate });
        await expect(test.coordinator.addCandidate(item)).resolves.toMatchObject({ status: 'still_pending' });
        await expect(test.coordinator.retryCandidate(item.card.candidateId)).resolves.toMatchObject({ status: 'succeeded' });
        expect(calls[1]).toEqual(calls[0]);
        await expect(test.coordinator.addCandidate(item)).resolves.toMatchObject({ status: 'succeeded' });
        expect(commitCandidate).toHaveBeenCalledTimes(2);
    });

    it('partial Add-all retry excludes successes and M39 requests contain no publication operation', async () => {
        const items = [draft(1), draft(2)];
        let failSecond = true;
        const commitCandidate = jest.fn(async (request) => {
            if (request.candidateId === items[1].card.candidateId && failSecond) {
                failSecond = false;
                throw new OwnerUxClientError('P9_INTERNAL_ERROR', true, 'unclear');
            }
            expect(Object.keys(request).sort()).toEqual([
                'candidateId', 'commandId', 'expectedCandidateVersion',
                'expectedMetadataRevision', 'expectedReviewVersion',
                'idempotencyKey', 'sessionId',
            ]);
            return { sessionId, candidateId: request.candidateId, candidateVersion: 6,
                inventoryId, inventoryVersion: 1, outcome: 'committed_private' as const };
        });
        const test = harness({ commitCandidate });
        const command = test.coordinator.freezeAddAll(items);
        const first = await test.coordinator.runAddAll(command);
        expect(first.succeeded).toBe(1);
        const retry = await test.coordinator.retryAddAll(command);
        expect(retry.succeeded).toBe(2);
        expect(commitCandidate.mock.calls.filter(([request]) => (
            request.candidateId === items[0].card.candidateId
        ))).toHaveLength(1);
    });

    it('bulk retry supersedes frozen draft A with the Owner current draft B', async () => {
        const saveReview = jest.fn()
            .mockRejectedValueOnce(new Error('flaky transport failure'))
            .mockImplementation(async (request) => readyDetail(request.candidateId));
        const test = harness({ saveReview });
        const draftA = { ...draft(1), edits: { baseCondition: 'acceptable' as const } };
        const command = test.coordinator.freezeAddAll([draftA]);
        await expect(test.coordinator.runAddAll(command)).resolves.toMatchObject({
            failedRetryable: 1,
        });

        const draftB = {
            ...draft(1),
            edits: { baseCondition: 'acceptable' as const, quantity: 4 },
        };
        await expect(test.coordinator.retryAddAll(command, [draftB]))
            .resolves.toMatchObject({ succeeded: 1 });
        expect(saveReview.mock.calls[1][0].review.quantity).toBe(4);
        expect(saveReview.mock.calls[1][0].idempotencyKey)
            .not.toBe(saveReview.mock.calls[0][0].idempotencyKey);
    });

    it('bulk retry keeps a changed local-invalid draft in Needs attention without server requests', async () => {
        const saveReview = jest.fn().mockRejectedValueOnce(new Error('flaky transport failure'));
        const test = harness({ saveReview });
        const draftA = { ...draft(1), edits: { baseCondition: 'acceptable' as const } };
        const command = test.coordinator.freezeAddAll([draftA]);
        await test.coordinator.runAddAll(command);

        const invalidCurrent = { ...draft(1), edits: { priceMinor: null } };
        await expect(test.coordinator.retryAddAll(command, [invalidCurrent]))
            .resolves.toMatchObject({ needsAttention: 1, noLongerEligible: 0, succeeded: 0 });
        expect(saveReview).toHaveBeenCalledTimes(1);
        expect(test.commitCandidate).not.toHaveBeenCalled();
        expect(test.synchronizeIneligible).not.toHaveBeenCalled();
        expect(command.outcomes.get(invalidCurrent.card.candidateId)).toMatchObject({
            status: 'needs_attention', stage: 'claim',
        });

        const fixedCurrent = { ...draft(1), edits: { quantity: 3 } };
        await expect(test.coordinator.retryAddAll(command, [fixedCurrent]))
            .resolves.toMatchObject({ needsAttention: 0, succeeded: 1 });
        expect(saveReview).toHaveBeenCalledTimes(2);
        expect(saveReview.mock.calls[1][0].review.quantity).toBe(3);
        expect(test.commitCandidate).toHaveBeenCalledTimes(1);
    });

    it('reuses Save identity only for the same values and candidate/metadata revisions', async () => {
        const saveReview = jest.fn()
            .mockRejectedValueOnce(new Error('flaky transport failure'))
            .mockImplementation(async (request) => readyDetail(request.candidateId));
        const test = harness({ saveReview });
        const item = { ...draft(1), edits: { baseCondition: 'acceptable' as const } };
        await test.coordinator.addCandidate(item);
        await test.coordinator.retryCandidate(item.card.candidateId, item);
        const [firstSave, retrySave] = saveReview.mock.calls.map(([request]) => request);
        expect(retrySave.idempotencyKey).toBe(firstSave.idempotencyKey);
        expect(retrySave.commandId).toBe(firstSave.commandId);
    });

    it.each([
        ['candidateVersion', { candidateVersion: 5 }],
        ['metadataRevision', { metadataRevision: 8 }],
    ] as const)('creates fresh Save/commit identities when only %s changes', async (_label, cardPatch) => {
        const saveReview = jest.fn()
            .mockRejectedValueOnce(new Error('flaky transport failure'))
            .mockImplementation(async (request) => readyDetail(request.candidateId));
        const test = harness({ saveReview });
        const item = { ...draft(1), edits: { baseCondition: 'acceptable' as const } };
        await test.coordinator.addCandidate(item);
        const refreshed = {
            ...item,
            card: { ...item.card, ...cardPatch },
        };
        await test.coordinator.retryCandidate(item.card.candidateId, refreshed);
        const [firstSave, retrySave] = saveReview.mock.calls.map(([request]) => request);
        expect(retrySave.idempotencyKey).not.toBe(firstSave.idempotencyKey);
        expect(retrySave.commandId).not.toBe(firstSave.commandId);
        expect(retrySave.expectedCandidateVersion).toBe(refreshed.card.candidateVersion);
        expect(retrySave.expectedMetadataRevision).toBe(refreshed.card.metadataRevision);
    });

    it('replays the same ambiguous M39 identity when values and base revisions are unchanged', async () => {
        const commitCandidate = jest.fn()
            .mockRejectedValueOnce(new OwnerUxClientError('P9_INTERNAL_ERROR', true, 'unclear'))
            .mockImplementation(async (request) => ({
                sessionId: request.sessionId, candidateId: request.candidateId,
                candidateVersion: 6, inventoryId, inventoryVersion: 1,
                outcome: 'committed_private' as const,
            }));
        const test = harness({ commitCandidate });
        const item = draft(1);
        await test.coordinator.addCandidate(item);
        await test.coordinator.retryCandidate(item.card.candidateId, item);
        const [firstCommit, retryCommit] = commitCandidate.mock.calls.map(([request]) => request);
        expect(retryCommit.idempotencyKey).toBe(firstCommit.idempotencyKey);
        expect(retryCommit.commandId).toBe(firstCommit.commandId);
    });

    it('F01-A: retry with a refreshed draft saves the refreshed draft, never the frozen stale draft', async () => {
        const saveReview = jest.fn()
            .mockRejectedValueOnce(new Error('flaky transport failure'))
            .mockImplementation(async (request) => readyDetail(request.candidateId));
        const test = harness({ saveReview });
        const draftA = { ...draft(1), edits: { baseCondition: 'acceptable' as const } };
        await expect(test.coordinator.addCandidate(draftA)).resolves.toMatchObject({
            status: 'failed_retryable', stage: 'save',
        });
        // Owner changes the mounted draft to B before pressing Add again.
        const draftB = {
            ...draft(1),
            edits: { baseCondition: 'acceptable' as const, quantity: 3 },
        };
        await expect(test.coordinator.retryCandidate(
            draftB.card.candidateId, draftB,
        )).resolves.toMatchObject({ status: 'succeeded' });
        const retriedSave = saveReview.mock.calls[1][0];
        expect(retriedSave.review.quantity).toBe(3);
        expect(saveReview).toHaveBeenCalledTimes(2);
        expect(test.commitCandidate).toHaveBeenCalledTimes(1);
    });

    it('F01-B: an ambiguous M39 attempt is not resent once the draft changed; a fresh pipeline runs instead', async () => {
        const commitCandidate = jest.fn()
            .mockRejectedValueOnce(new OwnerUxClientError('P9_INTERNAL_ERROR', true, 'unclear'))
            .mockImplementation(async (request) => ({
                sessionId: request.sessionId, candidateId: request.candidateId,
                candidateVersion: 6, inventoryId, inventoryVersion: 1,
                outcome: 'committed_private' as const,
            }));
        const test = harness({ commitCandidate });
        const itemA = draft(1);
        await expect(test.coordinator.addCandidate(itemA)).resolves.toMatchObject({
            status: 'still_pending',
        });
        const itemB = { ...draft(1), edits: { quantity: 5 } };
        await expect(test.coordinator.retryCandidate(
            itemB.card.candidateId, itemB,
        )).resolves.toMatchObject({ status: 'succeeded' });
        // The stale frozen commit identity was NOT silently replayed.
        const [firstRequest, secondRequest] = commitCandidate.mock.calls.map(([r]) => r);
        expect(secondRequest.idempotencyKey).not.toBe(firstRequest.idempotencyKey);
        expect(secondRequest.commandId).not.toBe(firstRequest.commandId);
        // The current draft was saved fresh before the new commit. (The first
        // attempt needed no Save because its draft had no mounted edits.)
        expect(test.saveReview).toHaveBeenCalledTimes(1);
        expect(test.saveReview.mock.calls[0][0].review.quantity).toBe(5);
    });

    it('F01-C: retry without a draft argument keeps idempotent replay of the frozen command', async () => {
        const saveReview = jest.fn()
            .mockRejectedValueOnce(new Error('flaky transport failure'))
            .mockImplementation(async (request) => readyDetail(request.candidateId));
        const test = harness({ saveReview });
        const item = { ...draft(1), edits: { baseCondition: 'acceptable' as const } };
        await expect(test.coordinator.addCandidate(item)).resolves.toMatchObject({
            status: 'failed_retryable',
        });
        await expect(test.coordinator.retryCandidate(item.card.candidateId))
            .resolves.toMatchObject({ status: 'succeeded' });
        const [firstSave, retrySave] = saveReview.mock.calls.map(([request]) => request);
        expect(retrySave.idempotencyKey).toBe(firstSave.idempotencyKey);
        expect(retrySave.commandId).toBe(firstSave.commandId);
        expect(retrySave.review).toEqual(firstSave.review);
    });

    it('F02-C: Add is denied while a standalone Save owns the command slot', async () => {
        const test = harness();
        const item = draft(1);
        const token = test.coordinator.tryClaim(item.card.candidateId, 'save');
        expect(token).not.toBeNull();
        await expect(test.coordinator.addCandidate(item)).resolves.toMatchObject({
            status: 'busy', stage: 'claim',
        });
        expect(test.saveReview).not.toHaveBeenCalled();
        expect(test.commitCandidate).not.toHaveBeenCalled();
    });

    it('F02-D: Add is denied while a standalone Remove owns the command slot', async () => {
        const test = harness();
        const item = draft(1);
        const token = test.coordinator.tryClaim(item.card.candidateId, 'remove');
        expect(token).not.toBeNull();
        await expect(test.coordinator.addCandidate(item)).resolves.toMatchObject({
            status: 'busy', stage: 'claim',
        });
        expect(test.commitCandidate).not.toHaveBeenCalled();
    });

    it('F02-E1: Save/Remove/Add cannot claim while Add-all owns the candidate', async () => {
        const gate = deferred<any>();
        const test = harness({
            commitCandidate: jest.fn(() => gate.promise),
        });
        const item = draft(1);
        const bulk = test.coordinator.freezeAddAll([item]);
        const pending = test.coordinator.runAddAll(bulk);
        await eventually(() => expect(test.registry.isClaimed(item.card.candidateId)).toBe(true));
        expect(test.coordinator.tryClaim(item.card.candidateId, 'save')).toBeNull();
        expect(test.coordinator.tryClaim(item.card.candidateId, 'remove')).toBeNull();
        await expect(test.coordinator.addCandidate(item)).resolves.toMatchObject({
            status: 'busy',
        });
        gate.resolve({ sessionId, candidateId: item.card.candidateId, candidateVersion: 6,
            inventoryId, inventoryVersion: 1, outcome: 'committed_private' });
        await pending;
    });

    it('F02-E2: Add-all membership is denied (busy, never queued) while a standalone command holds the slot', async () => {
        const test = harness();
        const item = draft(1);
        const token = test.coordinator.tryClaim(item.card.candidateId, 'save');
        expect(token).not.toBeNull();
        const bulk = test.coordinator.freezeAddAll([item]);
        await expect(test.coordinator.runAddAll(bulk)).resolves.toMatchObject({ busy: 1 });
        expect(test.commitCandidate).not.toHaveBeenCalled();
        test.coordinator.releaseSlot(item.card.candidateId, token!);
    });

    it('F02-F: the command slot releases after terminal success and failure outcomes', async () => {
        const failing = harness({
            saveReview: jest.fn(async () => {
                throw new Error('flaky transport failure');
            }),
        });
        // Edits force the Save stage so the failure actually occurs.
        const item = { ...draft(1), edits: { baseCondition: 'acceptable' as const } };
        await expect(failing.coordinator.addCandidate(item)).resolves.toMatchObject({
            status: 'failed_retryable',
        });
        expect(failing.registry.isClaimed(item.card.candidateId)).toBe(false);

        const succeeding = harness();
        await expect(succeeding.coordinator.addCandidate(item)).resolves.toMatchObject({
            status: 'succeeded',
        });
        expect(succeeding.registry.isClaimed(item.card.candidateId)).toBe(false);
        expect(succeeding.coordinator.tryClaim(item.card.candidateId, 'save')).not.toBeNull();
    });

    it('F04-G: reconciles cache authority when fresh revalidation proves ineligibility', async () => {
        const item = draft(1);
        const changed = readyDetail(item.card.candidateId, {
            allowedActions: [],
            readiness: {
                reviewReady: false, blockers: [], derivedFromCandidateVersion: 5,
                derivedFromMetadataRevision: 7, derivedFromDuplicateAdviceVersion: null,
            },
        });
        const test = harness({ readCandidate: jest.fn(async () => changed) });
        await expect(test.coordinator.addCandidate(item)).resolves.toMatchObject({
            status: 'no_longer_eligible', stage: 'revalidate',
        });
        expect(test.synchronizeIneligible).toHaveBeenCalledWith([item.card.candidateId]);
        expect(test.commitCandidate).not.toHaveBeenCalled();
    });

    it('F04-H: reconciles cache authority on authoritative conflict failures and never commits again', async () => {
        const commitCandidate = jest.fn(async () => {
            throw new OwnerUxClientError('P9_STATE_CONFLICT', false, 'removed elsewhere');
        });
        const test = harness({ commitCandidate });
        const item = draft(1);
        await expect(test.coordinator.addCandidate(item)).resolves.toMatchObject({
            status: 'no_longer_eligible',
        });
        expect(test.synchronizeIneligible).toHaveBeenCalledWith([item.card.candidateId]);
        expect(commitCandidate).toHaveBeenCalledTimes(1);
    });

    it('NF-01-A: ambiguous-commit retry failing as authoritative conflict reconciles ineligibility', async () => {
        const item = draft(1);
        const candidateId = item.card.candidateId;
        let calls = 0;
        const commitCandidate = jest.fn(async (request) => {
            calls += 1;
            if (calls === 1) {
                throw new OwnerUxClientError('P9_INTERNAL_ERROR', true, 'unclear');
            }
            throw new OwnerUxClientError('P9_STATE_CONFLICT', false, 'removed elsewhere');
        });
        const test = harness({ commitCandidate });
        await expect(test.coordinator.addCandidate(item)).resolves.toMatchObject({
            status: 'still_pending',
        });
        await expect(test.coordinator.retryCandidate(candidateId)).resolves.toMatchObject({
            status: 'no_longer_eligible', stage: 'commit',
        });
        expect(test.synchronizeIneligible).toHaveBeenCalledWith([candidateId]);
        expect(commitCandidate).toHaveBeenCalledTimes(2);
    });

    it('NF-01-B: bulk ambiguous-commit retry failing as authoritative conflict reconciles ineligibility', async () => {
        const items = [draft(1)];
        const candidateId = items[0].card.candidateId;
        let calls = 0;
        const commitCandidate = jest.fn(async () => {
            calls += 1;
            if (calls === 1) {
                throw new OwnerUxClientError('P9_INTERNAL_ERROR', true, 'unclear');
            }
            throw new OwnerUxClientError('P9_STATE_CONFLICT', false, 'removed elsewhere');
        });
        const test = harness({ commitCandidate });
        const command = test.coordinator.freezeAddAll(items);
        await expect(test.coordinator.runAddAll(command)).resolves.toMatchObject({
            stillPending: 1,
        });
        await expect(test.coordinator.retryAddAll(command)).resolves.toMatchObject({
            noLongerEligible: 1,
        });
        expect(test.synchronizeIneligible).toHaveBeenCalledWith([candidateId]);
        expect(commitCandidate).toHaveBeenCalledTimes(2);
    });
});
