import { OwnerUxClientError, registeredOwnerUxError } from '../api/ownerUxTransport';

type SelectionRecovery = Readonly<{ kind: 'retry' | 'refresh' | 'stop'; message: string }>;
const changed = (): SelectionRecovery => ({ kind: 'refresh',
  message: 'The book or its edition choices changed. Review the latest choices before selecting again.' });

// Owner decision2026-10-13 / picker §3.1/§7: preserve exact retries only for uncertain responses.
export function editionSelectionRecovery(error: unknown): SelectionRecovery {
  if (error instanceof OwnerUxClientError) {
    if (['P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_CANDIDATE_VERSION_CONFLICT'].includes(error.code)) return changed();
    if (!error.retryable) return { kind: 'stop', message: registeredOwnerUxError(error.code).message };
  }
  if (error instanceof Error && error.message === 'OWNER_CANDIDATE_AUTHORITY_CHANGED') return changed();
  return { kind: 'retry', message: 'The action could not be confirmed. Your current choice and selling details are preserved.' };
}
