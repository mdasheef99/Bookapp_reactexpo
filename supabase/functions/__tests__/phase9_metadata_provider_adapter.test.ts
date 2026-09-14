import { failClosedMetadataProviderOutcome } from '../_shared/imageInventory/metadata/providerAdapter';
import {
  decodeGoogleBooksResponse,
  rankGoogleBooksEditions,
  selectRepresentativeEditionCover,
} from '../_shared/imageInventory/metadata/googleBooks';
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata';
import { googleBooksMultipleVolumes } from './fixtures/phase9/googleBooksResponses';

const expected = {
  correlationId: 'lookup-1',
  attemptId: 'attempt-1',
  adapterKey: 'recorded_metadata',
  adapterVersion: '1.0.0',
};

const edition = (overrides: Record<string, unknown> = {}) => ({
  contractVersion: 'p9-contract-v1',
  schemaVersion: 'p9-metadata-v1',
  adapterKey: 'recorded_metadata',
  adapterVersion: '1.0.0',
  normalizerVersion: 'p9-bibliographic-normalizer-v1',
  correlationId: 'lookup-1',
  attemptId: 'attempt-1',
  providerRecordId: 'volume-1',
  fetchedAt: '2026-08-07T00:00:00.000Z',
  title: 'Fixture Book',
  subtitle: null,
  authors: ['Fixture Author'],
  description: null,
  isbn10: '0306406152',
  isbn13: '9780306406157',
  publisher: null,
  publishedDate: null,
  language: 'en',
  script: null,
  editionStatement: null,
  series: null,
  volume: null,
  format: null,
  pageCount: null,
  categories: [],
  coverReference: null,
  matchRationale: 'exact_validated_isbn',
  confidence: 1,
  ...overrides,
});

const coherent = (selected = edition(), overrides: Record<string, unknown> = {}) => ({
  outcome: 'coherent_match',
  candidates: [selected],
  selected,
  evidence: ['exact_validated_isbn'],
  retryable: false,
  secondaryEligible: false,
  providerRequestId: 'request-1',
  representativeCover: null,
  ...overrides,
});

const invalidOutcome = {
  outcome: 'schema_invalid',
  candidates: [],
  selected: null,
  evidence: [],
  retryable: false,
  secondaryEligible: true,
  providerRequestId: null,
  representativeCover: null,
};

