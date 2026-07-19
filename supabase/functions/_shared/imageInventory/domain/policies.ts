import { Phase9ContractError, requiredString } from './validation';

export type AdapterOutcome =
  | 'technical_failure'
  | 'schema_invalid'
  | 'broadly_unusable'
  | 'no_books'
  | 'wrong_language'
  | 'over_candidate_limit'
  | 'quality_rejected'
  | 'provider_no_match';

export type SessionState = 'active' | 'closing' | 'closed' | 'expired';

export function authorizeInitiatingOwnerSessionMutation(input: {
  actorId: string;
  initiatingOwnerId: string;
  state: SessionState;
}): { allowed: boolean; reason: 'allowed' | 'not_initiator' | 'not_active' } {
  if (input.actorId !== input.initiatingOwnerId) return { allowed: false, reason: 'not_initiator' };
  if (input.state !== 'active') return { allowed: false, reason: 'not_active' };
  return { allowed: true, reason: 'allowed' };
}

export function mayCloseSession(input: {
  actorId: string;
  initiatingOwnerId: string;
  state: SessionState;
  hasNonterminalInputs: boolean;
}): { allowed: boolean; reason: 'allowed' | 'not_initiator' | 'not_active' | 'processing' } {
  const mutation = authorizeInitiatingOwnerSessionMutation(input);
  if (!mutation.allowed) return mutation;
  if (input.hasNonterminalInputs) return { allowed: false, reason: 'processing' };
  return { allowed: true, reason: 'allowed' };
}

export function sessionAcceptsNewInputs(state: SessionState): boolean {
  return state === 'active';
}

export function beginSessionClose(input: {
  state: SessionState;
  hasNonterminalInputs: boolean;
}): 'closing' {
  if (input.state !== 'active') throw new Phase9ContractError('session.state', 'only an active session can begin closing');
  if (input.hasNonterminalInputs) throw new Phase9ContractError('session.inputs', 'processing still running; session remains active');
  return 'closing';
}

export function finalizeSessionClose(state: SessionState): 'closed' {
  if (state !== 'closing') throw new Phase9ContractError('session.state', 'only a closing session can finalize');
  return 'closed';
}

export type DuplicateSignal = Readonly<{
  sameStore: boolean;
  exactValidatedEdition: boolean;
  compatibleLanguageFormatConditionPrice: boolean;
  copySpecificDamageOrNote: boolean;
  approvedPublicCopyMedia: boolean;
  privateRequestMedia: boolean;
}>;

export function recommendDuplicateAction(signal: DuplicateSignal): 'increment_quantity' | 'create_separate' | 'no_duplicate_warning' {
  if (!signal.sameStore) return 'no_duplicate_warning';
  if (signal.copySpecificDamageOrNote || signal.approvedPublicCopyMedia) return 'create_separate';
  if (signal.exactValidatedEdition && signal.compatibleLanguageFormatConditionPrice) return 'increment_quantity';
  return 'create_separate';
}

export type PublicationOutcome = 'committed_private' | 'committed_published' | 'committed_publication_failed';

export function resolvePublicationOutcome(input: {
  privateInventoryCommitted: boolean;
  publicationRequested: boolean;
  projectionSucceeded: boolean;
}): PublicationOutcome {
  if (!input.privateInventoryCommitted) throw new Phase9ContractError('publication', 'cannot publish before private inventory commit');
  if (!input.publicationRequested) return 'committed_private';
  return input.projectionSucceeded ? 'committed_published' : 'committed_publication_failed';
}

export function publicationRetryPlan(input: {
  outcome: PublicationOutcome;
  originalCommitId: string;
  originalIdempotencyKey: string;
}): Readonly<{ retryIdentity: string; mayWriteInventory: false; reauthorizePublication: true }> {
  if (input.outcome !== 'committed_publication_failed') {
    throw new Phase9ContractError('publication.outcome', 'only a failed publication can be retried');
  }
  return {
    retryIdentity: publicationRetryIdentity(input),
    mayWriteInventory: false,
    reauthorizePublication: true,
  };
}

export function publicationRetryIdentity(input: {
  originalCommitId: string;
  originalIdempotencyKey: string;
}): string {
  const commitId = requiredString(input.originalCommitId, 'original_commit_id', 128, { activeContent: false });
  const key = requiredString(input.originalIdempotencyKey, 'original_idempotency_key', 128, {
    activeContent: false,
    pattern: /^[A-Za-z0-9._:-]{16,128}$/u,
  });
  return `publication:${commitId}:${key}`;
}

export function assertQuantityInvariant(input: {
  total: number;
  available: number;
  reserved: number;
  sold: number;
  removed: number;
}): void {
  const values = Object.entries(input);
  if (values.some(([, value]) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Phase9ContractError('quantity', 'all quantity buckets must be non-negative safe integers');
  }
  if (input.total !== input.available + input.reserved + input.sold + input.removed) {
    throw new Phase9ContractError('quantity', 'total must equal available + reserved + sold + removed');
  }
}
