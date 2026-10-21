import type { QueryClient } from '@tanstack/react-query';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import { getResolvedImageInventoryIdentity, imageInventoryKeys, type ImageInventoryIdentity } from './ownerUxQueries';
import { ownerBatchReviewKeys } from './ownerBatchReviewKeys';
import { candidateAuthorityIsCurrent } from './ownerCandidateAuthority';
import { ownerEditionPickerKeys } from './ownerEditionPickerKeys';
import type { EditionChoices } from '../contracts/ownerEditionPicker';

const sameIdentity = (left: ImageInventoryIdentity | null, right: ImageInventoryIdentity) =>
  left?.userId === right.userId && left.storeId === right.storeId;

export async function synchronizeCandidateReviewSuccess(
  client: QueryClient, identity: ImageInventoryIdentity, sessionId: string, candidateId: string,
  canonical: OwnerCandidateDetail,
): Promise<void> {
  if (!sameIdentity(getResolvedImageInventoryIdentity(), identity)
    || canonical.sessionId !== sessionId || canonical.candidateId !== candidateId
    || !candidateAuthorityIsCurrent(client, identity, canonical)) return;
  client.setQueryData(imageInventoryKeys.candidate(identity, sessionId, candidateId), canonical);
  const choicesKey = ownerEditionPickerKeys.choices(identity, sessionId, candidateId);
  const choices = client.getQueryData<EditionChoices>(choicesKey);
  if (choices) {
    if (canonical.metadata.revision === choices.metadataRevision
      && canonical.metadata.selectionId === choices.selection?.selectionId) {
      client.setQueryData(choicesKey, { ...choices, candidateVersion: canonical.candidateVersion,
        reviewVersion: canonical.review.reviewVersion });
    } else if (canonical.metadata.revision > choices.metadataRevision) {
      client.removeQueries({ queryKey: ownerEditionPickerKeys.card(identity, sessionId, candidateId) });
    }
  }
  await Promise.all([
    client.invalidateQueries({ queryKey: imageInventoryKeys.discovery(identity) }),
    client.invalidateQueries({ queryKey: imageInventoryKeys.readiness(identity, sessionId) }),
    client.invalidateQueries({ queryKey: ownerBatchReviewKeys.sessionV3(identity, sessionId) }),
    client.invalidateQueries({ queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId) }),
    client.invalidateQueries({ queryKey: ownerBatchReviewKeys.readinessV3(identity, sessionId) }),
    client.invalidateQueries({ queryKey: choicesKey }),
  ]);
}
