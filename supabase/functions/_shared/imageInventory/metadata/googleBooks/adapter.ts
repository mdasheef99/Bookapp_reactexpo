import { MetadataEdition } from '../../contracts/metadata';
import type { OptionsRetentionEvidence } from '../../contracts/ownerEditionPicker';
import type { EditionOptionsProviderResult } from '../contracts';
import { MetadataQueryIdentity } from '../queryIdentity';
import { MetadataProviderAdapter, MetadataProviderOutcome } from '../providerAdapter';
import { buildGoogleBooksRequest } from './request';
import { decodeGoogleBooksResponse, googleBooksSeriesRecordIds, GOOGLE_BOOKS_EDITION_HOST_POLICY } from './decoder';
import { normalizeGoogleEditionRows, boundOptionsRetentionEvidence } from './editionOptions';
import { rankGoogleBooksEditions } from './ranking';
import { selectRepresentativeEditionCover } from '../representativeCover';

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type Configuration = Readonly<{
  mode: 'fixture' | 'real'; apiKey: string | null; fetcher: Fetcher;
  timeoutMs: number; maxResponseBytes: number;
  // Server-only verified provider rights, independent of registry/client flags.
  // Production bootstrap supplies no verifier until the live permission gate (§13.2).
  verifyOptionsRetention?: (evidence: Readonly<{
    fetchedAt: string; cacheControl: string | null; expires: string | null;
    responseDate: string | null; age: string | null;
  }>) => OptionsRetentionEvidence | null;
}>;
type Lookup = Readonly<{
  query: MetadataQueryIdentity; correlationId: string; attemptId: string; signal: AbortSignal;
}>;
type ResponseEnvelope = Readonly<{
  raw: unknown; fetchedAt: string; headers: Headers; providerRequestId: string | null;
}>;
export type GoogleBooksOutcome = MetadataProviderOutcome;

const secondaryEligible = new Set<MetadataProviderOutcome['outcome']>([
  'no_acceptable_match', 'ambiguous_match', 'material_conflict',
  'provider_unavailable', 'timeout', 'network_failure', 'rate_limited',
  'circuit_breaker_open', 'malformed_response', 'schema_invalid',
  'response_too_large', 'unsupported_content_type',
]);
const outcome = (value: GoogleBooksOutcome['outcome'], retryable = false): GoogleBooksOutcome => ({
  outcome: value, candidates: [], selected: null, evidence: [], retryable,
  secondaryEligible: secondaryEligible.has(value), providerRequestId: null, representativeCover: null,
});
const safeRequestId = (value: string | null): string | null =>
  value !== null && /^[A-Za-z0-9._:-]{1,128}$/u.test(value) ? value : null;

export class GoogleBooksAdapter implements MetadataProviderAdapter {
  readonly normalizedEditionHostPolicy = GOOGLE_BOOKS_EDITION_HOST_POLICY;
  constructor(private readonly configuration: Configuration) {}

  async lookup(input: Lookup): Promise<GoogleBooksOutcome> {
    const response = await this.request(input);
    if (!('raw' in response)) return response;
    let candidates: MetadataEdition[];
    try {
      candidates = decodeGoogleBooksResponse(response.raw, {
        correlationId: input.correlationId, attemptId: input.attemptId, fetchedAt: response.fetchedAt,
      });
    } catch { return outcome('malformed_response'); }
    const ranking = rankGoogleBooksEditions(input.query, candidates);
    const seriesRecordIds = googleBooksSeriesRecordIds(response.raw);
    const representativeCover = ranking.selected === null ? null
      : selectRepresentativeEditionCover(ranking.selected, candidates);
    return { ...ranking, candidates,
      representativeCover: representativeCover !== null
        && !seriesRecordIds.has(ranking.selected?.providerRecordId ?? '')
        && !seriesRecordIds.has(representativeCover.sourceProviderRecordId) ? representativeCover : null,
      retryable: false, secondaryEligible: secondaryEligible.has(ranking.outcome), providerRequestId: response.providerRequestId,
    };
  }

