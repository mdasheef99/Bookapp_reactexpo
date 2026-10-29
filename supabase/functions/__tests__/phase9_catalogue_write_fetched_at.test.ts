// Round C / 02b sections 3.1/3.2/9: exact pre-dispatch companion timestamp binding.
import { CATALOGUE_WRITE_VERSION, parseCatalogueCompanions,
  type CatalogueCompanionScope } from '../_shared/imageInventory/contracts/catalogueWrite';
import { runMetadataWorkerBatch } from '../../../workers/phase9-metadata-worker';
import { createMetadataEditionOptionsBoundary } from '../_shared/imageInventory/runtime/metadataEditionOptionsRpc';
import { editionWorkerFixture } from './fixtures/phase9/editionOptionsWorker';

const base = '2026-10-28T00:00:00.123456Z';
const optionId = '10000000-0000-4000-8000-000000000001';
const lookupId = '10000000-0000-4000-8000-000000000002';
const attemptId = '10000000-0000-4000-8000-000000000003';
function check(companionAt: string, metadataAt = base, sourceFetchedAt = metadataAt) {
  const binding = { adapterKey: 'open_library', adapterVersion: '1.0.0', normalizerVersion: 'v1',
    providerRecordId: 'OL123M', attemptId };
  const companion = { ...binding, version: CATALOGUE_WRITE_VERSION, optionId, lookupId, fetchedAt: companionAt };
  // Other stored-row validation happens upstream; this exercises the real sibling binding boundary.
  const scope = { lookupId, attemptId, sourceFetchedAt, rows: [{ optionId, eligibility: 'eligible',
    metadata: { ...binding, correlationId: lookupId, fetchedAt: metadataAt } }] } as CatalogueCompanionScope;
  return parseCatalogueCompanions([companion], scope);
}

describe('catalogue write fetchedAt instant equality', () => {
  it.each([
    ['companion vs metadata', '2026-10-28T00:00:00.123999Z', base, base],
    ['companion vs source', base, base, '2026-10-28T00:00:00.123457Z'],
    ['last microsecond', '2026-10-28T00:00:00.123455Z', base, base],
  ])('rejects %s differences hidden by Date.parse milliseconds', (_, companionAt, metadataAt, sourceAt) => {
    expect(() => check(companionAt, metadataAt, sourceAt)).toThrow('P9_CATALOGUE_COMPANIONS_INVALID');
  });

  it.each([
    [base, base],
    ['2026-10-28T05:30:00.123456+05:30', base],
    ['2026-10-27T20:00:00.123456-04:00', base],
    ['2027-01-01T00:30:00.000001+01:00', '2026-12-31T23:30:00.000001Z'],
    ['1969-12-31T23:59:59.999999Z', '1970-01-01T00:59:59.999999+01:00'],
    ['2026-10-28T00:00:00.1Z', '2026-10-28T00:00:00.100000Z'],
    ['2026-10-28T00:00:00Z', '2026-10-28T00:00:00.000000Z'],
  ])('accepts equal instants %s and %s', (companionAt, metadataAt) => {
    expect(check(companionAt, metadataAt, metadataAt)).toHaveLength(1);
    expect(check(companionAt, companionAt, metadataAt)).toHaveLength(1);
  });

  it.each(['2026-10-28T00:00:00.1234567Z', 'invalid', '2026-02-30T00:00:00Z'])
  ('refuses unsupported or invalid source timestamp %s before dispatch', sourceAt => {
    expect(() => check(base, base, sourceAt)).toThrow('P9_CATALOGUE_COMPANIONS_INVALID');
  });
});

// Round D / 02b sections 3.1/7.1/10, AC7-11/17: no companion must not bypass row validation.
describe('legacy adapter fetchedAt binding before v2 dispatch', () => {
  beforeAll(() => {
    if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', {
      configurable: true, value: require('node:crypto').webcrypto,
    });
  });

  it.each([
    ['omitted envelope', undefined, '123456', false],
    ['null envelope', null, '123456', false],
    ['empty envelope', [], '123456', false],
    ['finer than microseconds', undefined, '1234567', false],
    ['equal instant with offset', undefined, '123999', true],
    ['equal instant with offset and null envelope', null, '123999', true],
  ])('validates %s', async (_, envelope, fraction, accepted) => {
    const f = editionWorkerFixture();
    const lookup = f.adapter.lookupEditionOptions.bind(f.adapter);
    f.adapter.lookupEditionOptions = async input => {
      const result = await lookup(input);
      const second = new Date().toISOString().slice(0, 19);
      const sourceAt = `${second}.123999Z`;
      const metadataAt = accepted
        ? `${new Date(Date.parse(`${second}Z`) + 19800000).toISOString().slice(0, 19)}.${fraction}+05:30`
        : `${second}.${fraction}Z`;
      return { ...result, fetchedAt: sourceAt, catalogueCompanions: envelope,
        rows: result.rows.map(row => row.metadata === null ? row : {
          ...row, metadata: { ...row.metadata, fetchedAt: metadataAt },
        }) };
    };
    const calls: Array<{ name: string; parameters: Record<string, any> }> = [];
    const rpc = async (name: string, parameters: Record<string, any>) => {
      calls.push({ name, parameters });
      if (name === 'phase9_recover_candidate_edition_options_v1') {
        return { data: { status: 'missing' }, error: null };
      }
      if (name === 'phase9_fail_candidate_edition_options_v1') return { data: { status: 'dead_letter' }, error: null };
      if (/^phase9_complete_candidate_edition_options_v[12]$/.test(name)) {
        return { data: { status: 'completed', requestId: parameters.p_request_id,
          requestGeneration: parameters.p_request_generation, optionsVersion: 1,
          optionsExpiresAt: parameters.p_options_expires_at }, error: null };
      }
      return f.dependencies.serviceClient.rpc(name, parameters);
    };
    const result = await runMetadataWorkerBatch(1, { ...f.dependencies, serviceClient: { rpc },
      editionOptionsBoundary: createMetadataEditionOptionsBoundary({ rpc }) });
    const completions = calls.filter(call => /^phase9_complete_candidate_edition_options_v[12]$/.test(call.name));
    const failures = calls.filter(call => call.name === 'phase9_fail_candidate_edition_options_v1');
    expect(f.stats().providerRequests).toBe(1);
    expect(result.results).toEqual([{ outcome: accepted ? 'edition_options_available' : 'manual_metadata_required' }]);
    if (accepted) {
      expect(completions.map(call => call.name)).toEqual(['phase9_complete_candidate_edition_options_v2']);
      expect(completions[0].parameters.p_catalogue_companions).toEqual([]);
      expect(failures).toEqual([]);
    } else {
      expect(completions).toEqual([]);
      expect(failures).toHaveLength(1);
      expect(failures[0].parameters).toMatchObject({ p_failure_kind: 'schema_invalid', p_retryable: false });
    }
  });
});

// 02b section 3.1: SQL rounds sub-microsecond values; dispatch deliberately refuses them.
const timestampCases: Array<{label:string;source:string;companion:string;ts:boolean;sql:boolean}> =
  require('../../tests/phase9/catalogueTimestampCases.json');
it.each(timestampCases)('fetchedAt TS/SQL corpus: $label', c => {
  if (c.ts) expect(check(c.companion,c.source,c.source)).toHaveLength(1);
  else expect(() => check(c.companion,c.source,c.source)).toThrow('P9_CATALOGUE_COMPANIONS_INVALID');
});
