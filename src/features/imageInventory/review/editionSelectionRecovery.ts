import { OwnerUxClientError, registeredOwnerUxError } from '../api/ownerUxTransport';

type SelectionRecovery = Readonly<{ kind: 'retry' | 'refresh' | 'stop'; message: string }>;
// 02d §6: shared selection/search conflict copy.
const choicesChanged = 'These choices may have changed. Review the latest choices and try again.';
const changed = (): SelectionRecovery => ({ kind: 'refresh',
  message: choicesChanged });

// Owner decision2026-10-13 / picker §3.1/§7: preserve exact retries only for uncertain responses.
export function editionSelectionRecovery(error: unknown): SelectionRecovery {
  if (error instanceof OwnerUxClientError) {
    if (['P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_CANDIDATE_VERSION_CONFLICT'].includes(error.code)) return changed();
    if (!error.retryable) return { kind: 'stop', message: registeredOwnerUxError(error.code).message };
  }
  if (error instanceof Error && error.message === 'OWNER_CANDIDATE_AUTHORITY_CHANGED') return changed();
  return { kind: 'retry', message: 'The action could not be confirmed. Your current choice and selling details are preserved.' };
}

// 02d §6: state conflicts share the selection refresh message.
export function editionLookupRecovery(error: unknown): SelectionRecovery {
  if (error instanceof OwnerUxClientError && error.code === 'P9_STATE_CONFLICT') {
    return changed();
  }
  const recovery = editionSelectionRecovery(error);
  return recovery.kind === 'refresh'
    ? { kind: 'refresh', message: "This book changed. Check the card's details, then search again." }
    : recovery;
}
