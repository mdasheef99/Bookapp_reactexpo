import type { QueryClient } from '@tanstack/react-query';
import type { EditionChoices } from '../contracts/ownerEditionPicker';
import type { OwnerCandidateDetail, OwnerCandidateCommitResult } from '../contracts/ownerUxContracts';
import type { OwnerBatchReview, OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { RemoveCandidateFromScanResult } from '../api/ownerBatchReviewService';
import { getResolvedImageInventoryIdentity, imageInventoryKeys, type ImageInventoryIdentity } from './ownerUxQueries';
import { ownerBatchReviewKeys } from './ownerBatchReviewKeys';
import { ownerEditionPickerKeys } from './ownerEditionPickerKeys';

export type OwnerCardScope = Readonly<{ sessionId: string; candidateId: string }>;
export type CandidateVersions = Readonly<{
  candidateVersion: number; metadataRevision?: number; reviewVersion?: number | null;
}>;
type Outcome = OwnerCandidateCommitResult | RemoveCandidateFromScanResult;
export const authorityChanged = () => new Error('OWNER_CANDIDATE_AUTHORITY_CHANGED');

export function assertOwnerScope(identity: ImageInventoryIdentity): void {
  const current = getResolvedImageInventoryIdentity();
  if (current?.userId !== identity.userId || current.storeId !== identity.storeId) {
    throw new Error('OWNER_IDENTITY_CHANGED');
  }
}
export function cardHasConfirmedOutcome(client: QueryClient, identity: ImageInventoryIdentity, scope: OwnerCardScope): boolean {
  if (client.getQueryData<Outcome>(ownerEditionPickerKeys.outcome(identity, scope.sessionId, scope.candidateId))) return true;
  const detail = client.getQueryData<OwnerCandidateDetail>(
    imageInventoryKeys.candidate(identity, scope.sessionId, scope.candidateId));
  return detail?.candidateState === 'committed';
}
export function assertOwnerCardCurrent(client: QueryClient, identity: ImageInventoryIdentity, scope: OwnerCardScope): void {
  assertOwnerScope(identity);
  if (cardHasConfirmedOutcome(client, identity, scope)) throw authorityChanged();
}
export function candidateVersions(detail: OwnerCandidateDetail): CandidateVersions {
  return { candidateVersion: detail.candidateVersion, metadataRevision: detail.metadata.revision,
    reviewVersion: detail.review.reviewVersion };
}
export function versionsRegress(incoming: CandidateVersions, accepted: CandidateVersions): boolean {
  return incoming.candidateVersion < accepted.candidateVersion
    || (incoming.metadataRevision !== undefined && accepted.metadataRevision !== undefined
      && incoming.metadataRevision < accepted.metadataRevision)
    || (incoming.reviewVersion !== undefined && accepted.reviewVersion !== undefined
      && (incoming.reviewVersion ?? 0) < (accepted.reviewVersion ?? 0));
}
export function knownCandidateVersions(
  client: QueryClient, identity: ImageInventoryIdentity, scope: OwnerCardScope,
): CandidateVersions[] {
  const choices = client.getQueryData<EditionChoices>(
    ownerEditionPickerKeys.choices(identity, scope.sessionId, scope.candidateId));
  const detail = client.getQueryData<OwnerCandidateDetail>(
    imageInventoryKeys.candidate(identity, scope.sessionId, scope.candidateId));
  const card = client.getQueryData<OwnerBatchReview>(
    ownerBatchReviewKeys.batchReview(identity, scope.sessionId))?.items
    ?.find(item => item.candidateId === scope.candidateId);
  return [...(choices ? [choices] : []), ...(detail ? [candidateVersions(detail)] : []),
    ...(card ? [card] : [])];
}
// Corresponding counters within a card, never a combined/universal revision.
export function candidateAuthorityIsCurrent(
  client: QueryClient, identity: ImageInventoryIdentity, detail: OwnerCandidateDetail,
): boolean {
  assertOwnerScope(identity);
  if (cardHasConfirmedOutcome(client, identity, detail) && detail.candidateState !== 'committed') return false;
  return !knownCandidateVersions(client, identity, detail)
    .some(accepted => versionsRegress(candidateVersions(detail), accepted));
}
export function acceptCandidateRead(
  client: QueryClient, identity: ImageInventoryIdentity, incoming: OwnerCandidateDetail,
): OwnerCandidateDetail {
  if (candidateAuthorityIsCurrent(client, identity, incoming)) return incoming;
  const previous = client.getQueryData<OwnerCandidateDetail>(
    imageInventoryKeys.candidate(identity, incoming.sessionId, incoming.candidateId));
  if (previous && candidateAuthorityIsCurrent(client, identity, previous)) return previous;
  throw authorityChanged();
}
export function assertBatchAuthority(
  client: QueryClient, identity: ImageInventoryIdentity, batch: OwnerBatchReview,
): OwnerBatchReview {
  assertOwnerScope(identity);
  for (const card of batch.items) {
    const receipt = client.getQueryData<Outcome>(ownerEditionPickerKeys.outcome(identity, card.sessionId, card.candidateId));
    const committed = card.candidateState === 'committed' && (!receipt
      || ('outcome' in receipt && receipt.outcome === 'committed_private' && card.candidateVersion >= receipt.candidateVersion));
    if ((cardHasConfirmedOutcome(client, identity, card) && !committed)
      || knownCandidateVersions(client, identity, card).some(accepted => versionsRegress(card, accepted))) {
      throw authorityChanged();
    }
  }
  return batch;
}
export function assertCardVersions(client: QueryClient, identity: ImageInventoryIdentity, card: OwnerBatchReviewCard): void {
  assertOwnerCardCurrent(client, identity, card);
  if (knownCandidateVersions(client, identity, card).some(accepted => versionsRegress(card, accepted))) throw authorityChanged();
}
export async function recordConfirmedCandidateOutcome(
  client: QueryClient, identity: ImageInventoryIdentity, outcome: Outcome,
): Promise<void> {
  assertOwnerScope(identity);
  // A server receipt is durable authority; no optimistic boolean or local state machine.
  client.setQueryData(ownerEditionPickerKeys.outcome(identity, outcome.sessionId, outcome.candidateId), outcome);
  const queryKey = ownerEditionPickerKeys.card(identity, outcome.sessionId, outcome.candidateId);
  try { await client.cancelQueries({ queryKey }); }
  finally { client.removeQueries({ queryKey }); }
}