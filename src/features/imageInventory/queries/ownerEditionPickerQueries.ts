import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { createEditionLookupCommand } from '../api/ownerEditionPickerCommands';
import { ownerUxService, type UpdateCandidateReviewRequest } from '../api/ownerUxService';
import { createCaptureAttempt } from '../capture/captureIds';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';
import { OWNER_UX_CONTRACT_VERSION } from '../contracts/ownerUxContracts';
import type { EditionChoices, EditionLookupReceipt, RequestEditionOptionsRequest, SelectEditionRequest } from '../contracts/ownerEditionPicker';
import { useOwnerCardCommand, type OwnerCandidateCommandSlot } from '../identity/useOwnerCardCommand';
import { imageInventoryKeys, type ImageInventoryIdentity } from './ownerUxQueries';
import { acceptEditionChoices, acceptEditionLookupReceipt } from './ownerEditionPickerCache';
import { ownerEditionPickerKeys } from './ownerEditionPickerKeys';
import { assertOwnerCardCurrent, authorityChanged, candidateAuthorityIsCurrent } from './ownerCandidateAuthority';
import { synchronizeCandidateReviewSuccess } from './ownerUxReviewQueries';
import { ownerBatchReviewKeys } from './ownerBatchReviewKeys';
import { editionSelectionRecovery } from '../review/editionSelectionRecovery';
import { useOwnerEditionPickerIsbnMutation } from './ownerEditionPickerIsbnMutation';

export { ownerEditionPickerKeys } from './ownerEditionPickerKeys';

export function useOwnerEditionChoices(
  identity: ImageInventoryIdentity | null, sessionId: string | null, candidateId: string | null, enabled = true,
) {
  const client = useQueryClient();
  const lifecycle = useOwnerCardCommand(identity, sessionId, candidateId);
  return useQuery<EditionChoices>({
    queryKey: ownerEditionPickerKeys.choices(identity ?? { userId: 'unresolved', storeId: 'unresolved' },
      sessionId ?? 'unresolved', candidateId ?? 'unresolved'),
    enabled: !!(enabled && identity && sessionId && candidateId),
    staleTime: 0, retry: false, refetchOnReconnect: false,
    refetchInterval: query => query.state.data?.lookupStatus === 'pending' ? 3_000 : false,
    refetchIntervalInBackground: false,
    queryFn: ({ signal }) => lifecycle.run(async (requestSignal, assertCurrent) => {
      const scope = { sessionId: sessionId!, candidateId: candidateId! };
      assertOwnerCardCurrent(client, identity!, scope);
      const result = await ownerEditionPickerService.readEditionChoices({
        action: 'read_candidate_edition_choices', contractVersion: OWNER_UX_CONTRACT_VERSION, ...scope,
      }, requestSignal);
      assertCurrent();
      return acceptEditionChoices(client, identity!, scope, result, 'read');
    }, signal),
  });
}
export type EditionPickerCallbacks = Readonly<{
  onSelection?: (canonical: EditionChoices, previousMetadataRevision: number) => void;
  onAuthority?: (canonical: EditionChoices) => void;
  onIdentitySaved?: (canonical: OwnerCandidateDetail) => void;
}>;
// Owner fix from the edition sheet: the full review the card would save on Add, carrying the corrected title/author.
export type IdentitySearchRequest = Readonly<{
  review: OwnerCandidateReview; expectedCandidateVersion: number; expectedMetadataRevision: number;
}>;
export type IdentitySearchResult = Readonly<{ detail: OwnerCandidateDetail; searched: boolean }>;

