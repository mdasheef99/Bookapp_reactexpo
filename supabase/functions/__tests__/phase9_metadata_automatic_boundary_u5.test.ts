import { buildAutomaticCompletion, validateAutomaticCompletion, decodeAutomaticReceipt,
  createMetadataAutomaticCompletionBoundary, AutomaticCompletionUncertainError }
  from '../_shared/imageInventory/runtime/metadataAutomaticCompletion';
import { command, context, fence, packet, receipt, validation, GOLDEN_LOOKUP_ID, GOLDEN_ATTEMPT_ID, GOLDEN_CLOCK }
  from './support/automaticB1';
import { OL_V2_AUTOMATIC_EXPECTED } from './fixtures/phase9/providerReplacementTargets';
import { createOpenLibraryV2Descriptor } from '../_shared/imageInventory/metadata/openLibrary/descriptor';
import { OPEN_LIBRARY_V2_PROVIDER_VALIDATION } from '../_shared/imageInventory/metadata/openLibrary/validation';

const input = () => { const { selectedOptionId, ...rest } = command(); return rest; };
function retained() {
  const result = JSON.parse(JSON.stringify(OL_V2_AUTOMATIC_EXPECTED));
  const descriptor = createOpenLibraryV2Descriptor({ policyVersion: result.retention.policyVersion });
  const evidence = { sourceFetchedAt: result.retention.sourceFetchedAt,
    permittedDeadlineAt: result.retention.permittedDeadlineAt, policyVersion: result.retention.policyVersion,
    retentionContract: descriptor.retentionContract! };
  return { result, validation: { purpose: 'automatic' as const, descriptor,
    installed: new Map([['open_library@2.0.0', descriptor]]), providerValidation: OPEN_LIBRARY_V2_PROVIDER_VALIDATION,
    lookupId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID, now: GOLDEN_CLOCK, retentionEvidence: evidence } };
}
describe('U5 B1 automatic completion boundary (02c §4.3)', () => {
  // Mutation caught: receipt-only recovery adopts a selected option on a manual/nonwinning outcome without a command binding.
  it.each(['ambiguous', 'material_conflict', 'no_match', 'technical_failure', 'policy_denied',
    'cost_quota_denied', 'manual_metadata_required'])('F4 rejects selected option for %s with no binding', outcome => {
    expect(() => decodeAutomaticReceipt({ ...receipt(), status: 'replayed', outcome, selectedOptionId: GOLDEN_LOOKUP_ID }))
      .toThrow('P9_AUTOMATIC_COMPLETION_INVALID');
    expect(decodeAutomaticReceipt({ ...receipt(), status: 'replayed', outcome })).toEqual({ ...receipt(), status: 'replayed', outcome });
    expect(decodeAutomaticReceipt({ ...receipt(), selectedOptionId: GOLDEN_LOOKUP_ID }))
      .toEqual({ ...receipt(), selectedOptionId: GOLDEN_LOOKUP_ID });
    expect(decodeAutomaticReceipt(receipt())).toEqual(receipt());
  });
  // Mutation caught: inventing Google option/list data or retaining mutable command references.
  it('builds the exact immutable listless Google command without altering golden bytes', () => {
    const original = input(), built = buildAutomaticCompletion(original, validation());
    expect(built).toEqual(command()); expect(Object.keys(built)).toHaveLength(6);
    expect(built.result).toEqual(packet()); expect(built.selectedOptionId).toBeNull();
    expect(Object.isFrozen(built.result.outcome.selected)).toBe(true);
    original.fence.requestGeneration = 7; expect(built.fence.requestGeneration).toBe(0);
    expect(validateAutomaticCompletion(command(), validation())).toEqual(command());
  });
  // Mutation caught: forwarding malformed command/source/fence/envelope keys to SQL.
  it.each([{ ...command(), extra: true }, { ...command(), source: 'invented' },
    { ...command(), attemptId: null }, { ...command(), selectedOptionId: GOLDEN_LOOKUP_ID },
    { ...command(), result: { ...packet(), purpose: 'edition_options' } },
    { ...command(), result: { ...packet(), extra: true } },
    { ...command(), fence: { ...fence(), extra: true } },
    { ...command(), result: { ...packet(), outcome: { ...packet().outcome, extra: true } } }])('rejects malformed command %p', value => {
    expect(() => validateAutomaticCompletion(value, validation())).toThrow();
    expect(validateAutomaticCompletion(command(), validation())).toEqual(command());
  });
  // Mutation caught: selecting by provider ID alone, or accepting missing/duplicate/crossed companion identity.
  it.each(['missing companion', 'duplicate companion', 'crossed attempt', 'changed selected', 'duplicate row', 'forged retention']) (
    'rejects retained binding mutation: %s', mutation => {
      const good = retained();
      const positive = buildAutomaticCompletion({ ...input(), result: good.result }, good.validation);
      expect(positive.selectedOptionId).toBe(good.result.rows[0].optionId);
      const bad = retained();
      const mutations: Record<string, () => void> = {
        'missing companion': () => { bad.result.catalogueCompanions = []; },
        'duplicate companion': () => { bad.result.catalogueCompanions.push(bad.result.catalogueCompanions[0]); },
        'crossed attempt': () => { bad.result.catalogueCompanions[0].attemptId = GOLDEN_LOOKUP_ID; },
        'changed selected': () => { bad.result.rows[0].metadata.title = 'Changed title'; },
        'duplicate row': () => { bad.result.rows.push(bad.result.rows[0]); },
        'forged retention': () => { bad.result.retention.policyVersion += 1; },
      };
      mutations[mutation]();
      expect(() => buildAutomaticCompletion({ ...input(), result: bad.result }, bad.validation)).toThrow();
    });
  // Mutation caught: requiring a fabricated provider attempt/validator for zero-egress local manual completion.
  it('accepts strict local manual input and rejects provider evidence on that source', () => {
    const result = { ...packet(), outcome: { outcome: 'insufficient_query', candidates: [], selected: null,
      evidence: [], retryable: false, secondaryEligible: false, providerRequestId: null, representativeCover: null } };
    const local = buildAutomaticCompletion({ ...input(), source: 'local', attemptId: null, result });
    expect(local.attemptId).toBeNull(); expect(local.selectedOptionId).toBeNull();
    expect(() => buildAutomaticCompletion({ ...input(), source: 'local', attemptId: null })).toThrow();
    expect(context().purpose).toBe('automatic');
  });
  // Mutation caught: adopting an unbound/forged success receipt, including a missing effective-M93 snapshot.
  it.each([{ ...receipt(), extra: true }, { ...receipt(), lookupId: fence().jobId },
    { ...receipt(), selectedOptionId: GOLDEN_LOOKUP_ID }, { ...receipt(), outcome: 'no_match' },
    { ...receipt(), snapshotId: null }, { ...receipt(), prefill: { status: 'applied' } },
    { status: 'stale_rejected', extra: true }])('refuses forged receipt %p', value => {
    expect(() => decodeAutomaticReceipt(value, { lookupId: GOLDEN_LOOKUP_ID,
      selectedOptionId: null, outcome: 'accepted_metadata_match' })).toThrow('P9_AUTOMATIC_COMPLETION_INVALID');
    expect(decodeAutomaticReceipt(receipt())).toEqual(receipt());
  });
  // Mutation caught: rebuilding a command/digest or reloading active context during original-fence recovery.
  it('keeps complete and receipt-only recovery separate after committed response loss', async () => {
    const calls: Array<{ name: string; parameters: Readonly<Record<string, unknown>> }> = [];
    const rpc = async (name: string, parameters: Readonly<Record<string, unknown>>) => {
      calls.push({ name, parameters });
      const responses: Record<string, () => { data: unknown; error: unknown }> = {
        phase9_complete_automatic_metadata_v1: () => { throw new Error('lost response'); },
        phase9_recover_automatic_metadata_v1: () => ({ data: { ...receipt(), status: 'replayed' }, error: null }),
      };
      return responses[name]();
    };
    const boundary = createMetadataAutomaticCompletionBoundary({ rpc }, validation());
    const built = buildAutomaticCompletion(input(), validation());
    await expect(boundary.complete(built)).rejects.toBeInstanceOf(AutomaticCompletionUncertainError);
    await expect(boundary.recover(built.fence, { lookupId: built.lookupId,
      selectedOptionId: null, outcome: 'accepted_metadata_match' })).resolves.toEqual({ ...receipt(), status: 'replayed' });
    expect(calls).toEqual([
      { name: 'phase9_complete_automatic_metadata_v1', parameters: { p_command: built } },
      { name: 'phase9_recover_automatic_metadata_v1', parameters: { p_fence: built.fence } },
    ]);
  });
  // Mutation caught: treating a definite SQL rejection as transport uncertainty or malformed success as acceptance.
  it('preserves definite refusal, marks malformed success uncertain, and accepts a bound control', async () => {
    const good = createMetadataAutomaticCompletionBoundary({ rpc: async () => ({ data: receipt(), error: null }) }, validation());
    await expect(good.complete(command())).resolves.toEqual(receipt());
    const refused = createMetadataAutomaticCompletionBoundary({ rpc: async () => ({ data: null,
      error: { message: 'P9_IDEMPOTENCY_MISMATCH', code: 'P0001' } }) }, validation());
    await expect(refused.complete(command())).rejects.toMatchObject({ message: 'P9_IDEMPOTENCY_MISMATCH', uncertain: false });
    const malformed = createMetadataAutomaticCompletionBoundary({ rpc: async () => ({ data: {}, error: null }) }, validation());
    await expect(malformed.complete(command())).rejects.toBeInstanceOf(AutomaticCompletionUncertainError);
  });
  // Mutation caught: accepting a completed recovery, a missing completion, or extra keys on stale/missing variants.
  it('enforces endpoint-specific receipt variants with no provider fallback', async () => {
    const completed = createMetadataAutomaticCompletionBoundary({ rpc: async () => ({ data: receipt(), error: null }) }, validation());
    await expect(completed.recover(fence())).rejects.toBeInstanceOf(AutomaticCompletionUncertainError);
    const missing = createMetadataAutomaticCompletionBoundary({ rpc: async () => ({ data: { status: 'missing' }, error: null }) }, validation());
    await expect(missing.recover(fence())).resolves.toEqual({ status: 'missing' });
    await expect(missing.complete(command())).rejects.toBeInstanceOf(AutomaticCompletionUncertainError);
    const stale = createMetadataAutomaticCompletionBoundary({ rpc: async () => ({ data: { status: 'stale_rejected' }, error: null }) }, validation());
    await expect(stale.complete(command())).resolves.toEqual({ status: 'stale_rejected' });
  });
});
