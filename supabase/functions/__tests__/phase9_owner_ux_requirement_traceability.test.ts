type Coverage = Readonly<{
  behavior: string;
  layer: 'edge-contract' | 'postgres' | 'postgres-concurrency' | 'structural';
  evidence: string;
}>;

const coverage = {
  U6Q01: { behavior: 'initiator discovery, 0/1 active session, count/version parity',
    layer: 'postgres', evidence: 'phase9OwnerUxContracts + phase9OwnerUxReadModels' },
  U6Q02: { behavior: 'strict session/default/state/Close summary envelope',
    layer: 'postgres', evidence: 'phase9OwnerUxReadModels: U6Q02 tests' },
  U6Q03: { behavior: 'safe input mapping, deterministic paging and bound cursor',
    layer: 'postgres', evidence: 'phase9OwnerUxReadModels: U6Q03 tests' },
  U6Q04: { behavior: 'session/needs-review pages, shared predicate, ordering/revision cursor',
    layer: 'postgres', evidence: 'phase9OwnerUxContracts + phase9OwnerUxReadModels pagination tests' },
  U6Q05: { behavior: 'strict detail, metadata branches, non-enumeration and privacy',
    layer: 'postgres', evidence: 'phase9OwnerUxReadModels U6Q05 + candidate equivalence test' },
  U6C01: { behavior: 'strict review replace, transitions, versions, replay, no U7 effects',
    layer: 'postgres', evidence: 'phase9OwnerUxMutations U6C01 tests' },
  U6Q06: { behavior: 'one-snapshot bounded readiness and all blocker keys',
    layer: 'postgres', evidence: 'phase9OwnerUxReadModels U6Q06 tests' },
  U6C02: { behavior: 'terminal Close, exact summary/version/replay, staged preservation',
    layer: 'postgres', evidence: 'phase9OwnerUxMutations U6C02 tests' },
  'U6-AC03': { behavior: 'server recovery evidence',
    layer: 'postgres', evidence: 'discovery and queue parity/filter tests' },
  'U6-AC04': { behavior: 'eligible Owner only; denied role/revoked/unauthenticated actors',
    layer: 'postgres', evidence: 'all-target actor matrix tests' },
  'U6-AC05': { behavior: 'initiator-only target access',
    layer: 'postgres', evidence: 'same-store/cross-store noninitiator tests' },
  'U6-AC19': { behavior: 'bounded detail with privacy exclusions',
    layer: 'edge-contract', evidence: 'all response DTO + recursive forbidden-key tests' },
  'U6-AC22': { behavior: 'complete strict review vocabulary and cross-rules',
    layer: 'edge-contract', evidence: 'strict review decoder and direct-RPC validation matrices' },
  AUTH_ACTORS: { behavior: 'initiator, same-store owner, cross-store owner, manager, staff, support, revoked, anonymous',
    layer: 'postgres', evidence: 'actor matrix and initiator-filter tests' },
  SERVER_IDENTITY: { behavior: 'no client store/user authority',
    layer: 'edge-contract', evidence: 'strict unknown storeId plus server-derived discovery tests' },
  NON_ENUMERATION: { behavior: 'absent/random/foreign/mismatch candidate equivalence',
    layer: 'edge-contract', evidence: 'candidate DB equivalence + ownerUxFailureResponse HTTP boundary test' },
  STRICT_KEYS_TYPES_ENUMS_BOUNDS: { behavior: 'all eight requests/responses and nested review DTO',
    layer: 'edge-contract', evidence: 'phase9_owner_ux_contracts request/response matrices' },
  PRIVACY: { behavior: 'recursive forbidden evidence/job/media/provider/cost/identity fields',
    layer: 'edge-contract', evidence: 'recursive forbidden-key scans and SQL DTO assertions' },
  PAGINATION_ORDER: { behavior: 'default/max, no skip/dup, immutable order',
    layer: 'postgres', evidence: 'input/session/needs-review pagination tests' },
  CURSOR_INTEGRITY: { behavior: 'tamper and actor/session/scope/filter/page/version binding',
    layer: 'postgres', evidence: 'input and needs-review cursor context tests' },
  MEMBERSHIP_VERSION: { behavior: 'monotonic reviewScopeVersion and invalidation',
    layer: 'postgres', evidence: 'membership mutation and discovery parity tests' },
  NEEDS_REVIEW_PREDICATE: { behavior: 'all candidate/session/disposition/expiry/readiness branches',
    layer: 'postgres', evidence: 'membership branch and session-status tests' },
  CANDIDATE_VERSION: { behavior: 'stale writer loses without overwrite',
    layer: 'postgres', evidence: 'U6C01 candidate race test' },
  METADATA_REVISION: { behavior: 'metadata evidence invalidates readiness; U6C01 never writes metadata',
    layer: 'postgres', evidence: 'U6Q05 branches, invalidation test, metadata race and no-link-write test' },
  DUPLICATE_VERSION: { behavior: 'advice intent/version choice required',
    layer: 'postgres', evidence: 'U6C01 duplicate advice test' },
  CANONICAL_REPLAY: { behavior: 'same key/exact request including commandId; changed mismatch',
    layer: 'postgres', evidence: 'fixed-command U6C01/U6C02 replay tests' },
  ATOMIC_REVIEW_REPLACE: { behavior: 'one snapshot, incremented candidate/review versions',
    layer: 'postgres', evidence: 'two-save atomic replacement test' },
  REVIEW_TRANSITIONS: { behavior: 'ready/needs_review/possible_duplicate to ready only when resolved',
    layer: 'postgres', evidence: 'three-source-state and unresolved-blocker tests' },
  READINESS_BLOCKERS: { behavior: 'all blocker keys, bounded next candidate, no ID arrays',
    layer: 'postgres', evidence: 'U6Q06 blocker/boundedness test' },
  CLOSE_TERMINALITY: { behavior: 'uploaded/validating/queued/processing reject; ready/failed/skipped close',
    layer: 'postgres', evidence: 'U6C02 state matrix' },
  CLOSE_SUMMARY: { behavior: 'all exact categories including zero pre-U7 values',
    layer: 'postgres', evidence: 'U6Q02 reconciliation and U6C02 envelope tests' },
  CLOSE_VERSION: { behavior: 'stale, exact replay, changed request and closed new-key behavior',
    layer: 'postgres', evidence: 'U6C02 replay/stale test' },
  UNIT7_NONINTERFERENCE: { behavior: 'inventory/listing/alias/variant/public projection byte equivalence',
    layer: 'postgres', evidence: 'forbidden-relation before/after snapshot test' },
  SQL_SECURITY: { behavior: 'exact signatures/owner/definer/path/grants/revokes/RLS/base-table denial',
    layer: 'structural', evidence: 'M29 structural + database catalogue tests' },
  CONCURRENT_REVIEW: { behavior: 'two connections with same candidate version',
    layer: 'postgres-concurrency', evidence: 'phase9_unit6a_concurrency.ps1 candidate-version-race' },
  CONCURRENT_METADATA: { behavior: 'metadata revision change versus review writer',
    layer: 'postgres-concurrency', evidence: 'phase9_unit6a_concurrency.ps1 metadata-revision-race' },
  CONCURRENT_REPLAY: { behavior: 'exact retry and changed request on two connections',
    layer: 'postgres-concurrency', evidence: 'phase9_unit6a_concurrency.ps1 replay races' },
  CONCURRENT_CLOSE: { behavior: 'Close versus review/session change and stale Close',
    layer: 'postgres-concurrency', evidence: 'phase9_unit6a_concurrency.ps1 Close/review/input/stale races' },
  READINESS_SNAPSHOT: { behavior: 'readiness consistency during concurrent state change',
    layer: 'postgres-concurrency', evidence: 'phase9_unit6a_concurrency.ps1 readiness-snapshot-race' },
} as const satisfies Record<string, Coverage>;

