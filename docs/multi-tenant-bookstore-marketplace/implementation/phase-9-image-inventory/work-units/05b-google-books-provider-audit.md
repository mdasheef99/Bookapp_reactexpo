# Phase 9 Unit 5B — Google Books Provider Audit

**Inspected:** 2026-07-28
**Behavior amended:** 2026-08-30 under the Owner's title/author-primary decision
**Provider/API:** Google Books API v1
**Scope:** descriptive provider evidence for the provider-neutral Unit 5B adapter

## Official sources

- [Using the Google Books API](https://developers.google.com/books/docs/v1/using)
- [Volumes: list](https://developers.google.com/books/docs/v1/reference/volumes/list)
- [Volume resource](https://developers.google.com/books/docs/v1/reference/volumes)
- [Performance and partial responses](https://developers.google.com/books/docs/v1/performance)
- [Google Books API overview](https://developers.google.com/books/docs/overview)
- [Google Books API Terms](https://developers.google.com/books/terms)
- [Google APIs Terms, section 5](https://developers.google.com/terms)

No live Google Books request was made.

## Request contract

The public search operation is `GET
https://www.googleapis.com/books/v1/volumes?q={terms}`. Public-data requests
must identify the application with an API key or OAuth token. Unit 5B uses only
a server-side API-key seam; it does not request Google user data or OAuth scopes.

Official field operators include case-sensitive `isbn:`, `intitle:`, and
`inauthor:`. The adapter sends normalized original title and the first
normalized author whenever either is available. A checksum-valid normalized
ISBN-13 is retained as secondary ranking evidence and is used as the request
fallback only if no bibliographic term exists. The request does not send
`langRestrict`; compatible base language remains bounded ranking evidence and
cannot hard-reject a coherent title/author match. It sends no store/user identity,
image, OCR payload, private note, internal ID, or credential inside `q`.

The implementation fixes `startIndex=0`, `maxResults=10`, `orderBy=relevance`,
`printType=books`, and `projection=full`; it performs no pagination or parallel
fan-out. Google permits `maxResults` from 0 through 40. URL encoding is delegated
to the platform URL implementation.

## Response shape and bounded decoding

A successful list response contains `kind`, numeric `totalItems`, and optional
`items[]` Volume resources. Relevant Volume fields are the provider volume `id`
and `volumeInfo` title, subtitle, authors, publisher, published date,
HTML-formatted description, industry identifiers, page count, categories,
image links, language, and print type.

The API documents many fields as optional. Dates may have reduced precision.
Industry identifiers may contain ISBN-10, ISBN-13, ISSN, or OTHER. Language is
the provider's best language classification. Image links may be absent and the
documented description can contain simple HTML.

The adapter therefore:

- caps decoded items at the requested ten;
- enforces response bytes before JSON use;
- requires an object top level and bounded `items` array;
- tolerates unknown fields without persisting them;
- skips one structurally malformed volume without discarding valid siblings;
- rejects a structurally invalid top level;
- bounds strings and nested arrays;
- accepts only checksum-valid coherent ISBN pairs;
- strips description markup to bounded plain text;
- checks `extraLarge`, `large`, `medium`, `small`, `thumbnail`, and
  `smallThumbnail` in descending size order, upgrades only `books.google.com`
  links to HTTPS, rejects other hosts, and continues to a safe smaller link
  when a larger field is absent, malformed, over-bound, or unapproved;
- persists no raw response, `selfLink`, preview/buy link, access, sale, or
  provider-specific field.

## Identity and ranking limitations

Google volume IDs are stable provider identifiers, not universal edition
identity. Search results may contain multiple volumes with incomplete,
inconsistent, translated, or edition-conflicting metadata. The adapter keeps
each result whole. Acceptance first requires exact normalized original title
and author overlap. Validated ISBN-13, compatible base language, and normalized
edition clues only rank candidates that already pass that primary identity
gate. A unique highest secondary score selects one whole volume; equal best
scores are ambiguous. An ISBN that points only to a title/author-conflicting
volume is a material conflict and is never selected. There is no cross-volume
field stitching and no numeric acceptance threshold invented by Unit 5B.

## Errors, quota, and retry

The official method uses normal HTTP responses. Unit 5B maps 401/403 to
configuration/authentication failure, 429 to rate-limited, 5xx to provider
unavailable, Abort timeout/cancellation separately, and other network,
content-type, size, JSON, or structural failures to closed safe outcomes.
Provider bodies and credential-bearing URLs are never logged or returned.

Official documentation does not provide one immutable numeric Books API quota
or rate limit suitable for source control; project quotas are operational
console policy. Unit 5B therefore embeds no quota and performs no automatic
retry. Durable routing may later retry only under the approved bounded job
policy.

## Storage, caching, reuse, and launch gate

Google notes that much Books data is licensed from third parties. Google API
Terms prohibit permanent copies and caching longer than response cache headers
unless separately permitted, and impose attribution/branding obligations.
The inspected documentation does not establish a blanket BookConnect right to
retain or publicly display every returned field.

Consequently, provider provenance never implies storage or reuse permission.
The live provider registry remains the authority for `matching_allowed`,
`storage_allowed`, public display, image caching, attribution, revalidation,
and policy version. Unit 5B fails closed:

- no configured/enabled compatible registry row means zero calls;
- matching denial means zero calls;
- storage denial prevents positive cache and immutable selected snapshot;
- reuse denial prevents cache persistence/reuse;
- a coherent but non-storable result degrades to manual metadata rather than
  becoming canonical or inventory authority.

Production configuration requires separate legal/licensing/privacy review,
key configuration, provider-registry authorization, deployment, quota policy,
and live smoke authorization. Those gates are outside Unit 5B.

## Fixture provenance

`googleBooksResponses.ts` is manually constructed from the official v1 Volume
schema. It contains no credential, user/store data, or recorded production
payload. It covers a coherent ISBN edition, original-script Hindi metadata,
multiple provider volumes, a conflicting edition, a malformed sibling, missing
optional fields, unknown/ignored identifier kinds, and an empty result.
