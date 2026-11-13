import type { QueryClient } from '@tanstack/react-query';
import type { EditionChoices, EditionLookupReceipt, SetCandidateIsbnResponse } from '../contracts/ownerEditionPicker';
import type { ImageInventoryIdentity } from './ownerUxQueries';
import { ownerEditionPickerKeys } from './ownerEditionPickerKeys';
import { assertOwnerCardCurrent, authorityChanged, knownCandidateVersions, versionsRegress,
  type OwnerCardScope } from './ownerCandidateAuthority';

export function freshEditionChoices(value: EditionChoices): EditionChoices {
  return value.optionsExpiresAt && Date.parse(value.optionsExpiresAt) > Date.now()
    ? value : { ...value, rows: [], optionsExpiresAt: null };
}
// Whole-feature review, 2026-10-23: the one search after an ISBN set must be built from choices that
// still describe that set (same ISBN, nothing older); otherwise another device changed the book.
export const choicesFollowIsbnSet = (choices: EditionChoices, set: SetCandidateIsbnResponse): boolean =>
  (choices.ownerIsbn13 ?? null) === set.ownerIsbn13
  && choices.candidateVersion >= set.candidateVersion
  && choices.metadataRevision >= set.metadataRevision
  && choices.requestGeneration >= set.requestGeneration;
export function acceptEditionChoices(
  client: QueryClient, identity: ImageInventoryIdentity, scope: OwnerCardScope,
  incoming: EditionChoices, origin: 'read' | 'selection',
): EditionChoices {
  assertOwnerCardCurrent(client, identity, scope);
  if (incoming.sessionId !== scope.sessionId || incoming.candidateId !== scope.candidateId) throw authorityChanged();
  const key = ownerEditionPickerKeys.choices(identity, scope.sessionId, scope.candidateId);
  const previous = client.getQueryData<EditionChoices>(key);
  const receipt = client.getQueryData<EditionLookupReceipt>(
    ownerEditionPickerKeys.lookup(identity, scope.sessionId, scope.candidateId));
  const staleCandidate = knownCandidateVersions(client, identity, scope)
    .some(accepted => versionsRegress(incoming, accepted));
  const staleOptions = origin === 'read' && (
    !!previous && (incoming.requestGeneration < previous.requestGeneration || incoming.optionsVersion < previous.optionsVersion)
    || !!receipt && (incoming.requestGeneration < receipt.requestGeneration || incoming.optionsVersion < receipt.optionsVersion));
  const changedSelection = !!previous && incoming.metadataRevision === previous.metadataRevision
    && incoming.selection?.selectionId !== previous.selection?.selectionId;
  // 02d §§4–5 / D1: idle invalidates terminal rows and is final at unchanged counters.
  const regressingLookup = origin === 'read'
    && [previous, receipt].some(value => value
      && value.requestGeneration === incoming.requestGeneration && value.optionsVersion === incoming.optionsVersion
      && (incoming.lookupStatus === 'idle'
        ? ('lookupStatus' in value ? value.lookupStatus : value.status) === 'pending'
        : incoming.lookupStatus === 'pending'
          ? ['ready', 'failed'].includes('lookupStatus' in value ? value.lookupStatus : value.status)
          : value === previous && previous?.lookupStatus === 'idle'));
  if (staleCandidate || staleOptions || changedSelection || regressingLookup) {
    if (origin === 'read' && previous) return freshEditionChoices(previous);
    throw authorityChanged();
  }
  let accepted = incoming.lookupStatus === 'idle'
    ? { ...incoming, rows: [], optionsExpiresAt: null } : freshEditionChoices(incoming);
  if (origin === 'selection' && previous) {
    const fresh = freshEditionChoices(previous);
    // 02d §§4–5 / D2: a selection cannot carry old rows across an options advance.
    const newer = incoming.requestGeneration > previous.requestGeneration || incoming.optionsVersion > previous.optionsVersion;
    accepted = { ...accepted, rows: newer ? [] : fresh.rows, optionsExpiresAt: newer ? null : fresh.optionsExpiresAt,
      requestGeneration: Math.max(previous.requestGeneration, incoming.requestGeneration),
      optionsVersion: Math.max(previous.optionsVersion, incoming.optionsVersion),
      lookupStatus: newer ? incoming.lookupStatus ?? 'pending' : previous.lookupStatus };
  }
  client.setQueryData(key, accepted);
  return accepted;
}
export function acceptEditionLookupReceipt(
  client: QueryClient, identity: ImageInventoryIdentity, scope: OwnerCardScope, incoming: EditionLookupReceipt,
): boolean {
  assertOwnerCardCurrent(client, identity, scope);
  const key = ownerEditionPickerKeys.lookup(identity, scope.sessionId, scope.candidateId);
  const previous = client.getQueryData<EditionLookupReceipt>(key);
  const choices = client.getQueryData<EditionChoices>(
    ownerEditionPickerKeys.choices(identity, scope.sessionId, scope.candidateId));
  if ([previous, choices].some(value => value && (incoming.requestGeneration < value.requestGeneration
    || incoming.optionsVersion < value.optionsVersion))) return false;
  if (incoming.status === 'pending' && choices?.requestGeneration === incoming.requestGeneration
    && choices.optionsVersion === incoming.optionsVersion
    && (choices.lookupStatus === 'ready' || choices.lookupStatus === 'failed')) return false;
  if (previous?.operationId === incoming.operationId && previous.requestGeneration === incoming.requestGeneration
    && previous.optionsVersion === incoming.optionsVersion && previous.status !== 'pending' && incoming.status === 'pending') return false;
  client.setQueryData(key, incoming);
  // 02d §4 / D4: pending and unavailable receipts revoke the old selectable list.
  if ((incoming.status === 'pending' || !incoming.available) && choices) {
    client.setQueryData(ownerEditionPickerKeys.choices(identity, scope.sessionId, scope.candidateId), {
      ...choices, rows: [], optionsExpiresAt: null, lookupStatus: incoming.status,
      requestGeneration: incoming.requestGeneration, optionsVersion: incoming.optionsVersion,
    });
  }
  return true;
}