  // Explicit options decode the original response, before automatic filtering (§§4.1/13.2).
  async lookupEditionOptions(input: Parameters<GoogleBooksAdapter['lookup']>[0]): Promise<EditionOptionsProviderResult> {
    const response = await this.request(input);
    if (!('raw' in response)) return {
      outcome: response.outcome, retryable: response.retryable, providerRequestId: safeRequestId(response.providerRequestId),
      rows: [], fetchedAt: null, retentionEvidence: null,
    };
    let rows;
    try {
      rows = normalizeGoogleEditionRows(response.raw, {
        correlationId: input.correlationId, attemptId: input.attemptId,
        fetchedAt: response.fetchedAt, createOptionId: () => globalThis.crypto.randomUUID(),
      }, input.query);
    } catch {
      return { outcome: 'malformed_response', retryable: false, providerRequestId: safeRequestId(response.providerRequestId),
        rows: [], fetchedAt: null, retentionEvidence: null };
    }
    let evidence: OptionsRetentionEvidence | null = null;
    try {
      evidence = this.configuration.verifyOptionsRetention?.({
        fetchedAt: response.fetchedAt, cacheControl: response.headers.get('cache-control'),
        expires: response.headers.get('expires'), responseDate: response.headers.get('date'), age: response.headers.get('age'),
      }) ?? null;
    } catch { /* Unknown verification denies retention, without discarding safely decoded rows. */ }
    const eligible = rows.filter(row => row.eligibility === 'eligible');
    const strong = eligible.some(row => row.metadata?.matchRationale === 'exact_validated_isbn');
    const conflict = rows.some(row => row.eligibility === 'ineligible' && input.query.normalizedIsbn13 !== null
      && row.metadata?.isbn13 === input.query.normalizedIsbn13);
    return {
      outcome: strong ? 'coherent_match' : eligible.length > 0 ? 'ambiguous_match' : conflict ? 'material_conflict' : 'no_acceptable_match',
      rows, fetchedAt: response.fetchedAt, retentionEvidence: boundOptionsRetentionEvidence(response.fetchedAt, evidence, response.headers),
      retryable: false, providerRequestId: safeRequestId(response.providerRequestId),
    };
  }

  // Shared request/configuration/limits/timeout/cancellation preserve the automatic path.
  private async request(input: Lookup): Promise<ResponseEnvelope | GoogleBooksOutcome> {
    if (this.configuration.mode !== 'real' || !this.configuration.apiKey) return outcome('authentication_configuration_failure');
    if (input.signal.aborted) return outcome('cancelled');
    let request;
    try { request = buildGoogleBooksRequest(input.query, this.configuration.apiKey); }
    catch { return outcome('authentication_configuration_failure'); }
    const controller = new AbortController();
    const onAbort = () => controller.abort(input.signal.reason);
    input.signal.addEventListener('abort', onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort('timeout'), this.configuration.timeoutMs);
    try {
      const response = await this.configuration.fetcher(request.url, {
        method: 'GET', signal: controller.signal, headers: { accept: 'application/json' },
      });
      const fetchedAt = new Date().toISOString();
      const requestId = response.headers.get('x-request-id');
      if (response.status === 429) return { ...outcome('rate_limited', true), providerRequestId: requestId };
      if (response.status === 401 || response.status === 403) return { ...outcome('authentication_configuration_failure'), providerRequestId: requestId };
      if (response.status >= 500) return { ...outcome('provider_unavailable', true), providerRequestId: requestId };
      if (!response.ok) return { ...outcome('malformed_response'), providerRequestId: requestId };
      const contentType = response.headers.get('content-type')?.split(';')[0].trim();
      if (contentType !== 'application/json') return outcome('unsupported_content_type');
      const declared = Number(response.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > this.configuration.maxResponseBytes) return outcome('response_too_large');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > this.configuration.maxResponseBytes) return outcome('response_too_large');
      let raw: unknown;
      try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
      catch { return outcome('malformed_response'); }
      return { raw, fetchedAt, headers: response.headers, providerRequestId: requestId };
    } catch {
      if (controller.signal.aborted) return outcome(input.signal.aborted ? 'cancelled' : 'timeout', !input.signal.aborted);
      return outcome('network_failure', true);
    } finally {
      clearTimeout(timeout);
      input.signal.removeEventListener('abort', onAbort);
    }
  }
}
