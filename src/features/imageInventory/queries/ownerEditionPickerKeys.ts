import { imageInventoryKeys, type ImageInventoryIdentity } from './ownerUxQueries';

// Picker §§6-7/9: every private cache remains under existing identity cleanup.
export const ownerEditionPickerKeys = {
  card: (identity: ImageInventoryIdentity, sessionId: string, candidateId: string) =>
    [...imageInventoryKeys.identity(identity), 'editionPicker', sessionId, candidateId] as const,
  choices: (identity: ImageInventoryIdentity, sessionId: string, candidateId: string) =>
    [...ownerEditionPickerKeys.card(identity, sessionId, candidateId), 'choices'] as const,
  lookup: (identity: ImageInventoryIdentity, sessionId: string, candidateId: string) =>
    [...ownerEditionPickerKeys.card(identity, sessionId, candidateId), 'lookup'] as const,
  selectionReceipt: (identity: ImageInventoryIdentity, sessionId: string, candidateId: string) =>
    [...ownerEditionPickerKeys.card(identity, sessionId, candidateId), 'selectionReceipt'] as const,
  outcome: (identity: ImageInventoryIdentity, sessionId: string, candidateId: string) =>
    [...imageInventoryKeys.identity(identity), 'candidateOutcome', sessionId, candidateId] as const,
};