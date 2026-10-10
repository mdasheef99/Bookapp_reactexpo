import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { OWNER_UX_CONTRACT_VERSION } from '../contracts/ownerUxContracts';
import type { EditionChoices, EditionLookupReceipt, RequestEditionOptionsRequest, SelectEditionRequest } from '../contracts/ownerEditionPicker';
import { useOwnerCardCommand, type OwnerCandidateCommandSlot } from '../identity/useOwnerCardCommand';
import { imageInventoryKeys, type ImageInventoryIdentity } from './ownerUxQueries';
import { acceptEditionChoices, acceptEditionLookupReceipt } from './ownerEditionPickerCache';
import { ownerEditionPickerKeys } from './ownerEditionPickerKeys';
import { assertOwnerCardCurrent, authorityChanged } from './ownerCandidateAuthority';

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
}>;

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
    pendingLookup.current = null;
    selectMutation.reset();
    lookupMutation.reset();
  }, [identity.userId, identity.storeId, sessionId, candidateId]);
  return {
    choices, selectEdition: selectMutation, requestOptions: lookupMutation,
    selectionPending: selectMutation.isPending, lookupPending: lookupMutation.isPending,
    isCommandActive: () => slot.isCommandActive(candidateId),
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