import {
    OwnerUxClientError,
    type AddCandidateToInventoryRequest,
} from '../api/ownerUxService';
import type {
    OwnerCandidateCommitResult,
    OwnerCandidateDetail,
} from '../contracts/ownerUxContracts';
import {
    ownerCandidateReviewSchema,
} from '../contracts/ownerUxReviewSchema';
import {
    CandidateCommandRegistry,
    type AddAllResult,
    type CandidateCommitDraft,
    type CandidateCommitOutcome,
    type FrozenAddAllCommand,
    type FrozenCandidateCommand,
    type InventoryCommitCoordinatorDependencies,
} from './inventoryCommitTypes';

export {
    CandidateCommandRegistry,
    type AddAllResult,
    type CandidateCommitDraft,
    type CandidateCommitOutcome,
    type FrozenAddAllCommand,
    type InventoryCommitCoordinatorDependencies,
} from './inventoryCommitTypes';

const conflictCodes = new Set([
    'P9_CANDIDATE_VERSION_CONFLICT',
    'P9_VERSION_CONFLICT',
    'P9_STATE_CONFLICT',
    'P9_NOT_FOUND',
    'P9_OWNER_NOT_AUTHORIZED',
]);

type RetryState = {
    command: FrozenCandidateCommand;
    commitRequest?: AddCandidateToInventoryRequest;
    ambiguousCommit: boolean;
};

export function candidateCanStartCommit(value: CandidateCommitDraft): boolean {
    if (!value.card.review) return false;
    const merged = { ...value.card.review, ...value.edits };
    if (!ownerCandidateReviewSchema.safeParse(merged).success) return false;
    const hasEdits = Object.keys(value.edits).length > 0;
    return hasEdits
        ? value.card.allowedActions.includes('save_review')
        : value.card.reviewReady
            && value.card.allowedActions.includes('add_to_inventory');
}

function canonicalEligible(detail: OwnerCandidateDetail): boolean {
    return detail.candidateState === 'ready'
        && detail.review.value !== null
        && detail.review.reviewVersion !== null
        && detail.readiness.reviewReady
        && detail.allowedActions.includes('add_to_inventory');
}

// A refreshed draft matches the frozen retry command only when the merged
// Owner-visible review is identical. Any newer mounted edit supersedes the
// frozen command and must never be silently replayed.
function draftMatchesCommand(
    refreshed: CandidateCommitDraft,
    command: FrozenCandidateCommand,
): boolean {
    if (!refreshed.card.review) return false;
    const merged = { ...refreshed.card.review, ...refreshed.edits };
    return JSON.stringify(merged) === JSON.stringify(command.draft);
}

function classifyFailure(candidateId: string, stage: CandidateCommitOutcome['stage'], error: unknown) {
    const code = error instanceof OwnerUxClientError ? error.code : undefined;
    if (stage === 'commit' && code === 'P9_INTERNAL_ERROR') {
        return { candidateId, status: 'still_pending' as const, stage, code };
    }
    if (code && conflictCodes.has(code)) {
        return { candidateId, status: 'no_longer_eligible' as const, stage, code };
    }
    if (!(error instanceof OwnerUxClientError) || error.retryable) {
        return { candidateId, status: 'failed_retryable' as const, stage, code };
    }
    return { candidateId, status: 'no_longer_eligible' as const, stage, code };
}

function aggregate(command: FrozenAddAllCommand): AddAllResult {
    const outcomes = command.candidateIds.map((candidateId) => command.outcomes.get(candidateId)
        ?? { candidateId, status: 'still_pending' as const, stage: 'claim' as const });
    const count = (status: CandidateCommitOutcome['status']) => (
        outcomes.filter((outcome) => outcome.status === status).length
    );
    return {
        exactN: command.exactN,
        candidateIds: command.candidateIds,
        outcomes,
        succeeded: count('succeeded'),
        failedRetryable: count('failed_retryable'),
        noLongerEligible: count('no_longer_eligible'),
        stillPending: count('still_pending'),
        busy: count('busy'),
    };
}

export class InventoryCommitCoordinator {
    private readonly retries = new Map<string, RetryState>();
    private readonly completed = new Map<string, CandidateCommitOutcome>();

    constructor(
        private readonly dependencies: InventoryCommitCoordinatorDependencies,
        private readonly registry = new CandidateCommandRegistry(),
    ) {}

    private freezeCandidate(value: CandidateCommitDraft, claimToken: string): FrozenCandidateCommand {
        const hasEdits = Object.keys(value.edits).length > 0;
        return {
            candidateId: value.card.candidateId,
            sessionId: value.card.sessionId,
            draft: { ...value.card.review!, ...value.edits },
            needsSave: hasEdits,
            candidateVersion: value.card.candidateVersion,
            metadataRevision: value.card.metadataRevision,
            saveIdempotencyKey: this.dependencies.createIdempotencyKey('save-review'),
            saveCommandId: this.dependencies.createCommandId(),
            commitIdempotencyKey: this.dependencies.createIdempotencyKey('commit'),
            commitCommandId: this.dependencies.createCommandId(),
            claimToken,
            claimed: this.registry.claim(value.card.candidateId, claimToken),
        };
    }

