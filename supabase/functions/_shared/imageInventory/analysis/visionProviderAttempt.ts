import { SpineAnalysisRequest } from '../contracts/vision';
import { GeminiUsageEvidence } from './geminiUsageEvidence';

export type VisionClaimContext = Readonly<{
  jobId: string;
  leaseOwner: string;
  leaseToken: string;
  attemptNumber: number;
}>;
export type AttemptRegistration = Readonly<{
  attemptId: string;
}>;
export type VisionEgressPhase = 'media_download' | 'provider_egress';
export type AttemptFinalization = Readonly<{
  disposition: 'response_received' | 'failed';
  normalizedOutcome: string;
  providerRequestId: string | null;
  usage: GeminiUsageEvidence;
}>;
export type VisionProviderAttemptGateway = Readonly<{
  register(
    request: SpineAnalysisRequest,
    claim: VisionClaimContext,
    lineage: Readonly<{
      providerRole: 'primary';
      providerKey: 'google_gemini';
      modelKey: string;
      modelVersion: string;
    }>,
  ): Promise<AttemptRegistration>;
  validateEgress(
    attemptId: string,
    request: SpineAnalysisRequest,
    claim: VisionClaimContext,
    phase: VisionEgressPhase,
  ): Promise<unknown>;
  finalize(
    attemptId: string,
    claim: VisionClaimContext,
    evidence: AttemptFinalization,
  ): Promise<void>;
  mark(
    attemptId: string,
    claim: VisionClaimContext,
    disposition: 'stale_rejected' | 'failed' | 'outcome_unknown',
    normalizedOutcome: string,
  ): Promise<void>;
  associate?(attemptId: string, claim: VisionClaimContext): Promise<void>;
}>;
