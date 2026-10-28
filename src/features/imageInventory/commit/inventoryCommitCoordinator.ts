import { runCandidateCommands } from './inventoryCommitBatchExecution';
import type { AddCandidateToInventoryRequest } from '../api/ownerUxService';
import type {
    OwnerCandidateCommitResult,
    OwnerCandidateDetail,
} from '../contracts/ownerUxContracts';
import {
    CandidateCommandRegistry,
    type AddAllResult,
    type CandidateCommitDraft,
    type CandidateCommitOutcome,
    type FrozenAddAllCommand,
    type FrozenCandidateCommand,
    type InventoryCommitCoordinatorDependencies,
    type RetryState,
} from './inventoryCommitTypes';
import {
    aggregate,
    canonicalMatchesControlledChoice,
    canonicalMatchesSubmittedReview,
    candidateCanStartCommit,
    candidateCanStartBulkCommit,
    candidateCommitPreparation,
    canonicalEligible,
    classifyFailure,
    draftMatchesCommand,
    canResaveAfterSave,
    freezeReviewSave,
    reviewMatchesReset,
} from './inventoryCommitPolicy';

export {
    candidateCanStartCommit,
    candidateCanStartBulkCommit,
} from './inventoryCommitPolicy';

export {
    CandidateCommandRegistry,
    type AddAllResult,
    type CandidateCommitDraft,
    type CandidateCommitOutcome,
    type FrozenAddAllCommand,
    type InventoryCommitCoordinatorDependencies,
} from './inventoryCommitTypes';

export class InventoryCommitCoordinator {
    private readonly retries = new Map<string, RetryState>();
    private readonly completed = new Map<string, CandidateCommitOutcome>();

    constructor(
        private readonly dependencies: InventoryCommitCoordinatorDependencies,
        private readonly registry = new CandidateCommandRegistry(),
    ) {}

    private freezeCandidate(value: CandidateCommitDraft, claimToken: string): FrozenCandidateCommand {
        const preparation = candidateCommitPreparation(value);
        if (!preparation) throw new Error('Cannot freeze an invalid compact review.');
        return {
            candidateId: value.card.candidateId,
            sessionId: value.card.sessionId,
            draft: preparation.draft,
            ownerSeenDraft: preparation.draft,
            needsSave: preparation.needsSave,
            resave: preparation.resave,
            candidateVersion: value.card.candidateVersion,
            metadataRevision: value.card.metadataRevision,
            reviewVersion: value.card.reviewVersion,
            saveIdempotencyKey: this.dependencies.createIdempotencyKey('save-review'),
            saveCommandId: this.dependencies.createCommandId(),
            resaveIdempotencyKey: this.dependencies.createIdempotencyKey('resave-review'),
            resaveCommandId: this.dependencies.createCommandId(),
            commitIdempotencyKey: this.dependencies.createIdempotencyKey('commit'),
            commitCommandId: this.dependencies.createCommandId(),
            claimToken,
            claimed: this.registry.claim(value.card.candidateId, claimToken),
        };
    }