// Task 7 supplies the EXISTING Save/Add coordinator slot and functional draft updater.
// This hook never creates a picker registry or starts a provider lookup on read/mount/expiry.
export function useOwnerEditionPicker(
  identity: ImageInventoryIdentity, sessionId: string, candidateId: string,
  slot: OwnerCandidateCommandSlot, callbacks: EditionPickerCallbacks = {},
) {
  const client = useQueryClient();
  const lifecycle = useOwnerCardCommand(identity, sessionId, candidateId, slot);
  const choices = useOwnerEditionChoices(identity, sessionId, candidateId);
  const scope = { sessionId, candidateId };
  const callbackRef = useRef(callbacks);
  callbackRef.current = callbacks;
  const lastSelection = useRef<SelectEditionRequest | null>(null);
  const lastLookup = useRef<RequestEditionOptionsRequest | null>(null);
  const lastIdentity = useRef<{
    fingerprint: string; save: UpdateCandidateReviewRequest;
    detail?: OwnerCandidateDetail; lookup?: RequestEditionOptionsRequest;
  } | null>(null);
  const pendingLookup = useRef<{
    scope: string; generation: number; promise: Promise<EditionLookupReceipt>;
  } | null>(null);
  const assertRequest = (request: { sessionId: string; candidateId: string }) => {
    lifecycle.assertScope();
    if (request.sessionId !== sessionId || request.candidateId !== candidateId) throw authorityChanged();
    assertOwnerCardCurrent(client, identity, scope);
  };
  const reread = async (signal: AbortSignal, assertCurrent: () => void) => {
    const incoming = await ownerEditionPickerService.readEditionChoices({
      action: 'read_candidate_edition_choices', contractVersion: OWNER_UX_CONTRACT_VERSION, ...scope,
    }, signal);
    assertCurrent();
    const canonical = acceptEditionChoices(client, identity, scope, incoming, 'read');
    callbackRef.current.onAuthority?.(canonical);
    return canonical;
  };
  const reconcile = async (signal: AbortSignal, assertCurrent: () => void) => {
    try { return await reread(signal, assertCurrent); }
    catch { assertCurrent(); return null; }
  };
  const isbn = useOwnerEditionPickerIsbnMutation({ identity, scope, choices: choices.data, lifecycle,
    assertRequest, reread, reconcile, onIdentitySaved: detail => callbackRef.current.onIdentitySaved?.(detail) });
  const selectMutation = useMutation({
    networkMode: 'always', retry: false,
    mutationFn: (request: SelectEditionRequest) => {
      assertRequest(request);
      return lifecycle.run(async (signal, assertCurrent) => {
        // Freeze the exact wire command. Retrying never manufactures new identities.
        lastSelection.current = JSON.parse(JSON.stringify(request)) as SelectEditionRequest;
        try {
          const response = await ownerEditionPickerService.selectEdition(lastSelection.current, signal);
          assertCurrent();
          const accepted = acceptEditionChoices(client, identity, scope, response, 'selection');
          const current = await reconcile(signal, assertCurrent) ?? accepted;
          if (!current.selection?.confirmedByOwner || current.selection.selectionId !== response.selection?.selectionId
            || current.metadataRevision < accepted.metadataRevision) throw authorityChanged();
          assertCurrent();
          client.setQueryData(ownerEditionPickerKeys.selectionReceipt(identity, sessionId, candidateId),
            { ...current, rows: [], optionsExpiresAt: null });
          // Invalidates reads; no invented candidate readiness/review or metadata blob.
          await client.invalidateQueries({ queryKey: imageInventoryKeys.candidate(identity, sessionId, candidateId) });
          assertCurrent();
          callbackRef.current.onSelection?.(current, request.expectedMetadataRevision);
          return current;
        } catch (error) {
          assertCurrent();
          await reconcile(signal, assertCurrent);
          throw error;
        }
      }, undefined, 'edition-selection');
    },
  });
  // Saves the corrected identity first (the server resets the old search for a changed query),
  // then starts one explicit search for the saved identity. A failed search never undoes the save.
  const identityMutation = useMutation({
    networkMode: 'always', retry: false,
    mutationFn: (request: IdentitySearchRequest): Promise<IdentitySearchResult> => {
      assertRequest(scope);
      return lifecycle.run(async (signal, assertCurrent) => {
        // SDD-1 §4 / D2-2: retain both wire requests, including versions, keys and command IDs.
        const fingerprint = JSON.stringify(request);
        if (!lastIdentity.current || lastIdentity.current.fingerprint !== fingerprint) {
          const attempt = createCaptureAttempt('identity-review');
          lastIdentity.current = { fingerprint, save: JSON.parse(JSON.stringify({ ...scope,
            ...request, idempotencyKey: attempt.key, commandId: attempt.commandId })) };
        }
        const command = lastIdentity.current;
        let detail: OwnerCandidateDetail;
        try {
          detail = command.detail ?? await ownerUxService.updateCandidateReview(command.save, signal);
          assertCurrent();
          // A regressive save response is never replaced by the cache.
          if (detail.sessionId !== sessionId || detail.candidateId !== candidateId
            || !candidateAuthorityIsCurrent(client, identity, detail)) throw authorityChanged();
          command.detail = detail;
          await synchronizeCandidateReviewSuccess(client, identity, sessionId, candidateId, detail);
          assertCurrent();
          callbackRef.current.onIdentitySaved?.(detail);
        } catch (error) {
          assertCurrent();
          // SDD-1 §4 / D2-2: completed saves and uncertain failures retain the command.
          if (editionSelectionRecovery(error).kind !== 'retry') {
            if (!command.detail) lastIdentity.current = null;
            await reconcile(signal, assertCurrent);
            assertCurrent();
            await Promise.all([
              client.invalidateQueries({ queryKey: imageInventoryKeys.candidate(identity, sessionId, candidateId) }),
              client.invalidateQueries({ queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId) }),
              client.invalidateQueries({ queryKey: ownerBatchReviewKeys.sessionV3(identity, sessionId) }),
              client.invalidateQueries({ queryKey: ownerBatchReviewKeys.readinessV3(identity, sessionId) }),
            ]);
            assertCurrent();
          }
          throw error;
        }
        try {
          if (!command.lookup) command.lookup = createEditionLookupCommand(await reread(signal, assertCurrent));
          const receipt = await ownerEditionPickerService.requestEditionOptions(command.lookup, signal);
          assertCurrent();
          acceptEditionLookupReceipt(client, identity, scope, receipt);
          await reconcile(signal, assertCurrent);
          return { detail, searched: true };
        } catch (error) {
          assertCurrent();
          const refused = editionSelectionRecovery(error).kind !== 'retry';
          if (refused) delete command.lookup;
          await reconcile(signal, assertCurrent);
          assertCurrent();
          if (refused) throw error;
          return { detail, searched: false };
        }
      }, undefined, 'identity-search');
    },
  });
  const lookupMutation = useMutation({
    networkMode: 'always', retry: false,
    mutationFn: (request: RequestEditionOptionsRequest) => {
      assertRequest(request);
      const lookupScope = `${identity.userId}:${identity.storeId}:${sessionId}:${candidateId}`;
      const pending = pendingLookup.current;
      if (pending?.scope === lookupScope && pending.generation === request.expectedRequestGeneration) {
        return pending.promise;
      }
      const promise = lifecycle.run(async (signal, assertCurrent) => {
        lastLookup.current = JSON.parse(JSON.stringify(request)) as RequestEditionOptionsRequest;
        try {
          const receipt = await ownerEditionPickerService.requestEditionOptions(lastLookup.current, signal);
          assertCurrent();
          acceptEditionLookupReceipt(client, identity, scope, receipt);
          await reconcile(signal, assertCurrent);
          assertCurrent();
          const accepted = client.getQueryData<EditionLookupReceipt>(
            ownerEditionPickerKeys.lookup(identity, sessionId, candidateId));
          if (!accepted) throw authorityChanged();
          return accepted;
        } catch (error) {
          assertCurrent();
          if (editionSelectionRecovery(error).kind !== 'retry') lastLookup.current = null;
          await reconcile(signal, assertCurrent);
          throw error;
        }
      });
      pendingLookup.current = { scope: lookupScope, generation: request.expectedRequestGeneration, promise };
      const release = () => { if (pendingLookup.current?.promise === promise) pendingLookup.current = null; };
      void promise.then(release, release);
      return promise;
    },
  });
  useEffect(() => {
    lastSelection.current = null;
    lastLookup.current = null;
    lastIdentity.current = null;
    pendingLookup.current = null;
    selectMutation.reset();
    lookupMutation.reset();
    identityMutation.reset();
  }, [identity.userId, identity.storeId, sessionId, candidateId]);
  return {
    choices, selectEdition: selectMutation, requestOptions: lookupMutation,
    saveIdentityAndSearch: identityMutation, identityPending: identityMutation.isPending,
    setIsbnAndSearch: isbn.mutation, isbnPending: isbn.mutation.isPending, retryIsbnSearch: isbn.retry,
    isbnRetryAvailable: isbn.retryAvailable,
    selectionPending: selectMutation.isPending, lookupPending: lookupMutation.isPending,
    isCommandActive: () => slot.isCommandActive(candidateId),
    retryIdentitySearch: () => {
      assertRequest(scope);
      if (!lastIdentity.current) return Promise.reject(authorityChanged());
      const { review, expectedCandidateVersion, expectedMetadataRevision } = lastIdentity.current.save;
      return identityMutation.mutateAsync({ review, expectedCandidateVersion, expectedMetadataRevision });
    },
    retrySelection: () => {
      assertRequest(scope);
      if (!lastSelection.current) return Promise.reject(authorityChanged());
      return selectMutation.mutateAsync(lastSelection.current);
    },
    retryLookup: () => {
      assertRequest(scope);
      if (!lastLookup.current) return Promise.reject(authorityChanged());
      return lookupMutation.mutateAsync(lastLookup.current);
    },
  };
}
