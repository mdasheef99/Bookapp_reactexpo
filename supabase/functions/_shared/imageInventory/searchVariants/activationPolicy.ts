import {
  normalizeVariantComparisonText,
  SearchVariantReconciliation,
  SearchVariantSourceIdentity,
} from './reconciliation';

type ProposalStatus = 'proposed' | 'active' | 'rejected' | 'stale';
type VariantType =
  | 'primary_roman'
  | 'roman_alternative'
  | 'translation_candidate';

export type SearchVariantLifecycleProposal = Readonly<{
  id: string;
  status: ProposalStatus;
  targetType: 'title' | 'author';
  variantType: VariantType;
  variantText: string;
  variantLanguage: string;
  variantScript: string;
  source: SearchVariantSourceIdentity;
  modelKey?: string;
  modelVersion?: string;
  promptVersion?: string;
  schemaVersion?: string;
}>;

export type AutomaticVariantActivationContext = Readonly<{
  proposalId: string;
  sourceLanguage: string;
  modelKey?: string;
  modelVersion?: string;
  promptVersion?: string;
  schemaVersion?: string;
}>;

export interface AutomaticVariantActivationPolicy {
  readonly key: string;
  allows(context: AutomaticVariantActivationContext): boolean | Promise<boolean>;
}

export const denyAutomaticVariantActivationPolicy:
AutomaticVariantActivationPolicy = Object.freeze({
  key: 'deny_all_v1',
  allows: () => false,
});

export type SearchVariantLifecyclePlan = Readonly<{
  action: 'retain' | 'activate' | 'stale';
  status: ProposalStatus;
  reason: string;
}>;

export async function planSearchVariantLifecycle(
  proposal: SearchVariantLifecycleProposal,
  reconciliation: SearchVariantReconciliation,
  policy: AutomaticVariantActivationPolicy =
    denyAutomaticVariantActivationPolicy,
): Promise<SearchVariantLifecyclePlan> {
  if (proposal.status === 'rejected' || proposal.status === 'stale') {
    return { action: 'retain', status: proposal.status, reason: 'terminal_lifecycle' };
  }
  if ((proposal.status === 'active' && reconciliation.outcome === 'not_confirmed')
    || reconciliation.outcome === 'materially_changed'
    || reconciliation.outcome === 'conflicting'
    || reconciliation.outcome === 'invalid_source_reference') {
    return { action: 'stale', status: 'stale', reason: reconciliation.outcome };
  }
  if (reconciliation.outcome !== 'equivalent'
    || proposal.status !== 'proposed'
    || proposal.variantType !== 'primary_roman'
    || proposal.variantScript !== 'Latn'
    || proposal.source.script === 'Latn'
    || normalizeVariantComparisonText(proposal.variantText)
      === normalizeVariantComparisonText(proposal.source.text)) {
    return { action: 'retain', status: proposal.status, reason: reconciliation.outcome };
  }
  const allowed = await policy.allows({
    proposalId: proposal.id,
    sourceLanguage: proposal.source.language,
    modelKey: proposal.modelKey,
    modelVersion: proposal.modelVersion,
    promptVersion: proposal.promptVersion,
    schemaVersion: proposal.schemaVersion,
  });
  return allowed
    ? { action: 'activate', status: 'active', reason: policy.key }
    : { action: 'retain', status: 'proposed', reason: policy.key };
}
