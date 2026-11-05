// Unit B: PHASE9_PROVIDER_CONTACTS startup validation (T5). NEW file; no
// existing test touched. Fake values only; never a real email.
import { loadMetadataWorkerEnvironment } from '../../../workers/phase9-runtime/environment';

const base = {
  SUPABASE_URL: 'https://ahntbtktjjmvfosgkmgn.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret-that-is-long-enough-0001',
  PHASE9_WORKER_HOST: '0.0.0.0',
  PHASE9_WORKER_PORT: '8080',
  PHASE9_WORKER_CONCURRENCY: '1',
  PHASE9_METADATA_WORKER_ID: 'metadata-worker-0000001',
  PHASE9_METADATA_WORKER_INGRESS_TOKEN: 'metadata-ingress-secret-A7z.49_xYp-001',
  PHASE9_METADATA_PROVIDER_MODE: 'real',
};

const load = (contacts?: string) => loadMetadataWorkerEnvironment(
  contacts === undefined ? { ...base } : { ...base, PHASE9_PROVIDER_CONTACTS: contacts },
);

describe('Phase 9 Unit B provider contacts environment validation (T5)', () => {
  it('accepts absence, whitespace-only variable and an empty map as no contacts', async () => {
    // Absence and whitespace-only mean {}; only a present value is validated.
    expect(load().providerContacts).toEqual({});
    expect(load('').providerContacts).toEqual({});
    expect(load('   ').providerContacts).toEqual({});
    expect(load('{}').providerContacts).toEqual({});
  });

  it('accepts a valid map, trimming values', async () => {
    const environment = load('{"fixture-contact":"  ops@example.invalid  ","other-id":"second@example.invalid"}');
    expect(environment.providerContacts).toEqual({
      'fixture-contact': 'ops@example.invalid',
      'other-id': 'second@example.invalid',
    });
  });

  it('accepts a 200-char value and rejects a 201-char value', async () => {
    expect(load(`{"a":"${'x'.repeat(200)}"}`).providerContacts).toEqual({ a: 'x'.repeat(200) });
    expect(() => load(`{"a":"${'x'.repeat(201)}"}`)).toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });

  it.each([
    ['malformed JSON', '{bad'],
    ['JSON array', '[]'],
    ['JSON string', '"ops@example.invalid"'],
    ['JSON number', '42'],
    ['JSON null', 'null'],
    ['bad key with space', '{"bad key!":"ops@example.invalid"}'],
    ['empty key', '{"":"ops@example.invalid"}'],
    ['65-char key', `{"${'k'.repeat(65)}":"ops@example.invalid"}`],
    // F1: '__proto__' matches the key pattern but is rejected at startup so
    // it can never be silently dropped by a prototype setter.
    ['__proto__ key', '{"__proto__":"ops@example.invalid"}'],
    ['empty-string value (K5)', '{"a":""}'],
    ['whitespace-only value (K5)', '{"a":"   "}'],
    ['non-string value', '{"a":42}'],
    ['null value', '{"a":null}'],
    ['Unicode value', '{"a":"ops@exämple.invalid"}'],
    ['emoji value', '{"a":"ops@example.invalid🎉"}'],
    ['CR value', '{"a":"a\\rb"}'],
    ['LF value', '{"a":"a\\nb"}'],
    // F2: boundary control characters are rejected even though trimming
    // would remove them. Mutation caught: trimming before the check.
    ['leading CR value', `{"a":${JSON.stringify('\rops@example.invalid')}}`],
    ['trailing LF value', `{"a":${JSON.stringify('ops@example.invalid\n')}}`],
    ['trailing CRLF value', `{"a":${JSON.stringify('ops@example.invalid\r\n')}}`],
    ['leading TAB value', `{"a":${JSON.stringify('\tops@example.invalid')}}`],
    ['trailing TAB value', `{"a":${JSON.stringify('ops@example.invalid\t')}}`],
    ['control character value', '{"a":"ab"}'],
  ])('rejects %s at startup', async (_label, contacts) => {
    expect(() => load(contacts)).toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });

  it('builds the parsed map with a null prototype (F1)', async () => {
    // Mutation caught: plain-object map letting inherited names resolve.
    const contacts = load('{"fixture-contact":"ops@example.invalid"}').providerContacts;
    expect(Object.getPrototypeOf(contacts)).toBeNull();
    expect(Object.hasOwn(contacts, 'fixture-contact')).toBe(true);
    expect(Object.hasOwn(contacts, 'toString')).toBe(false);
  });

  it('boots fixture mode absent the variable, and fails fixture mode on a malformed map (F4)', async () => {
    // Mutation caught: parsing after the fixture branch (malformed accepted).
    const { PHASE9_METADATA_PROVIDER_MODE: _mode, ...fixtureBase } = base;
    const absent = loadMetadataWorkerEnvironment(fixtureBase);
    expect(absent.providerMode).toBe('fixture');
    expect(absent.providerContacts).toEqual({});
    expect(() => loadMetadataWorkerEnvironment({
      ...fixtureBase, PHASE9_METADATA_PROVIDER_MODE: 'fixture',
      PHASE9_PROVIDER_CONTACTS: '{bad',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });

  it('still rejects unknown PHASE9_ names', async () => {
    expect(() => loadMetadataWorkerEnvironment({
      ...base, PHASE9_PROVIDER_CONTACTS: '{}', PHASE9_BOGUS_UNIT_B: '1',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });
});
