import {
  SearchVariantProposalSidecar,
  SearchVariantSource,
  SearchVariantType,
} from '../contracts/searchVariants';
import {
  SpineAnalysisResult,
  spineAnalysisResultSnapshot,
} from '../contracts/vision';

type RpcResult = Readonly<{
  data: unknown;
  error: Readonly<{ message?: string }> | null;
}>;
type Client = Readonly<{
  rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
}>;

export type SearchVariantPersistenceRow = Readonly<{
  source_field: string;
  target_type: 'title' | 'author';
  author_index: number | null;
  source_text: string;
  source_language: string;
  source_script: string;
  source_normalized: string;
  variant_text: string;
  variant_language: string;
  variant_script: string;
  variant_type: SearchVariantType;
  variant_normalized: string;
}>;

export type SearchVariantPersistenceEnvelope = Readonly<{
  contract_version: string;
  proposal_schema_version: string;
  analysis_reference: string;
  generation_source: string;
  provider_key: string;
  model_key: string;
  model_version: string;
  prompt_version: string;
  proposals: readonly SearchVariantPersistenceRow[];
}>;

const authorIndex = (field: string): number | null => {
  const match = /^observation:\d+:author:(\d+)$/u.exec(field);
  return match ? Number(match[1]) : null;
};

function rows(
  target: 'title' | 'author',
  source: SearchVariantSource,
  proposals: SearchVariantProposalSidecar['titles'][number]['proposals'],
): readonly SearchVariantPersistenceRow[] {
  return proposals.map((proposal) => ({
    source_field: source.field,
    target_type: target,
    author_index: target === 'author' ? authorIndex(source.field) : null,
    source_text: source.text,
    source_language: source.language,
    source_script: source.script,
    source_normalized: source.deterministicSearchKey,
    variant_text: proposal.text,
    variant_language: proposal.language,
    variant_script: proposal.script,
    variant_type: proposal.type,
    variant_normalized: proposal.deterministicSearchKey,
  }));
}

export function buildSearchVariantPersistenceEnvelope(
  sidecar: SearchVariantProposalSidecar,
): SearchVariantPersistenceEnvelope {
  return {
    contract_version: sidecar.contractVersion,
    proposal_schema_version: sidecar.schemaVersion,
    analysis_reference: sidecar.analysisReference,
    generation_source: sidecar.generationSource,
    provider_key: sidecar.providerKey,
    model_key: sidecar.modelKey,
    model_version: sidecar.modelVersion,
    prompt_version: sidecar.promptVersion,
    proposals: [
      ...sidecar.titles.flatMap(({ source, proposals }) =>
        rows('title', source, proposals)),
      ...sidecar.authors.flatMap(({ source, proposals }) =>
        rows('author', source, proposals)),
    ],
  };
}

export async function persistVisionAnalysisWithSearchVariants(
  client: Client,
  input: Readonly<{
    claim: Readonly<{
      jobId: string;
      worker: string;
      leaseToken: string;
      attemptCount: number;
    }>;
    vision: SpineAnalysisResult;
    variants: SearchVariantProposalSidecar;
  }>,
): Promise<Record<string, unknown>> {
  const result = await client.rpc(
    'phase9_persist_vision_analysis_with_variants',
    {
      p_job_id: input.claim.jobId,
      p_worker: input.claim.worker,
      p_lease_token: input.claim.leaseToken,
      p_attempt_count: input.claim.attemptCount,
      p_result: spineAnalysisResultSnapshot(input.vision),
      p_variants: buildSearchVariantPersistenceEnvelope(input.variants),
    },
  );
  if (result.error) throw new Error(result.error.message ?? 'P9_DATABASE_ERROR');
  if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
    throw new Error('P9_DATABASE_ERROR');
  }
  return result.data as Record<string, unknown>;
}