    async addCandidate(value: CandidateCommitDraft): Promise<CandidateCommitOutcome> {
        const prior = this.completed.get(value.card.candidateId);
        if (prior) return prior;
        return this.beginFresh(value);
    }

    private async beginFresh(value: CandidateCommitDraft): Promise<CandidateCommitOutcome> {
        if (!candidateCanStartCommit(value)) {
            return { candidateId: value.card.candidateId, status: 'no_longer_eligible', stage: 'claim' };
        }
        const token = `card:${this.dependencies.createCommandId()}`;
        const command = this.freezeCandidate(value, token);
        if (!command.claimed) {
            return { candidateId: command.candidateId, status: 'busy', stage: 'claim' };
        }
        return this.executeClaimed(command, true);
    }

    // Standalone screen commands (Save, Remove) participate in the same
    // per-candidate command slot as Add/Add-all. No second registry exists.
    tryClaim(candidateId: string, prefix: string): string | null {
        const token = `${prefix}:${this.dependencies.createCommandId()}`;
        return this.registry.claim(candidateId, token) ? token : null;
    }

    releaseSlot(candidateId: string, token: string): void {
        this.registry.release(candidateId, token);
    }

    isCommandActive(candidateId: string): boolean {
        return this.registry.isClaimed(candidateId);
    }

    freezeAddAll(values: readonly CandidateCommitDraft[]): FrozenAddAllCommand {
        const commandId = this.dependencies.createCommandId();
        const eligible = values.filter(candidateCanStartCommit);
        const commands = eligible.map((value) => this.freezeCandidate(value, `bulk:${commandId}`));
        return {
            commandId,
            exactN: commands.length,
            candidateIds: Object.freeze(commands.map((command) => command.candidateId)),
            commands: Object.freeze(commands),
            outcomes: new Map(),
        };
    }

    async runAddAll(command: FrozenAddAllCommand): Promise<AddAllResult> {
        const runnable = command.commands.filter((item) => {
            if (item.claimed) return true;
            command.outcomes.set(item.candidateId, {
                candidateId: item.candidateId, status: 'busy', stage: 'claim',
            });
            return false;
        });
        await this.runBounded(runnable, command, false);
        const successes = [...command.outcomes.values()]
            .flatMap((outcome) => outcome.result ? [outcome.result] : []);
        if (successes.length > 0) await this.dependencies.synchronizeSuccess(successes);
        return aggregate(command);
    }

    async retryCandidate(
        candidateId: string,
        refreshed?: CandidateCommitDraft,
    ): Promise<CandidateCommitOutcome> {
        const prior = this.completed.get(candidateId);
        if (prior) return prior;
        const retry = this.retries.get(candidateId);
        if (!retry) return { candidateId, status: 'no_longer_eligible', stage: 'claim' };
        // Stale-draft fence: if the Owner changed the mounted review since the
        // failed attempt, the frozen command is superseded. Discard it and run
        // a fresh pipeline against the CURRENT draft. Idempotency safety for
        // an ambiguous prior commit is preserved by fresh canonical
        // revalidation: a landed commit makes the candidate ineligible, so M39
        // can never run twice for one candidate.
        if (refreshed && !draftMatchesCommand(refreshed, retry.command)) {
            this.retries.delete(candidateId);
            return this.beginFresh(refreshed);
        }
        const token = `retry:${this.dependencies.createCommandId()}`;
        if (!this.registry.claim(candidateId, token)) {
            return { candidateId, status: 'busy', stage: 'claim' };
        }
        const command = { ...retry.command, claimToken: token, claimed: true };
        if (retry.ambiguousCommit && retry.commitRequest) {
            try {
                const result = await this.dependencies.commitCandidate(retry.commitRequest);
                const outcome = this.recordSuccess(candidateId, result);
                await this.dependencies.synchronizeSuccess([result]);
                return outcome;
            } catch (error) {
                const outcome = classifyFailure(candidateId, 'commit', error);
                if (outcome.status === 'no_longer_eligible') {
                    // Authoritative server conflict/non-retryable rejection:
                    // reconcile candidate/review/readiness authority immediately.
                    await this.dependencies.synchronizeIneligible([candidateId]);
                }
                return outcome;
            } finally {
                this.registry.release(candidateId, token);
            }
        }
        return this.executeClaimed(command, true);
    }

    async retryAddAll(command: FrozenAddAllCommand): Promise<AddAllResult> {
        const retryable = command.commands.filter((item) => {
            const outcome = command.outcomes.get(item.candidateId);
            return outcome?.status === 'failed_retryable' || outcome?.status === 'still_pending';
        });
        await this.runBounded(retryable.map((item) => {
            const token = `bulk-retry:${command.commandId}`;
            return { ...item, claimToken: token, claimed: this.registry.claim(item.candidateId, token) };
        }), command, true);
        const successes = retryable.flatMap((item) => {
            const result = command.outcomes.get(item.candidateId)?.result;
            return result ? [result] : [];
        });
        if (successes.length > 0) await this.dependencies.synchronizeSuccess(successes);
        return aggregate(command);
    }

