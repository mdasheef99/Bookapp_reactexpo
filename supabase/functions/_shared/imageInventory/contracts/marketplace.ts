import { asRecord, assertKnownKeys, boundedInteger, boundedNumber, Phase9ContractError, requiredString } from '../domain/validation';
import { PHASE9_MARKETPLACE_QUERY_VERSION, PHASE9_RANKING_VERSION } from './versions';
import { PHASE9_LIMITS, PHASE9_MARKETPLACE_QUERY_REGISTER } from './registers';

export type MarketplaceCursorPayload = Readonly<{
  queryVersion: typeof PHASE9_MARKETPLACE_QUERY_VERSION;
  rankingVersion: typeof PHASE9_RANKING_VERSION;
  contextFingerprint: string;
  lastMatchScore: number;
  lastStoreId: string;
  pageSize: number;
}>;

export function parseVerifiedMarketplaceCursorPayload(value: unknown): MarketplaceCursorPayload {
  const input = asRecord(value, 'cursor');
  assertKnownKeys(input, ['query_version', 'ranking_version', 'context_fingerprint', 'last_match_score', 'last_store_id', 'page_size'], 'cursor');
  if (input.query_version !== PHASE9_MARKETPLACE_QUERY_VERSION) throw new Phase9ContractError('cursor.query_version', 'stale query version');
  if (input.ranking_version !== PHASE9_RANKING_VERSION) throw new Phase9ContractError('cursor.ranking_version', 'stale ranking version');
  return {
    queryVersion: PHASE9_MARKETPLACE_QUERY_VERSION,
    rankingVersion: PHASE9_RANKING_VERSION,
    contextFingerprint: requiredString(input.context_fingerprint, 'cursor.context_fingerprint', 128, { activeContent: false, pattern: /^[A-Za-z0-9_-]{32,128}$/u }),
    lastMatchScore: boundedNumber(input.last_match_score, 'cursor.last_match_score', 0, 1),
    lastStoreId: requiredString(input.last_store_id, 'cursor.last_store_id', 36, { activeContent: false, pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu }),
    pageSize: boundedInteger(input.page_size, 'cursor.page_size', 1, PHASE9_LIMITS.marketplacePageSize),
  };
}

export function assertSafeMarketplaceDto(value: unknown, field = 'marketplace_dto'): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if ((PHASE9_MARKETPLACE_QUERY_REGISTER.forbiddenFields as readonly string[]).includes(key)) {
      throw new Phase9ContractError(`${field}.${key}`, 'private field is forbidden from public marketplace DTOs');
    }
    assertSafeMarketplaceDto(nested, `${field}.${key}`);
  }
}

export function assertMarketplaceStoreGroupPage(input: {
  storeIds: readonly string[];
  bookstoreCount: number;
  offerCount: number;
  titleCount: number;
}): void {
  if (new Set(input.storeIds).size !== input.storeIds.length) {
    throw new Phase9ContractError('marketplace_page.store_ids', 'each store group must appear once per page');
  }
  const bookstoreCount = boundedInteger(input.bookstoreCount, 'bookstore_count', 0, Number.MAX_SAFE_INTEGER);
  boundedInteger(input.offerCount, 'offer_count', 0, Number.MAX_SAFE_INTEGER);
  boundedInteger(input.titleCount, 'title_count', 0, Number.MAX_SAFE_INTEGER);
  if (bookstoreCount < input.storeIds.length) {
    throw new Phase9ContractError('bookstore_count', 'cannot be smaller than the returned store-group page');
  }
}

export function assertCursorContext(cursor: MarketplaceCursorPayload, expectedFingerprint: string): void {
  if (cursor.contextFingerprint !== expectedFingerprint) {
    throw new Phase9ContractError('cursor.context_fingerprint', 'cursor belongs to a different query or filter context');
  }
}

export const MARKETPLACE_PUBLIC_COUNT_DEFINITIONS = {
  bookstore_count: 'distinct eligible store groups matching the bound query',
  offer_count: 'eligible public inventory offers across all matching store groups',
  title_count: 'distinct active public title identities in the selected store catalogue',
} as const;
