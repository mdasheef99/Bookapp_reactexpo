import fs from 'fs';
import path from 'path';
import {
  assertCursorContext,
  assertMarketplaceStoreGroupPage,
  assertNoForbiddenTelemetryFields,
  assertRawPayloadWithinLimit,
  assertSafeMarketplaceDto,
  mayUseProviderField,
  parseVerifiedMarketplaceCursorPayload,
  PHASE9_ERROR_CATALOGUE,
  PHASE9_FORBIDDEN_ADAPTER_AUTHORITY_FIELDS,
  PHASE9_GRANT_MATRIX,
  PHASE9_GRANT_CONTROLS,
  PHASE9_MARKETPLACE_QUERY_REGISTER,
  PHASE9_PROVIDER_REUSE_FIELDS,
  PHASE9_RED_IMPLEMENTATION_GATES,
  PHASE9_VALIDATION_MATRIX,
  validateProviderReusePolicy,
  VISION_OUTCOMES,
  METADATA_OUTCOMES,
} from '../_shared/imageInventory/contracts';

describe('Phase 9 central registers and security boundaries', () => {
  it('covers every mandatory validation field with fail-closed metadata', () => {
    const required = ['title', 'subtitle', 'authors', 'description', 'isbn_clue', 'language', 'candidate_count', 'automated_aliases', 'categories', 'page_count', 'geometry', 'damage_note', 'quantity', 'money_paise', 'idempotency_key', 'command_id', 'raw_payload_bytes'];
    expect(required.every((field) => field in PHASE9_VALIDATION_MATRIX)).toBe(true);
    expect(Object.values(PHASE9_VALIDATION_MATRIX).every((rule) => rule.rejects.length > 0 && rule.visibility)).toBe(true);
  });

  it('defines stable safe API errors separately from adapter outcomes', () => {
    expect(Object.keys(PHASE9_ERROR_CATALOGUE)).toEqual([
      'P9_OWNER_NOT_AUTHORIZED',
      'P9_SESSION_NOT_ACTIVE',
      'P9_CANDIDATE_VERSION_CONFLICT',
      'P9_DUPLICATE_TARGET_CHANGED',
      'P9_MEDIA_NOT_APPROVED',
      'P9_QUANTITY_INVARIANT_FAILED',
      'P9_PUBLICATION_FAILED',
    ]);
    expect(PHASE9_ERROR_CATALOGUE.P9_PUBLICATION_FAILED.survivingEffect).toBe('private_inventory_committed');
    expect(PHASE9_ERROR_CATALOGUE.P9_PUBLICATION_FAILED.reuseIdempotencyKey).toBe(true);
    expect(Object.values(PHASE9_ERROR_CATALOGUE).every((error) =>
      Number.isInteger(error.httpStatus)
      && typeof error.retryable === 'boolean'
      && error.safeOwnerMessage.length > 0
      && typeof error.reuseIdempotencyKey === 'boolean')).toBe(true);
    expect([...VISION_OUTCOMES, ...METADATA_OUTCOMES].some((outcome) => outcome.startsWith('P9_'))).toBe(false);
  });

  it('centrally forbids adapter authority, identity, retry, command, path, tool, and capability fields', () => {
    expect(PHASE9_FORBIDDEN_ADAPTER_AUTHORITY_FIELDS).toEqual(expect.arrayContaining([
      'store_id', 'actor_id', 'workflow_state', 'retryable', 'database_command',
      'storage_path', 'signed_url', 'tools', 'credentials', 'command_id',
    ]));
  });

  it('denies client access to operational structures in the grant design register', () => {
    const internal = PHASE9_GRANT_MATRIX.filter((entry) => entry.resource !== 'owner_safe_commands' && entry.resource !== 'public_marketplace_projection');
    expect(internal.every((entry) => entry.anon === 'none' && entry.authenticated === 'none')).toBe(true);
    expect(PHASE9_GRANT_CONTROLS).toMatchObject({
      tenantAuthority: 'server_derived_store_id',
      apiExposedTablesRequireRls: true,
      internalOperationalTablesServiceOnly: true,
      ambientAuthenticatedWrites: 'denied',
      defaultPublicPrivileges: 'revoked',
      defaultFunctionExecute: 'revoked',
      privilegedHelperClientExecute: 'denied',
      searchPath: 'pinned',
      references: 'schema_qualified',
      crossStoreDenialTests: 'required',
    });
  });

  it('keeps provenance separate from field-level provider reuse permission', () => {
    const fields = PHASE9_PROVIDER_REUSE_FIELDS.map((field) => ({
      field,
      matching: true,
      storage: field !== 'cover_reference',
      publicDisplay: field === 'title',
      imageCache: false,
      attributionRequired: true,
      revalidateAfterSeconds: 86400,
    }));
    const policy = validateProviderReusePolicy({ adapterKey: 'fixture', policyVersion: '1', fields });
    expect(mayUseProviderField(policy, 'title', 'publicDisplay')).toBe(true);
    expect(mayUseProviderField(policy, 'description', 'publicDisplay')).toBe(false);
    expect(policy.fields.every((field) => typeof field.attributionRequired === 'boolean')).toBe(true);
    expect(policy.fields.every((field) => field.revalidateAfterSeconds === 86400)).toBe(true);
    expect(mayUseProviderField(policy, 'cover_reference', 'imageCache')).toBe(false);
    expect(() => validateProviderReusePolicy({ ...policy, fields: [{ ...fields[0], storage: false, publicDisplay: true }] })).toThrow(/requires storage permission/i);
  });

  it('binds marketplace cursors to query context and stable store-group ranking', () => {
    const fingerprint = 'context_fingerprint_0000000000000001';
    const cursor = parseVerifiedMarketplaceCursorPayload({
      query_version: 'p9-marketplace-query-v1',
      ranking_version: 'p9-store-rank-v1',
      context_fingerprint: fingerprint,
      last_match_score: 0.75,
      last_store_id: '00000000-0000-4000-8000-000000000001',
      page_size: 20,
    });
    expect(PHASE9_MARKETPLACE_QUERY_REGISTER.paginationUnit).toBe('store_group');
    expect(PHASE9_MARKETPLACE_QUERY_REGISTER.bookMatchRanking[0]).toBe('exact_isbn');
    expect(PHASE9_MARKETPLACE_QUERY_REGISTER.storeResultRanking).toContain('eligibility');
    expect(PHASE9_MARKETPLACE_QUERY_REGISTER.aliasMatchBehavior).toContain('display_original');
    expect(PHASE9_MARKETPLACE_QUERY_REGISTER.storefrontBehavior).toContain('complete_active_public_catalogue');
    expect(PHASE9_MARKETPLACE_QUERY_REGISTER.forbiddenFields).toContain('request_media');
    expect(() => assertCursorContext(cursor, 'different_context_000000000000001')).toThrow(/different query/i);
    expect(() => assertMarketplaceStoreGroupPage({
      storeIds: ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'],
      bookstoreCount: 2,
      offerCount: 3,
      titleCount: 20,
    })).not.toThrow();
    expect(() => assertMarketplaceStoreGroupPage({
      storeIds: ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'],
      bookstoreCount: 2,
      offerCount: 2,
      titleCount: 10,
    })).toThrow(/appear once/i);
  });

  it('rejects private marketplace and telemetry fields at any nesting depth', () => {
    expect(() => assertSafeMarketplaceDto({ store: { exact_quantity: 4 } })).toThrow(/private field/i);
    expect(() => assertSafeMarketplaceDto({ store: { request_media: ['private'] } })).toThrow(/private field/i);
    expect(() => assertNoForbiddenTelemetryFields({ event: { raw_prompt: 'private' } })).toThrow(/forbidden telemetry field/i);
    expect(() => assertNoForbiddenTelemetryFields({ event: { signed_url: 'private' } })).toThrow(/forbidden telemetry field/i);
  });

  it('enforces the central provider raw-payload byte limit', () => {
    expect(() => assertRawPayloadWithinLimit({ value: 'small' })).not.toThrow();
    expect(() => assertRawPayloadWithinLimit({ value: 'x'.repeat(262145) })).toThrow(/262144 bytes/i);
  });

  it('records future production gates as red without introducing product implementations', () => {
    expect(PHASE9_RED_IMPLEMENTATION_GATES).toHaveLength(8);
    expect(new Set(PHASE9_RED_IMPLEMENTATION_GATES.map((gate) => gate.id)).size).toBe(8);
    for (const relative of ['supabase/migrations', 'src/features/stores/inventoryExtraction']) {
      const full = path.join(process.cwd(), relative);
      if (relative.includes('inventoryExtraction')) expect(fs.existsSync(full)).toBe(false);
    }
  });

  it('keeps the WU0A server package network- and credential-free', () => {
    const root = path.join(process.cwd(), 'supabase', 'functions', '_shared', 'imageInventory');
    const source = fs.readdirSync(path.join(root, 'contracts'))
      .concat(fs.readdirSync(path.join(root, 'domain')))
      .filter((name) => name.endsWith('.ts'))
      .map((name) => {
        const folder = fs.existsSync(path.join(root, 'contracts', name)) ? 'contracts' : 'domain';
        return fs.readFileSync(path.join(root, folder, name), 'utf8');
      })
      .join('\n');
    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toMatch(/createClient|SUPABASE_(?:URL|SERVICE_ROLE_KEY)|api[_-]?key/iu);
    expect(source).not.toMatch(/Authorization\s*:|Bearer\s+[A-Za-z0-9._-]+/iu);
  });
});