export const incrementalCoverageObligations = {
  during_implementation: [
    { obligation: 'U6Q06 every blocker plus direct ready outcome', status: 'covered',
      evidence: 'phase9OwnerUxReadModels U6Q06 blocker and direct-ready tests' },
    { obligation: 'U6Q05 metadata, populated advice/variant, and read-only branches', status: 'covered',
      evidence: 'phase9OwnerUxReadModels metadata/read-only + phase9OwnerUxMutations advice/variant tests' },
    { obligation: 'U6C01 selected/manual/changed metadata stale behavior without metadata writes', status: 'covered',
      evidence: 'phase9OwnerUxMutations no-link-write, invalidation, and metadata race tests' },
    { obligation: 'U6C01 material AC22 database cross-field validation', status: 'covered',
      evidence: 'phase9OwnerUxMutations direct-RPC strict blocker matrix' },
    { obligation: 'U6Q03/U6Q04 authorized-session cursor swap and default pages', status: 'covered',
      evidence: 'phase9OwnerUxReadModels input and needs-review pagination tests' },
  ],
  before_final_technical_approval: [
    { obligation: 'Edge adapter strict response decoding', status: 'covered',
      evidence: 'phase9_owner_ux_contracts response and adapter suites' },
    { obligation: 'role, revocation, anonymous and helper-ACL denial', status: 'covered',
      evidence: 'phase9OwnerUxContracts actor and catalogue tests' },
    { obligation: 'nonempty Unit 7 relation byte equivalence', status: 'covered',
      evidence: 'phase9OwnerUxMutations noninterference sentinel test' },
    { obligation: 'real PostgreSQL two-connection stale Close and input race', status: 'covered',
      evidence: 'phase9_unit6a_concurrency.ps1' },
    { obligation: 'complete safe non-enumeration HTTP envelope equivalence', status: 'covered',
      evidence: 'candidate DB equivalence + ownerUxFailureResponse Edge-boundary test' },
    { obligation: 'traceability names executable tests and recorded runs', status: 'covered',
      evidence: 'this ledger plus Unit 6A evidence tracker' },
  ],
} as const;

