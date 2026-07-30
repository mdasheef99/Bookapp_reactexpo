import {
  asRecord,
  assertKnownKeys,
  boundedInteger,
  optionalString,
  parseIdempotencyKey,
  requiredString,
} from '../domain/validation';

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu;
const ACTIONS = ['approve', 'reject'] as const;
const SAFE_ROW_KEYS = [
  'proposal_id', 'concurrency_version', 'target_type', 'author_position',
  'confirmed_source_text', 'proposed_text', 'variant_type', 'source_language',
  'source_script', 'variant_language', 'variant_script', 'lifecycle_status',
  'generation_source', 'provider_key', 'model_key', 'model_version',
  'prompt_version', 'schema_version', 'automatic_activation_denial_reason',
  'stale_conflict_reason', 'created_at', 'allowed_actions',
] as const;

type DecisionAction = typeof ACTIONS[number];

export type OwnerVariantDecisionInput = Readonly<{
  storeId: string;
  proposalId: string;
  expectedVersion: number;
  action: DecisionAction;
  reason: string;
  note: string | null;
  idempotencyKey: string;
}>;

export function buildOwnerVariantDecisionCommand(
  input: OwnerVariantDecisionInput,
): Record<string, unknown> {
  if (!ACTIONS.includes(input.action)) throw new Error('action');
  return {
    p_store_id: requiredString(input.storeId, 'store_id', 36, {
      activeContent: false, pattern: UUID,
    }),
    p_proposal_id: requiredString(input.proposalId, 'proposal_id', 36, {
      activeContent: false, pattern: UUID,
    }),
    p_expected_version: boundedInteger(
      input.expectedVersion, 'expected_version', 1, 2_147_483_647,
    ),
    p_action: input.action,
    p_reason: requiredString(input.reason, 'reason', 64, {
      activeContent: false, pattern: /^[a-z][a-z0-9_]{2,63}$/u,
    }),
    p_note: optionalString(input.note, 'note', 500),
    p_idempotency_key: parseIdempotencyKey(input.idempotencyKey),
  };
}

export type OwnerVariantReviewItem = Readonly<{
  proposalId: string;
  concurrencyVersion: number;
  targetType: 'title' | 'author';
  authorPosition: number | null;
  confirmedSourceText: string;
  proposedText: string;
  allowedActions: readonly string[];
  [key: string]: unknown;
}>;

export function parseOwnerVariantReviewPage(
  value: unknown,
): readonly OwnerVariantReviewItem[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('review_page');
  return value.map((entry, index) => {
    const row = asRecord(entry, `review_page[${index}]`);
    assertKnownKeys(row, SAFE_ROW_KEYS, `review_page[${index}]`);
    if (row.target_type !== 'title' && row.target_type !== 'author') {
      throw new Error('target_type');
    }
    const authorPosition = row.target_type === 'author'
      ? boundedInteger(row.author_position, 'author_position', 1, 20)
      : null;
    if (!Array.isArray(row.allowed_actions)
      || row.allowed_actions.some((action) => typeof action !== 'string')) {
      throw new Error('allowed_actions');
    }
    return {
      proposalId: requiredString(row.proposal_id, 'proposal_id', 36, {
        activeContent: false, pattern: UUID,
      }),
      concurrencyVersion: boundedInteger(
        row.concurrency_version, 'concurrency_version', 1, 2_147_483_647,
      ),
      targetType: row.target_type,
      authorPosition,
      confirmedSourceText: requiredString(
        row.confirmed_source_text, 'confirmed_source_text', 512,
      ),
      proposedText: requiredString(row.proposed_text, 'proposed_text', 256),
      variantType: row.variant_type,
      sourceLanguage: row.source_language,
      sourceScript: row.source_script,
      variantLanguage: row.variant_language,
      variantScript: row.variant_script,
      lifecycleStatus: row.lifecycle_status,
      generationSource: row.generation_source,
      providerKey: row.provider_key,
      modelKey: row.model_key,
      modelVersion: row.model_version,
      promptVersion: row.prompt_version,
      schemaVersion: row.schema_version,
      automaticActivationDenialReason: row.automatic_activation_denial_reason,
      staleConflictReason: row.stale_conflict_reason,
      createdAt: row.created_at,
      allowedActions: Object.freeze([...row.allowed_actions]),
    };
  });
}
