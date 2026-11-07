// M93 release needs the live fence. No post-terminal finally; slot release is not usage settlement.
import type { MetadataProductionGateway } from './metadataProductionComposition';
import type { ExplicitProvider } from './metadataExplicitRound';
import type { MetadataEditionOptionsJobResult } from './metadataEditionOptions';
import type { EditionOptionsCompletion, EditionOptionsFence } from './metadataEditionOptionsBoundary';

// D-c: an explicit gateway without a round port cannot execute; never fall back to manual.
export const EXPLICIT_ADMISSION_UNAVAILABLE = 'P9_EDITION_ADMISSION_UNAVAILABLE';
const manual: MetadataEditionOptionsJobResult = { outcome: 'manual_metadata_required' };
export function createExplicitLifecycle(gateway: MetadataProductionGateway, fence: EditionOptionsFence,
  completionResult: (value: EditionOptionsCompletion) => MetadataEditionOptionsJobResult | null) {
  const port = gateway.editionOptions;
  const round = port?.round;
  let preserve = false;
  return {
    get preserve() { return preserve || round?.uncertain === true; },
    async admit(provider: ExplicitProvider): Promise<MetadataEditionOptionsJobResult | null> {
      if (!round || !port) throw new Error(EXPLICIT_ADMISSION_UNAVAILABLE);
      const receipt = await round.reserve(provider);
      if (receipt.status === 'reserved' || receipt.status === 'legacy') return null;
      if (receipt.status === 'capacity_wait') {
        preserve = true; // SQL already rescheduled and restored the attempt; do not clear the lease again.
        return { outcome: 'retry_scheduled' };
      }
      if (receipt.status === 'recovery_only' || receipt.status === 'uncertain') {
        preserve = true;
        try { return completionResult(await port.boundary.recover(fence)) ?? manual; }
        catch { return manual; }
      }
      // D-a: configuration_required and drain_required are bounded outcomes. The provider-
      // disabled failure matches the existing explicit denial identity; M93 returns this
      // before touching the lease, so the fence is live for the single nonretryable write.
      // Configuration and drain never create lineage or egress. W2R-2: attempt that write
      // exactly once; a lost/returned failure response preserves uncertainty instead of
      // letting the executor outer catch issue a second, retryable technical failure.
      if (receipt.status === 'configuration_required') {
        try {
          await port.boundary.fail({ ...fence, outcome: 'provider_disabled', retryable: false });
        } catch {
          preserve = true;
        }
        return manual;
      }
      preserve = true;
      return manual;
    },
    // Defect 4: a stale physical return is already the pinned result. Release is best
    // effort only; any fence refusal is swallowed and never changes the stale_claim.
    async releaseStale(): Promise<void> {
      if (!round || round.uncertain) return;
      try { await round.release(); } catch { /* best effort; stale_claim stands */ }
    },
    async beforeTransition(terminalFailure = false): Promise<boolean> {
      if (preserve || round?.uncertain) return false;
      if (!round) throw new Error(EXPLICIT_ADMISSION_UNAVAILABLE);
      const released = await round.release();
      if (released === 'released') return true;
      // C6: M93 refuses stale_rejected even when M92 durably proves no send. M99 may
      // terminally settle these; never relabel them finalized just to get a release receipt.
      if (released === 'recovery_only' && terminalFailure
        && gateway.editionProviderCalls?.onlyProvenUnsent() === true) return true;
      preserve = true;
      return false;
    },
  };
}
