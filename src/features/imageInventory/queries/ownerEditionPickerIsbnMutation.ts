import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { createCandidateIsbnCommand, createEditionLookupCommand } from '../api/ownerEditionPickerCommands';
import { ownerUxService, type UpdateCandidateReviewRequest } from '../api/ownerUxService';
import { createCaptureAttempt } from '../capture/captureIds';
import type { EditionChoices, RequestEditionOptionsRequest, SetCandidateIsbnRequest, SetCandidateIsbnResponse } from '../contracts/ownerEditionPicker';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import type { useOwnerCardCommand } from '../identity/useOwnerCardCommand';
import { isbnSearchRecovery } from '../review/isbnSearchRecovery';
import { imageInventoryKeys, type ImageInventoryIdentity } from './ownerUxQueries';
import { ownerBatchReviewKeys } from './ownerBatchReviewKeys';
import { authorityChanged, candidateAuthorityIsCurrent, type OwnerCardScope } from './ownerCandidateAuthority';
import { cacheCandidateReviewSuccess } from './ownerUxReviewQueries';
import { acceptEditionLookupReceipt, choicesFollowIsbnSet } from './ownerEditionPickerCache';
import type { IdentitySearchRequest } from './ownerEditionPickerQueries';

export type IsbnSearchRequest = Readonly<{ isbn13: string | null; reviewSave?: IdentitySearchRequest }>;
type PendingIsbnSearch = {
  fingerprint: string; request: IsbnSearchRequest; choices: EditionChoices; save?: UpdateCandidateReviewRequest;
  detail?: OwnerCandidateDetail; synchronized?: boolean; set?: SetCandidateIsbnRequest;
  setResponse?: SetCandidateIsbnResponse; lookup?: RequestEditionOptionsRequest;
};

// Slice 5 SDD §8 / F16: one saved command per unfinished step, with no intervening title lookup.
export function useOwnerEditionPickerIsbnMutation({ identity, scope, choices, lifecycle, assertRequest,
  reread, reconcile, onIdentitySaved }: {
  identity: ImageInventoryIdentity; scope: OwnerCardScope; choices: EditionChoices | undefined;
  lifecycle: ReturnType<typeof useOwnerCardCommand>;
  assertRequest: (scope: OwnerCardScope) => void;
  reread: (signal: AbortSignal, assertCurrent: () => void) => Promise<EditionChoices>;
  reconcile: (signal: AbortSignal, assertCurrent: () => void) => Promise<EditionChoices | null>;
  onIdentitySaved: (detail: OwnerCandidateDetail) => void;
}) {
  const client = useQueryClient();
  const pending = useRef<PendingIsbnSearch | null>(null);
  // Best-effort: an offline (paused) refetch never settles, so the search and the outcome never wait for it.
  const invalidate = () => {
    const keys = [
      imageInventoryKeys.discovery(identity),
      imageInventoryKeys.readiness(identity, scope.sessionId),
      imageInventoryKeys.candidate(identity, scope.sessionId, scope.candidateId),
      ownerBatchReviewKeys.batchReview(identity, scope.sessionId),
      ownerBatchReviewKeys.sessionV3(identity, scope.sessionId),
      ownerBatchReviewKeys.readinessV3(identity, scope.sessionId),
    ];
    for (const queryKey of keys) void client.invalidateQueries({ queryKey }).catch(() => undefined);
  };
  const mutation = useMutation({
    networkMode: 'always', retry: false,
    mutationFn: (request: IsbnSearchRequest) => {
      assertRequest(scope);
      return lifecycle.run(async (signal, assertCurrent) => {
        const fingerprint = JSON.stringify(request);
        if (!pending.current || pending.current.fingerprint !== fingerprint) {
          if (!choices) throw authorityChanged();
          const original = JSON.parse(fingerprint) as IsbnSearchRequest;
          const attempt = original.reviewSave ? createCaptureAttempt('isbn-review') : null;
          pending.current = { fingerprint, request: original, choices, ...(original.reviewSave && attempt ? {
            save: { ...scope, ...original.reviewSave, idempotencyKey: attempt.key, commandId: attempt.commandId },
          } : {}) };
        }
        const command = pending.current;
        try {
          if (command.save && !command.detail) {
            const detail = await ownerUxService.updateCandidateReview(command.save, signal);
            assertCurrent();
            if (detail.sessionId !== scope.sessionId || detail.candidateId !== scope.candidateId
              || !candidateAuthorityIsCurrent(client, identity, detail)) throw authorityChanged();
            command.detail = detail;
          }
          if (command.detail && !command.synchronized) {
            cacheCandidateReviewSuccess(client, identity, scope.sessionId, scope.candidateId, command.detail);
            assertCurrent();
            onIdentitySaved(command.detail);
            command.synchronized = true;
          }
          // The save bumps candidateVersion. Freeze it only now, then keep the exact DTO for replay.
          if (!command.set) command.set = createCandidateIsbnCommand({ ...command.choices,
            candidateVersion: command.detail?.candidateVersion ?? command.choices.candidateVersion }, command.request.isbn13);
          if (!command.setResponse) {
            const result = await ownerEditionPickerService.setCandidateIsbn(command.set, signal);
            assertCurrent();
            if (result.sessionId !== scope.sessionId || result.candidateId !== scope.candidateId
              || result.ownerIsbn13 !== command.request.isbn13) throw authorityChanged();
            command.setResponse = result;
          }
          if (!command.lookup) {
            const canonical = await reread(signal, assertCurrent);
            invalidate();
            if (!command.setResponse || !choicesFollowIsbnSet(canonical, command.setResponse)) throw authorityChanged();
            command.lookup = createEditionLookupCommand(canonical);
          }
          const receipt = await ownerEditionPickerService.requestEditionOptions(command.lookup, signal);
          assertCurrent();
          acceptEditionLookupReceipt(client, identity, scope, receipt);
          await reconcile(signal, assertCurrent);
          assertCurrent();
          pending.current = null;
          return receipt;
        } catch (error) {
          assertCurrent();
          const refused = isbnSearchRecovery(error).kind !== 'retry';
          if (refused) pending.current = null;
          await reconcile(signal, assertCurrent).catch(() => null);
          assertCurrent();
          if (refused || command.setResponse) invalidate();
          throw error;
        }
      }, undefined, 'isbn-search');
    },
  });
  useEffect(() => {
    pending.current = null;
    mutation.reset();
  }, [identity.userId, identity.storeId, scope.sessionId, scope.candidateId]);
  return { mutation, retryAvailable: pending.current !== null, retry: async () => {
    assertRequest(scope);
    if (!pending.current) throw authorityChanged();
    return mutation.mutateAsync(pending.current.request);
  } };
}