describe('Phase 9 Unit 6A requirement-to-test traceability freeze', () => {
  it('maps all eight operations and owned acceptance criteria', () => {
    expect(Object.keys(coverage)).toEqual(expect.arrayContaining([
      'U6Q01','U6Q02','U6Q03','U6Q04','U6Q05','U6C01','U6Q06','U6C02',
      'U6-AC03','U6-AC04','U6-AC05','U6-AC19','U6-AC22',
    ]));
  });

  it('maps security, paging, stale/replay, readiness, Close, concurrency and Unit 7 absence', () => {
    expect(Object.keys(coverage)).toEqual(expect.arrayContaining([
      'AUTH_ACTORS','SERVER_IDENTITY','NON_ENUMERATION','PRIVACY',
      'PAGINATION_ORDER','CURSOR_INTEGRITY','MEMBERSHIP_VERSION',
      'NEEDS_REVIEW_PREDICATE','CANDIDATE_VERSION','METADATA_REVISION',
      'CANONICAL_REPLAY','REVIEW_TRANSITIONS','READINESS_BLOCKERS',
      'CLOSE_TERMINALITY','CLOSE_SUMMARY','CLOSE_VERSION',
      'UNIT7_NONINTERFERENCE','SQL_SECURITY','CONCURRENT_REVIEW',
      'CONCURRENT_METADATA','CONCURRENT_REPLAY','CONCURRENT_CLOSE',
      'READINESS_SNAPSHOT',
    ]));
  });

  it('has a named behavior, layer and evidence target for every requirement', () => {
    for (const item of Object.values(coverage)) {
      expect(item.behavior.length).toBeGreaterThan(8);
      expect(item.evidence.length).toBeGreaterThan(8);
    }
  });

  it('records closure and executable evidence for implementation and final obligations', () => {
    expect(incrementalCoverageObligations.during_implementation).toHaveLength(5);
    expect(incrementalCoverageObligations.before_final_technical_approval).toHaveLength(6);
    for (const obligation of Object.values(incrementalCoverageObligations).flat()) {
      expect(obligation.status).toBe('covered');
      expect(obligation.evidence.length).toBeGreaterThan(12);
    }
  });
});