    async addCandidate(value: CandidateCommitDraft): Promise<CandidateCommitOutcome> {
        const prior = this.completed.get(value.card.candidateId);
        if (prior) return prior;
        if (this.retries.has(value.card.candidateId)) return this.retryCandidate(value.card.candidateId, value);
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
        if (this.retries.get(candidateId)?.ambiguousCommit) return null;
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
        // A changed draft can supersede a failed Save. An uncertain Add must
        // first replay its original command to reconcile server-held authority.
        if (!retry.ambiguousCommit && refreshed && !draftMatchesCommand(refreshed, retry.command)) {
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
                    this.retries.delete(candidateId);
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

    async retryAddAll(
        command: FrozenAddAllCommand,
        refreshed: readonly CandidateCommitDraft[] = [],
    ): Promise<AddAllResult> {
        const refreshedById = new Map(refreshed.map((value) => [value.card.candidateId, value]));
        const retryable = command.commands.filter((item) => {
            const outcome = command.outcomes.get(item.candidateId);
            return outcome?.status === 'failed_retryable'
                || outcome?.status === 'still_pending'
                || outcome?.status === 'needs_attention';
        });
        const retryCommands = retryable.flatMap((item) => {
            const token = `bulk-retry:${command.commandId}`;
            const retry = this.retries.get(item.candidateId);
            const current = refreshedById.get(item.candidateId);
            if (retry && !retry.ambiguousCommit && current && !draftMatchesCommand(current, retry.command)) {
                // Mirror per-card supersede semantics: changed Owner draft B
                // receives a fresh Save/commit identity; frozen A is discarded.
                if (!candidateCanStartCommit(current)) {
                    command.outcomes.set(item.candidateId, {
                        candidateId: item.candidateId,
                        status: 'needs_attention',
                        stage: 'claim',
                    });
                    return [];
                }
                this.retries.delete(item.candidateId);
                return [this.freezeCandidate(current, token)];
            }
            const frozen = retry?.command ?? item;
            return [{
                ...frozen,
                claimToken: token,
                claimed: this.registry.claim(item.candidateId, token),
            }];
        });
        await this.runBounded(retryCommands, command, true);
        const successes = retryable.flatMap((item) => {
            const result = command.outcomes.get(item.candidateId)?.result;
            return result ? [result] : [];
        });
        if (successes.length > 0) await this.dependencies.synchronizeSuccess(successes);
        return aggregate(command);
    }

    private async runBounded(
        commands: readonly FrozenCandidateCommand[], bulk: FrozenAddAllCommand, _retry: boolean,
    ): Promise<void> {
        await runCandidateCommands(commands, bulk, async (command) => {
            const retryState = this.retries.get(command.candidateId);
            return retryState?.ambiguousCommit
                ? this.retryCandidateWithinClaim(command, retryState)
                : this.executeClaimed(command, false);
        });
    }

    dispose(): void {
        this.registry.clear();
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
                this.retries.delete(command.candidateId);
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
        let stage: CandidateCommitOutcome['stage'] = 'revalidate';
        try {
            if (command.resave && !command.resaveRequest) {
                const detail = await this.dependencies.readCandidate(command.sessionId, command.candidateId);
                if (!reviewMatchesReset(command.ownerSeenDraft, detail.review.value)) {
                    this.retries.delete(command.candidateId);
                    await this.dependencies.synchronizeIneligible([command.candidateId]);
                    return { candidateId: command.candidateId, status: 'no_longer_eligible',
                        stage, code: 'review_changed' };
                }
                command = freezeReviewSave(command, detail);
            }
            if (command.needsSave && !command.saveRequest && !command.resaveRequest)
                command = freezeReviewSave(command);
            let authority: OwnerCandidateDetail;
            for (;;) {
                const request = command.resaveRequest ?? command.saveRequest;
                if (request && !command.saveCompleted) {
                    stage = 'save';
                    const savedAuthority = await this.dependencies.saveReview(request);
                    command = { ...command, saveCompleted: true, savedAuthority };
                }
                stage = 'revalidate';
                authority = await this.dependencies.readCandidate(command.sessionId, command.candidateId);
                if (!canResaveAfterSave(authority, command)) break;
                command = freezeReviewSave(command, authority);
            }
            const reviewChanged = !canonicalMatchesSubmittedReview(authority, command);
            if (reviewChanged || !canonicalEligible(authority) || !canonicalMatchesControlledChoice(authority, command.draft)) {
                this.retries.delete(command.candidateId);
                // SDD-1 §3: one re-save only; synchronize rejected authority.
                await this.dependencies.synchronizeIneligible([command.candidateId]);
                return {
                    candidateId: command.candidateId,
                    status: 'no_longer_eligible', stage, ...(reviewChanged ? { code: 'review_changed' } : {}),
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
            const retry = {
                ...this.retries.get(command.candidateId),
                command, ambiguousCommit: false,
            };
            retry.ambiguousCommit = stage === 'commit' && outcome.status === 'still_pending';
            if (outcome.status === 'no_longer_eligible') {
                this.retries.delete(command.candidateId);
                // Authoritative server conflict/non-retryable rejection:
                // reconcile candidate/review/readiness authority immediately.
                await this.dependencies.synchronizeIneligible([command.candidateId]);
            } else {
                this.retries.set(command.candidateId, retry);
            }
            return outcome;
        } finally {
            this.registry.release(command.candidateId, command.claimToken);
        }
    }
}
