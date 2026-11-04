import { GoogleBooksAdapter } from '../_shared/imageInventory/metadata/googleBooks/adapter';
import { createGoogleBooksDescriptor } from '../_shared/imageInventory/metadata/googleBooks/descriptor';
import type { AutomaticHttpObservation } from '../_shared/imageInventory/metadata/providerDescriptor';
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata';
import { googleBooksMultipleVolumes } from './fixtures/phase9/googleBooksResponses';
import { GOLDEN_CLOCK, GOLDEN_LOOKUP_ID, GOLDEN_ATTEMPT_ID, GOOGLE_AUTOMATIC_V1 } from './support/automaticB1';

const query = buildMetadataQueryIdentity({ strategy: 'isbn', isbnClue: '9780306406157',
  title: 'The Fixture Book', authors: ['Fixture Author'], language: 'en', editionClues: [] });
const base = { query, correlationId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
  signal: new AbortController().signal };
const adapter = (fetcher: typeof fetch) => new GoogleBooksAdapter({ mode: 'real', apiKey: 'fixture-only-no-network',
  timeoutMs: 1000, maxResponseBytes: 64000, fetcher });
const http = { get: jest.fn(async () => { throw new Error('Google must keep its single transport'); }) };
describe('U5 B1 Google invocation-scoped observation (02c §5.1)', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(Date.parse(GOLDEN_CLOCK)); });
  afterEach(() => jest.useRealTimers());
  // Mutation caught: losing raw Retry-After in the normalized 429 outcome or changing golden return bytes.
  it('observes raw 429 before normalization and preserves the healthy automatic golden', async () => {
    const observations: AutomaticHttpObservation[] = [];
    const descriptor = createGoogleBooksDescriptor({ adapter: adapter(async () => new Response('', {
      status: 429, headers: { 'retry-after': '120' } })) });
    const result = await descriptor.invoke({ ...base, purpose: 'automatic', http,
      observeAutomaticHttp: event => observations.push(event) });
    expect(result.outcome.outcome).toBe('rate_limited');
    expect(observations).toEqual([{ kind: 'send_started', at: Date.parse(GOLDEN_CLOCK) },
      { kind: 'response_received', at: Date.parse(GOLDEN_CLOCK), status: 429, retryAfter: '120' }]);
    expect(JSON.stringify(observations)).not.toContain('fixture-only-no-network');
    const healthy = createGoogleBooksDescriptor({ adapter: adapter(async () => new Response(JSON.stringify(googleBooksMultipleVolumes), {
      headers: { 'content-type': 'application/json', 'x-request-id': 'golden-google-automatic-request' } })) });
    expect((await healthy.invoke({ ...base, purpose: 'automatic', http })).outcome).toEqual(GOOGLE_AUTOMATIC_V1);
    expect(http.get).not.toHaveBeenCalled();
  });
  // Mutation caught: an adapter-wide mutable observer crossing concurrent claims or firing for explicit requests.
  it('isolates concurrent observers and never forwards one through the explicit descriptor branch', async () => {
    const live = adapter(async () => new Response('', { status: 429, headers: { 'retry-after': '120' } }));
    const descriptor = createGoogleBooksDescriptor({ adapter: live });
    const left: AutomaticHttpObservation[] = [], right: AutomaticHttpObservation[] = [];
    await Promise.all([descriptor.invoke({ ...base, purpose: 'automatic', http, observeAutomaticHttp: event => left.push(event) }),
      descriptor.invoke({ ...base, purpose: 'automatic', http, observeAutomaticHttp: event => right.push(event) })]);
    expect(left).toHaveLength(2); expect(right).toEqual(left);
    const explicit = jest.fn();
    await descriptor.invoke({ ...base, purpose: 'edition_options', http, observeAutomaticHttp: explicit });
    await live.lookupEditionOptions({ ...base, observeAutomaticHttp: explicit });
    expect(explicit).not.toHaveBeenCalled(); expect(left).toHaveLength(2); expect(right).toHaveLength(2);
  });
  // Mutation caught: confusing a response-less send with a received HTTP failure, or minting a send on preflight denial.
  it('reports actual send without a fabricated response and makes no observation when already cancelled', async () => {
    const events: AutomaticHttpObservation[] = [];
    const live = adapter(async () => { throw new Error('connection reset'); });
    expect((await live.lookup({ ...base, observeAutomaticHttp: event => events.push(event) })).outcome).toBe('network_failure');
    expect(events).toEqual([{ kind: 'send_started', at: Date.parse(GOLDEN_CLOCK) }]);
    const controller = new AbortController(); controller.abort(); const cancelled = jest.fn();
    expect((await live.lookup({ ...base, signal: controller.signal, observeAutomaticHttp: cancelled })).outcome).toBe('cancelled');
    expect(cancelled).not.toHaveBeenCalled();
  });
  // Mutation caught: an observation callback exception relabels a received HTTP response as an unknown network failure.
  it('keeps observation failures from changing the provider outcome or preventing the actual request', async () => {
    const fetcher = jest.fn(async () => new Response('', { status: 429, headers: { 'retry-after': '120' } }));
    const live = adapter(fetcher);
    const observer = jest.fn(() => { throw new Error('observer failed'); });
    expect((await live.lookup({ ...base, observeAutomaticHttp: observer })).outcome).toBe('rate_limited');
    expect(fetcher).toHaveBeenCalledTimes(1); expect(observer).toHaveBeenCalledTimes(2);
    expect((await live.lookup(base)).outcome).toBe('rate_limited'); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  // Mutation caught: interpreting or replacing raw Retry-After observations before the execution layer validates them.
  it.each(['Mon, 02 Nov 2026 12:01:00 GMT', 'not-a-date', null])('preserves raw Retry-After %p', async header => {
    const headers = new Headers();
    header !== null && headers.set('retry-after', header);
    const events: AutomaticHttpObservation[] = [];
    const live = adapter(async () => new Response('', { status: 429, headers }));
    expect((await live.lookup({ ...base, observeAutomaticHttp: event => events.push(event) })).outcome).toBe('rate_limited');
    expect(events[1]).toEqual({ kind: 'response_received', at: Date.parse(GOLDEN_CLOCK), status: 429, retryAfter: header });
    expect((await live.lookup(base)).outcome).toBe('rate_limited');
  });
});
