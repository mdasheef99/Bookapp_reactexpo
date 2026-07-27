import {
  SpineAnalysisRequest,
  SpineImageAnalyzer,
} from '../contracts/vision';

type Claim = Readonly<{ id: string; attempt_count: number; lease_token: string }>;
export type ProviderAttemptCompletion = Readonly<{
  result: unknown;
  providerAttemptId: string;
  accept(): Promise<void>;
  reject(
    disposition: 'stale_rejected' | 'outcome_unknown',
    outcome: string,
  ): Promise<void>;
}>;
type ClaimAwareAnalyzer = SpineImageAnalyzer & Readonly<{
  analyzeClaim(
    request: SpineAnalysisRequest,
    claim: Readonly<{
      jobId: string;
      leaseOwner: string;
      leaseToken: string;
      attemptNumber: number;
    }>,
  ): Promise<ProviderAttemptCompletion>;
}>;

export async function analyzeCurrentClaim(
  analyzer: SpineImageAnalyzer,
  request: SpineAnalysisRequest,
  job: Claim,
  leaseOwner: string,
): Promise<Readonly<{
  untrusted: unknown;
  providerAttempt?: ProviderAttemptCompletion;
}>> {
  if ('analyzeClaim' in analyzer
    && typeof (analyzer as Partial<ClaimAwareAnalyzer>).analyzeClaim === 'function') {
    const providerAttempt = await (analyzer as ClaimAwareAnalyzer).analyzeClaim(
      request,
      {
        jobId: job.id,
        leaseOwner,
        leaseToken: job.lease_token,
        attemptNumber: job.attempt_count,
      },
    );
    return { untrusted: providerAttempt.result, providerAttempt };
  }
  return { untrusted: await analyzer.analyze(request) };
}