describe('Phase 9 provider-neutral metadata outcome validation', () => {
  it('accepts and sanitizes one complete coherent edition', () => {
    const selected = edition();
    const result = failClosedMetadataProviderOutcome(coherent(selected), expected);
    expect(result).toEqual(coherent(selected));
    expect(result.selected).not.toBe(selected);
  });

  it.each([
    ['null', null],
    ['array', []],
    ['unknown outcome', { ...coherent(), outcome: 'invented_outcome' }],
    ['coherent without selected', { ...coherent(), candidates: [], selected: null }],
    ['incomplete selected edition', coherent({
      providerRecordId: 'volume-1', attemptId: 'attempt-1',
      title: 'Fixture Book', authors: ['Fixture Author'],
    })],
    ['invalid ISBN pair', coherent(edition({ isbn13: '9780306406158' }))],
    ['no-match with selected edition', { ...coherent(), outcome: 'no_acceptable_match' }],
    ['technical outcome marked non-retryable', {
      outcome: 'timeout', candidates: [], selected: null, evidence: [], retryable: false,
      secondaryEligible: true, providerRequestId: null,
    }],
    ['non-retryable outcome marked retryable', {
      outcome: 'malformed_response', candidates: [], selected: null, evidence: [], retryable: true,
      secondaryEligible: true, providerRequestId: null,
    }],
    ['coherent success marked retryable', { ...coherent(), retryable: true }],
    ['unknown provider field', { ...coherent(), rawProviderPayload: { secret: true } }],
    ['unknown edition field', coherent(edition({ rawVolumeInfo: { secret: true } }))],
    ['missing required provider field', (() => {
      const value = coherent();
      delete (value as { secondaryEligible?: boolean }).secondaryEligible;
      return value;
    })()],
    ['missing coherent evidence', { ...coherent(), evidence: [] }],
    ['malformed evidence entry', { ...coherent(), evidence: [{ kind: 'exact' }] }],
    ['unsafe evidence token', { ...coherent(), evidence: ['<script>'] }],
    ['wrong correlation identity', coherent(edition({ correlationId: 'lookup-other' }))],
    ['wrong attempt identity', coherent(edition({ attemptId: 'attempt-other' }))],
    ['wrong adapter identity', coherent(edition({ adapterKey: 'other_adapter' }))],
  ])('normalizes %s to non-retryable schema_invalid', (_name, value) => {
    expect(failClosedMetadataProviderOutcome(value, expected)).toEqual(invalidOutcome);
  });

  it('accepts a valid Google Books normalized result through the same contract', () => {
    const query = buildMetadataQueryIdentity({
      strategy: 'isbn',isbnClue: '9780306406157',title: 'The Fixture Book',authors: ['Fixture Author'],
      language: 'en',editionClues: [],
    });
    const editions = decodeGoogleBooksResponse(googleBooksMultipleVolumes, {
      correlationId: 'google-lookup',attemptId: 'google-attempt',
      fetchedAt: '2026-08-07T00:00:00.000Z',
    });
    const ranked = rankGoogleBooksEditions(query, editions);
    const result = failClosedMetadataProviderOutcome({
      ...ranked,candidates: editions,retryable: false,
      secondaryEligible: false,providerRequestId: 'google-request',
    }, {
      correlationId: 'google-lookup',attemptId: 'google-attempt',
      adapterKey: 'google_books',adapterVersion: '1.0.0',
      hostPolicy: {
        adapterKey: 'google_books',policyVersion: 'google-books-hosts-v1',
        approvedCoverHosts: ['books.google.com'],
      },
    });
    expect(result.outcome).toBe('coherent_match');
    expect(result.selected?.providerRecordId).toBe('volume-exact-isbn');
    expect(result.selected?.coverReference).toContain('https://books.google.com/');
  });

  it('selects one labelled representative-edition cover without stitching metadata', () => {
    const selected = edition({
      providerRecordId: 'selected-without-cover', coverReference: null,
    });
    const coverSource = edition({
      providerRecordId: 'alternate-with-cover', isbn10: null, isbn13: null,
      coverReference: 'https://books.google.com/books/content?id=alternate',
    });
    const representativeCover = selectRepresentativeEditionCover(
      selected, [selected, coverSource],
    );
    expect(representativeCover).toEqual({
      coverReference: coverSource.coverReference,
      sourceRelation: 'representative_edition',
      sourceProviderRecordId: 'alternate-with-cover',
      selectionPolicyVersion: 'p9-representative-cover-v1',
      matchEvidence: ['exact_title', 'exact_author_set', 'language_compatible'],
    });
    expect(selected.coverReference).toBeNull();

    const result = failClosedMetadataProviderOutcome(coherent(selected, {
      candidates: [selected, coverSource], representativeCover,
    }), { ...expected, hostPolicy: {
      adapterKey: 'recorded_metadata', policyVersion: 'recorded-hosts-v1',
      approvedCoverHosts: ['books.google.com'],
    } });
    expect(result.representativeCover).toEqual(representativeCover);
    expect(result.selected).toEqual(selected);
  });

  it('rejects an alternate cover when title, full author set, language, or edition clues conflict', () => {
    const selected = edition({ providerRecordId: 'selected', coverReference: null });
    const cover = 'https://books.google.com/books/content?id=unsafe-alternate';
    const conflicts = [
      edition({ providerRecordId: 'title', title: 'Another Book', coverReference: cover }),
      edition({ providerRecordId: 'authors', authors: ['Another Author'], coverReference: cover }),
      edition({ providerRecordId: 'language', language: 'fr', coverReference: cover }),
    ];
    expect(selectRepresentativeEditionCover(selected, [selected, ...conflicts])).toBeNull();
    const selectedSubtitle = edition({
      providerRecordId: 'selected-subtitle', coverReference: null, subtitle: 'Original subtitle',
    });
    expect(selectRepresentativeEditionCover(selectedSubtitle, [selectedSubtitle,
      edition({ providerRecordId: 'subtitle', subtitle: 'Conflicting subtitle', coverReference: cover }),
    ])).toBeNull();
    const selectedSeries = edition({
      providerRecordId: 'selected-series', coverReference: null, series: 'Series A', volume: '1',
    });
    expect(selectRepresentativeEditionCover(selectedSeries, [selectedSeries,
      edition({ providerRecordId: 'series', series: 'Series B', volume: '1', coverReference: cover }),
      edition({ providerRecordId: 'volume', series: 'Series A', volume: '2', coverReference: cover }),
    ])).toBeNull();
  });
});
