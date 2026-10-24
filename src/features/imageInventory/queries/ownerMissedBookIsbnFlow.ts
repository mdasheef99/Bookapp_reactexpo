import { useEffect, useRef, useState } from 'react';
import { OwnerCorrectionClientError, type AddManualCandidateRequest } from '../api/ownerCorrectionService';
import { ownerUxService } from '../api/ownerUxService';
import { OwnerUxClientError } from '../api/ownerUxTransport';
import { ownerEditionPickerService } from '../api/ownerEditionPickerService';
import { createCandidateIsbnCommand, createEditionLookupCommand } from '../api/ownerEditionPickerCommands';
import { OWNER_UX_CONTRACT_VERSION, type OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import type { RequestEditionOptionsRequest, SetCandidateIsbnRequest, SetCandidateIsbnResponse } from '../contracts/ownerEditionPicker';
import type { OwnerSessionSummaryV3 } from '../api/ownerBatchReviewService';
import type { QueryObserverResult } from '@tanstack/react-query';
import { cacheCorrectionCandidate, synchronizeCorrectionCandidate, useAddManualCandidate, useCorrectionQueryClient } from './ownerCorrectionQueries';
import { getResolvedImageInventoryIdentity, imageInventoryKeys, type ImageInventoryIdentity } from './ownerUxQueries';
import { ownerBatchReviewKeys } from './ownerBatchReviewKeys';
import { acceptEditionChoices, acceptEditionLookupReceipt, choicesFollowIsbnSet } from './ownerEditionPickerCache';
import { isbnSearchRecovery } from '../review/isbnSearchRecovery';

type PendingAddition = {
  add: AddManualCandidateRequest; isbn13: string | null; fingerprint: string;
  candidateId?: string; canonical?: OwnerCandidateDetail; synchronized?: boolean;
  set?: SetCandidateIsbnRequest; setResponse?: SetCandidateIsbnResponse; isbnSaved?: boolean; lookup?: RequestEditionOptionsRequest;
};
type RetryLabel = 'Retry same addition' | 'Retry ISBN save' | 'Retry search';
export const missedBookLimitText = 'This scan already has 15 books — scan the rest separately.';
const successText = 'Book added. Open Find or change edition to choose its edition.';

// SDD 01a §15 (Owner note): one in-memory record, frozen DTOs, resume the first unfinished step.
export function useOwnerMissedBookIsbnFlow({ identity, sessionId, canMutate, refetchSession }: {
  identity: ImageInventoryIdentity; sessionId: string; canMutate: boolean;
  refetchSession: () => Promise<QueryObserverResult<OwnerSessionSummaryV3, Error>>;
}) {
  const client = useCorrectionQueryClient();
  const mutation = useAddManualCandidate(identity);
  const [pending, setPending] = useState<PendingAddition | null>(null);
  const pendingRef = useRef<PendingAddition | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlightRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [retryLabel, setRetryLabel] = useState<RetryLabel | null>(null);
  const [addSucceeded, setAddSucceeded] = useState(false);
  const [isbnSaved, setIsbnSaved] = useState(false);
  const [isbnPressDone, setIsbnPressDone] = useState(false);
  const [holdOnScreen, setHoldOnScreen] = useState(false);
  const [completedFingerprint, setCompletedFingerprint] = useState<string | null>(null);
  const scope = `${identity.userId}:${identity.storeId}:${sessionId}`;
  const activeScope = useRef(scope);
  const runGeneration = useRef(0);
  const controller = useRef<AbortController | null>(null);
  // The screen keys this hook by user/store/session; cleanup also fences late promises.
  useEffect(() => {
    activeScope.current = scope;
    return () => { activeScope.current = ''; controller.current?.abort(); pendingRef.current = null; };
  }, [scope]);

  const run = async (record: PendingAddition) => {
    if (!canMutate || inFlightRef.current) return;
    const generation = ++runGeneration.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const callScope = activeScope.current;
    const isCurrent = () => !abort.signal.aborted && activeScope.current === callScope
      && runGeneration.current === generation
      && getResolvedImageInventoryIdentity()?.userId === identity.userId
      && getResolvedImageInventoryIdentity()?.storeId === identity.storeId;
    const refreshReviewList = () => {
      void client.invalidateQueries({ queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId) }).catch(() => undefined);
    };
    const invalidate = () => {
      for (const queryKey of [imageInventoryKeys.discovery(identity), imageInventoryKeys.readiness(identity, sessionId),
        imageInventoryKeys.candidate(identity, sessionId, record.candidateId!), ownerBatchReviewKeys.batchReview(identity, sessionId),
        ownerBatchReviewKeys.sessionV3(identity, sessionId), ownerBatchReviewKeys.readinessV3(identity, sessionId)]) {
        void client.invalidateQueries({ queryKey }).catch(() => undefined);
      }
    };
    const reread = async () => {
      const incoming = await ownerEditionPickerService.readEditionChoices({ action: 'read_candidate_edition_choices',
        contractVersion: OWNER_UX_CONTRACT_VERSION, sessionId, candidateId: record.candidateId! }, abort.signal);
      if (!isCurrent()) return null;
      if (incoming.sessionId !== sessionId || incoming.candidateId !== record.candidateId) throw new Error('ISBN_READ_MISMATCH');
      return acceptEditionChoices(client, identity, { sessionId, candidateId: record.candidateId! }, incoming, 'read');
    };
    const clearPending = () => { pendingRef.current = null; setPending(null); };
    const reportUnclear = () => {
      setMessage('The result is unclear. Retry the exact same addition.');
      setRetryLabel('Retry same addition'); refreshReviewList();
    };
    let receivedAdd = false;
    let searchFinished = false;
    inFlightRef.current = true; setBusy(true); setMessage(null); setRetryLabel(null);
    try {
      // AC5b-2: the original add-only recovery replays its add before verifying again.
      if (!record.isbn13) {
        record.candidateId = undefined; record.canonical = undefined; record.synchronized = false;
      }
      if (!record.candidateId) {
        const result = await mutation.mutateAsync(record.add);
        receivedAdd = true;
        if (!isCurrent()) return;
        if (result.authenticatedUserId !== identity.userId) { reportUnclear(); return; }
        record.candidateId = result.candidateId;
      }
      if (record.isbn13) { setAddSucceeded(true); setHoldOnScreen(true); }
      if (!record.canonical) {
        const canonical = await ownerUxService.readCandidate(sessionId, record.candidateId);
        if (!isCurrent()) return;
        if (canonical.sessionId !== sessionId || canonical.candidateId !== record.candidateId) throw new Error('ADDITION_READ_MISMATCH');
        record.canonical = canonical;
      }
      if (!record.synchronized) {
        const synchronized = record.isbn13
          ? cacheCorrectionCandidate(client, identity, sessionId, record.candidateId, record.canonical)
          : await synchronizeCorrectionCandidate(client, identity, sessionId, record.candidateId, record.canonical);
        if (!isCurrent()) return;
        if (!synchronized) throw new Error('ADDITION_READ_MISMATCH');
        if (record.isbn13) {
          for (const queryKey of [imageInventoryKeys.discovery(identity), imageInventoryKeys.session(identity, sessionId),
            imageInventoryKeys.readiness(identity, sessionId)]) {
            void client.invalidateQueries({ queryKey }).catch(() => undefined);
          }
        }
        record.synchronized = true;
        refreshReviewList();
      }
      if (record.isbn13) {
        if (!record.set) record.set = createCandidateIsbnCommand(record.canonical, record.isbn13);
        if (!record.isbnSaved) {
          const result = await ownerEditionPickerService.setCandidateIsbn(record.set, abort.signal);
          if (!isCurrent()) return;
          if (result.sessionId !== sessionId || result.candidateId !== record.candidateId
            || result.ownerIsbn13 !== record.isbn13) throw new Error('ISBN_SET_MISMATCH');
          record.setResponse = result; record.isbnSaved = true; setIsbnSaved(true);
        }
        if (!record.lookup) {
          const choices = await reread();
          if (!isCurrent() || !choices) return;
          // Whole-feature review: the one search must still describe this press (same ISBN, nothing older).
          if (!record.setResponse || !choicesFollowIsbnSet(choices, record.setResponse)) throw new Error('ISBN_CHANGED_ELSEWHERE');
          record.lookup = createEditionLookupCommand(choices);
          invalidate();
        }
        const receipt = await ownerEditionPickerService.requestEditionOptions(record.lookup, abort.signal);
        if (!isCurrent()) return;
        searchFinished = true;
        // AC5b-6: a confirmed request is finished even if local receipt acceptance fails.
        try { acceptEditionLookupReceipt(client, identity, { sessionId, candidateId: record.candidateId }, receipt); }
        catch { /* Local cache acceptance is best-effort after the server receipt. */ }
        setMessage(successText); setIsbnPressDone(true);
      }
      setCompletedFingerprint(record.fingerprint);
      clearPending();
    } catch (error) {
      if (!isCurrent()) return;
      if (record.isbn13 && record.candidateId) {
        if (!record.synchronized) refreshReviewList();
        const setMismatch = error instanceof Error && error.message === 'ISBN_SET_MISMATCH';
        const readMismatch = error instanceof Error && error.message === 'ISBN_READ_MISMATCH';
        const changedElsewhere = error instanceof Error && error.message === 'ISBN_CHANGED_ELSEWHERE';
        const retryable = !setMismatch && !readMismatch && !changedElsewhere && isbnSearchRecovery(error).kind === 'retry';
        if (!record.isbnSaved || setMismatch) {
          const stateConflict = error instanceof OwnerUxClientError && error.code === 'P9_STATE_CONFLICT';
          setMessage(stateConflict
            ? "Book added, but the ISBN wasn't saved. This book can't be changed now."
            : retryable ? "Book added, but the ISBN wasn't saved."
              : "Book added, but the ISBN wasn't saved. Open Find or change edition to enter it.");
          setRetryLabel(retryable ? 'Retry ISBN save' : null);
          // SDD 01a §5.5: this refusal can describe the card or the session.
          if (stateConflict) {
            void refetchSession().then(refreshed => {
              if (isCurrent() && !refreshed.isError && refreshed.error === null
                && refreshed.data?.sessionId === sessionId && refreshed.data.status === 'closed') {
                setMessage("Book added. This scan is closed, so the ISBN can't be saved.");
              }
            }).catch(() => undefined);
          }
        } else {
          setMessage(changedElsewhere
            ? 'Book added. The ISBN was saved, but this book changed before the search could start. Open Find or change edition to search.'
            : retryable ? "Book added. The ISBN search didn't start."
              : "Book added. The ISBN search didn't start. Open Find or change edition to search.");
          setRetryLabel(retryable ? 'Retry search' : null);
          if (error instanceof OwnerUxClientError && error.code === 'P9_STATE_CONFLICT') {
            void refetchSession().then(refreshed => {
              if (isCurrent() && !refreshed.isError && refreshed.error === null
                && refreshed.data?.sessionId === sessionId && refreshed.data.status === 'closed') {
                setMessage("Book added and the ISBN saved. This scan is closed, so the search can't run.");
              }
            }).catch(() => undefined);
          }
        }
        // Scoped §15.4 deviation: definite version refusals are never replayed.
        if (!retryable) { record.lookup = undefined; clearPending(); setIsbnPressDone(true); invalidate(); }
      } else if (receivedAdd || record.candidateId || !(error instanceof OwnerCorrectionClientError) || error.code === 'P9_INTERNAL_ERROR') {
        reportUnclear();
      } else {
        clearPending();
        setMessage(error.code === 'P9_LIMIT_EXCEEDED' ? missedBookLimitText : error.message);
        if (error.code === 'P9_STATE_CONFLICT') {
          void refetchSession().then(refreshed => {
            if (isCurrent() && (refreshed.isError || refreshed.error !== null || refreshed.data?.sessionId !== sessionId)) {
              setMessage('The latest scan-session state could not be verified.');
            }
          }).catch(() => { if (isCurrent()) setMessage('The latest scan-session state could not be verified.'); });
        }
      }
    } finally {
      // §15.4 / AC4-9: publish the outcome and release busy before best-effort refreshes.
      if (isCurrent()) {
        inFlightRef.current = false; setBusy(false);
        if (record.isbnSaved) {
          invalidate();
          if (searchFinished) void reread().catch(() => undefined);
        }
      }
    }
  };
  return { pending, pendingRef, busy, message, retryLabel, addSucceeded, isbnSaved, isbnPressDone, holdOnScreen,
    completedFingerprint, mutationPending: mutation.isPending,
    start: (add: AddManualCandidateRequest, isbn13: string | null, fingerprint: string) => {
      if (!canMutate || pendingRef.current || mutation.isPending || inFlightRef.current || isbnPressDone) return;
      const record = { add, isbn13, fingerprint };
      pendingRef.current = record; setPending(record); void run(record);
    },
    retry: () => { if (pendingRef.current && retryLabel) void run(pendingRef.current); },
  };
}
