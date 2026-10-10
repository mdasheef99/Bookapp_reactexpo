import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { ownerUxService, type AddCandidateToInventoryRequest, type UpdateCandidateReviewRequest } from '../api/ownerUxService';
import type { OwnerCandidateCommitResult, OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import { useOwnerCardCommand, type OwnerCandidateCommandSlot } from '../identity/useOwnerCardCommand';
import { getResolvedImageInventoryIdentity, imageInventoryKeys, type ImageInventoryIdentity } from './ownerUxQueries';
import { synchronizeInventoryCommitSuccess } from './ownerInventoryCommitQueries';
import { ownerBatchReviewKeys } from './ownerBatchReviewKeys';
import { candidateAuthorityIsCurrent, authorityChanged } from './ownerCandidateAuthority';
import { ownerEditionPickerKeys } from './ownerEditionPickerKeys';
import type { EditionChoices } from '../contracts/ownerEditionPicker';

const sameIdentity = (left: ImageInventoryIdentity | null, right: ImageInventoryIdentity) =>
  left?.userId === right.userId && left.storeId === right.storeId;

export function useUpdateOwnerCandidateReview(
  identity: ImageInventoryIdentity, sessionId: string, candidateId: string, slot?: OwnerCandidateCommandSlot,
) {
  const client = useQueryClient();
  const lifecycle = useOwnerCardCommand(identity, sessionId, candidateId, slot);
  return useMutation({
    mutationFn: (request: UpdateCandidateReviewRequest) => {
      if (request.sessionId !== sessionId || request.candidateId !== candidateId) {
        throw new Error('OWNER_REVIEW_AUTHORITY_CHANGED');
      }
      return lifecycle.run(async (signal, assertCurrent) => {
        const canonical = await ownerUxService.updateCandidateReview(request, signal);
        assertCurrent();
        if (canonical.sessionId !== sessionId || canonical.candidateId !== candidateId
          || !candidateAuthorityIsCurrent(client, identity, canonical)) throw authorityChanged();
        return canonical;
      }, undefined, 'save-review');
    },
    networkMode: 'always', retry: false,
    onSuccess: canonical => {
      lifecycle.assertScope();
      return synchronizeCandidateReviewSuccess(client, identity, sessionId, candidateId, canonical);
    },
  });
}
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
    client.invalidateQueries({ queryKey: [...imageInventoryKeys.identity(identity), 'candidates'] }),
    client.invalidateQueries({ queryKey: imageInventoryKeys.discovery(identity) }),
    client.invalidateQueries({ queryKey: imageInventoryKeys.readiness(identity, sessionId) }),
    client.invalidateQueries({ queryKey: ownerBatchReviewKeys.sessionV3(identity, sessionId) }),
    client.invalidateQueries({ queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId) }),
    client.invalidateQueries({ queryKey: ownerBatchReviewKeys.readinessV3(identity, sessionId) }),
    client.invalidateQueries({ queryKey: choicesKey }),
  ]);
}
export function useAddOwnerCandidateToInventory(
  identity: ImageInventoryIdentity, sessionId: string, candidateId: string, slot?: OwnerCandidateCommandSlot,
) {
  const client = useQueryClient();
  const lifecycle = useOwnerCardCommand(identity, sessionId, candidateId, slot);
  return useMutation({
    mutationFn: (request: AddCandidateToInventoryRequest) => {
      if (request.sessionId !== sessionId || request.candidateId !== candidateId) {
        throw new Error('OWNER_COMMIT_AUTHORITY_CHANGED');
      }
      return lifecycle.run(async (signal, assertCurrent) => {
        const result = await ownerUxService.addCandidateToInventory(request, signal);
        assertCurrent();
        if (result.sessionId !== sessionId || result.candidateId !== candidateId) throw authorityChanged();
        return result;
      }, undefined, 'commit');
    },
    networkMode: 'always', retry: false,
    onSuccess: result => {
      lifecycle.assertScope();
      return synchronizeCandidateCommitSuccess(client, identity, sessionId, candidateId, result);
    },
  });
}
export async function synchronizeCandidateCommitSuccess(
  client: QueryClient, identity: ImageInventoryIdentity, sessionId: string, candidateId: string,
  result: OwnerCandidateCommitResult,
): Promise<void> {
  if (!sameIdentity(getResolvedImageInventoryIdentity(), identity)
    || result.sessionId !== sessionId || result.candidateId !== candidateId) return;
  await synchronizeInventoryCommitSuccess(client, identity, sessionId, [result]);
}