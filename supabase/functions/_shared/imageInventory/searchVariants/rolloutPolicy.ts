import {
  AutomaticVariantActivationContext,
  AutomaticVariantActivationPolicy,
} from './activationPolicy';

type Client = Readonly<{
  rpc(name: string, args: Record<string, unknown>): Promise<Readonly<{
    data: unknown;
    error: Readonly<{ message?: string }> | null;
  }>>;
}>;

export function createDatabaseAutomaticActivationPolicy(
  client: Client,
): AutomaticVariantActivationPolicy {
  return Object.freeze({
    key: 'exact_approved_rollout_v1',
    async allows(context: AutomaticVariantActivationContext): Promise<boolean> {
      const result = await client.rpc(
        'phase9_search_variant_automatic_activation_allowed',
        {
          p_proposal_id: context.proposalId,
          p_source_language: context.sourceLanguage,
          p_source_script: context.sourceScript,
          p_target_type: context.targetType,
          p_model_key: context.modelKey ?? null,
          p_model_version: context.modelVersion ?? null,
          p_prompt_version: context.promptVersion ?? null,
          p_schema_version: context.schemaVersion ?? null,
        },
      );
      if (result.error) throw new Error(result.error.message ?? 'P9_DATABASE_ERROR');
      return result.data === true;
    },
  });
}
