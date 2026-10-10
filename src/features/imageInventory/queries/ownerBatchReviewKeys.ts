import { imageInventoryKeys, type ImageInventoryIdentity } from './ownerUxQueries';

export const ownerBatchReviewKeys = {
  sessionV3: (identity: ImageInventoryIdentity, sessionId: string) =>
    [...imageInventoryKeys.identity(identity), 'sessionV3', sessionId] as const,
  batchReview: (identity: ImageInventoryIdentity, sessionId: string) =>
    [...imageInventoryKeys.identity(identity), 'batchReview', sessionId] as const,
  readinessV3: (identity: ImageInventoryIdentity, sessionId: string) =>
    [...imageInventoryKeys.identity(identity), 'readinessV3', sessionId] as const,
};