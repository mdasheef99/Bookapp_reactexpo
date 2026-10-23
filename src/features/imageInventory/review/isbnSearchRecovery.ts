import { OwnerUxClientError } from '../api/ownerUxTransport';

// Slice 5 SDD §9: ISBN commands have their own recovery; refused commands are never replayed.
export function isbnSearchRecovery(error: unknown): Readonly<{
  kind: 'retry' | 'refresh' | 'stop'; message: string; nextStep: string;
}> {
  if (error instanceof OwnerUxClientError) {
    if (error.code === 'P9_CANDIDATE_VERSION_CONFLICT' || error.code === 'P9_VERSION_CONFLICT') return {
      kind: 'refresh', message: 'This book changed; we reloaded it.', nextStep: 'Press Search by ISBN again',
    };
    if (error.code === 'P9_STATE_CONFLICT') return {
      kind: 'stop', message: "This book can't be changed now.", nextStep: 'Close the sheet',
    };
    if (error.code !== 'P9_INTERNAL_ERROR') return { kind: 'stop', message: error.message, nextStep: 'Close the sheet' };
  }
  if (error instanceof Error && ['OWNER_CANDIDATE_AUTHORITY_CHANGED', 'OWNER_IDENTITY_CHANGED'].includes(error.message)) return {
    kind: 'refresh', message: 'This book changed; we reloaded it.', nextStep: 'Press Search by ISBN again',
  };
  return { kind: 'retry', message: 'The ISBN search could not finish.', nextStep: 'Retry search' };
}