    private async runBounded(
        commands: readonly FrozenCandidateCommand[],
        bulk: FrozenAddAllCommand,
        retry: boolean,
    ): Promise<void> {
        let next = 0;
        const worker = async () => {
            while (next < commands.length) {
                const command = commands[next++];
                if (!command.claimed) {
                    bulk.outcomes.set(command.candidateId, {
                        candidateId: command.candidateId, status: 'busy', stage: 'claim',
                    });
                    continue;
                }
                const retryState = this.retries.get(command.candidateId);
                const outcome = retry && retryState?.ambiguousCommit
                    ? await this.retryCandidateWithinClaim(command, retryState)
                    : await this.executeClaimed(command, false);
                bulk.outcomes.set(command.candidateId, outcome);
            }
        };
        await Promise.all(Array.from(
            { length: Math.min(3, commands.length) }, () => worker(),
        ));
    }

    private async retryCandidateWithinClaim(
        command: FrozenCandidateCommand,
        retry: RetryState,
    ): Promise<CandidateCommitOutcome> {
        try {
            const result = await this.dependencies.commitCandidate(retry.commitRequest!);
            return this.recordSuccess(command.candidateId, result);
        } catch (error) {
            const outcome = classifyFailure(command.candidateId, 'commit', error);
            if (outcome.status === 'no_longer_eligible') {
                // Authoritative server conflict/non-retryable rejection:
                // reconcile candidate/review/readiness authority immediately.
                await this.dependencies.synchronizeIneligible([command.candidateId]);
            }
            return outcome;
        } finally {
            this.registry.release(command.candidateId, command.claimToken);
        }
    }

    private recordSuccess(candidateId: string, result: OwnerCandidateCommitResult) {
        const outcome = {
            candidateId, status: 'succeeded' as const, stage: 'complete' as const, result,
        };
        this.retries.delete(candidateId);
        this.completed.set(candidateId, outcome);
        return outcome;
    }

    private async executeClaimed(
        command: FrozenCandidateCommand,
        synchronize: boolean,
    ): Promise<CandidateCommitOutcome> {
        let stage: CandidateCommitOutcome['stage'] = command.needsSave ? 'save' : 'revalidate';
        try {
            if (command.needsSave) {
                await this.dependencies.saveReview({
                    sessionId: command.sessionId,
                    candidateId: command.candidateId,
                    expectedCandidateVersion: command.candidateVersion,
                    expectedMetadataRevision: command.metadataRevision,
                    review: command.draft,
                    idempotencyKey: command.saveIdempotencyKey,
                    commandId: command.saveCommandId,
                });
            }
            stage = 'revalidate';
            const authority = await this.dependencies.readCandidate(
                command.sessionId, command.candidateId,
            );
            if (!canonicalEligible(authority)) {
                this.retries.delete(command.candidateId);
                // Fresh authority rejected the candidate; synchronize the
                // exact candidate/review/readiness roots so the UI can no
                // longer present stale Add eligibility. M39 is never called.
                await this.dependencies.synchronizeIneligible([command.candidateId]);
                return {
                    candidateId: command.candidateId,
                    status: 'no_longer_eligible', stage,
                };
            }
            const commitRequest: AddCandidateToInventoryRequest = {
                sessionId: command.sessionId,
                candidateId: command.candidateId,
                expectedCandidateVersion: authority.candidateVersion,
                expectedReviewVersion: authority.review.reviewVersion!,
                expectedMetadataRevision: authority.metadata.revision,
                idempotencyKey: command.commitIdempotencyKey,
                commandId: command.commitCommandId,
            };
            this.retries.set(command.candidateId, {
                command, commitRequest, ambiguousCommit: false,
            });
            stage = 'commit';
            const result = await this.dependencies.commitCandidate(commitRequest);
            const outcome = this.recordSuccess(command.candidateId, result);
            if (synchronize) await this.dependencies.synchronizeSuccess([result]);
            return outcome;
        } catch (error) {
            const outcome = classifyFailure(command.candidateId, stage, error);
            const retry = this.retries.get(command.candidateId) ?? {
                command, ambiguousCommit: false,
            };
            retry.ambiguousCommit = stage === 'commit' && outcome.status === 'still_pending';
            this.retries.set(command.candidateId, retry);
            if (outcome.status === 'no_longer_eligible') {
                // Authoritative server conflict/non-retryable rejection:
                // reconcile candidate/review/readiness authority immediately.
                await this.dependencies.synchronizeIneligible([command.candidateId]);
            }
            return outcome;
        } finally {
            this.registry.release(command.candidateId, command.claimToken);
        }
    }
}
