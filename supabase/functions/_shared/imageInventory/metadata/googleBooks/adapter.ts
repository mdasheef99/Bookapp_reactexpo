import { MetadataEdition } from '../../contracts/metadata';
import { MetadataQueryIdentity } from '../queryIdentity';
import { buildGoogleBooksRequest } from './request';
import { decodeGoogleBooksResponse } from './decoder';
import { rankGoogleBooksEditions } from './ranking';

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type Configuration = Readonly<{
  mode: 'fixture' | 'real';
  apiKey: string | null;
  fetcher: Fetcher;
  timeoutMs: number;
  maxResponseBytes: number;
}>;
type Lookup = Readonly<{
  query: MetadataQueryIdentity;
  correlationId: string;
  attemptId: string;
  signal: AbortSignal;
}>;
export type GoogleBooksOutcome = Readonly<{
  outcome: 'coherent_match' | 'ambiguous_match' | 'material_conflict'
    | 'no_acceptable_match' | 'authentication_configuration_failure'
    | 'timeout' | 'cancelled' | 'network_failure' | 'rate_limited'
    | 'provider_unavailable' | 'malformed_response' | 'response_too_large'
    | 'unsupported_content_type';
  candidates: readonly MetadataEdition[];
  selected: MetadataEdition | null;
  evidence: readonly string[];
  retryable: boolean;
  providerRequestId: string | null;
}>;

const outcome = (
  value: GoogleBooksOutcome['outcome'],
  retryable = false,
): GoogleBooksOutcome => ({
  outcome: value,
  candidates: [],
  selected: null,
  evidence: [],
  retryable,
  providerRequestId: null,
});

export class GoogleBooksAdapter {
  constructor(private readonly configuration: Configuration) {}

  async lookup(input: Lookup): Promise<GoogleBooksOutcome> {
    if (this.configuration.mode !== 'real' || !this.configuration.apiKey) {
      return outcome('authentication_configuration_failure');
    }
    let request;
    try {
      request = buildGoogleBooksRequest(input.query, this.configuration.apiKey);
    } catch {
      return outcome('authentication_configuration_failure');
    }
    const controller = new AbortController();
    const onAbort = () => controller.abort(input.signal.reason);
    input.signal.addEventListener('abort', onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort('timeout'), this.configuration.timeoutMs);
    try {
      const response = await this.configuration.fetcher(request.url, {
        method: 'GET',
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      const requestId = response.headers.get('x-request-id');
      if (response.status === 429) return { ...outcome('rate_limited', true), providerRequestId: requestId };
      if (response.status === 401 || response.status === 403) {
        return { ...outcome('authentication_configuration_failure'), providerRequestId: requestId };
      }
      if (response.status >= 500) return { ...outcome('provider_unavailable', true), providerRequestId: requestId };
      if (!response.ok) return { ...outcome('malformed_response'), providerRequestId: requestId };
      const contentType = response.headers.get('content-type')?.split(';')[0].trim();
      if (contentType !== 'application/json') return outcome('unsupported_content_type');
      const declared = Number(response.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > this.configuration.maxResponseBytes) {
        return outcome('response_too_large');
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > this.configuration.maxResponseBytes) return outcome('response_too_large');
      let decoded: unknown;
      try {
        decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      } catch {
        return outcome('malformed_response');
      }
      let candidates: MetadataEdition[];
      try {
        candidates = decodeGoogleBooksResponse(decoded, {
          correlationId: input.correlationId,
          attemptId: input.attemptId,
          fetchedAt: new Date().toISOString(),
        });
      } catch {
        return outcome('malformed_response');
      }
      const ranking = rankGoogleBooksEditions(input.query, candidates);
      return {
        ...ranking,
        candidates,
        retryable: false,
        providerRequestId: requestId,
      };
    } catch (error) {
      if (controller.signal.aborted) {
        return outcome(input.signal.aborted ? 'cancelled' : 'timeout', !input.signal.aborted);
      }
      return outcome('network_failure', true);
    } finally {
      clearTimeout(timeout);
      input.signal.removeEventListener('abort', onAbort);
    }
  }
}
