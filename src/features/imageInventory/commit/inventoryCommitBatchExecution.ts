import type { CandidateCommitOutcome, FrozenAddAllCommand, FrozenCandidateCommand } from './inventoryCommitTypes';

// Unit 6G §13.2 retains independent commands and three active candidates.
export async function runCandidateCommands(
  commands: readonly FrozenCandidateCommand[], bulk: FrozenAddAllCommand,
  execute: (command: FrozenCandidateCommand) => Promise<CandidateCommitOutcome>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < commands.length) {
      const command = commands[next++];
      if (!command.claimed) {
        bulk.outcomes.set(command.candidateId, {
          candidateId: command.candidateId, status: 'busy', stage: 'claim',
        });
      } else {
        bulk.outcomes.set(command.candidateId, await execute(command));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, commands.length) }, () => worker()));
}