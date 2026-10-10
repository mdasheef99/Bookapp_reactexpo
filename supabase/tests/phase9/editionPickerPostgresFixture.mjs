// Picker SDD §§5-9: synthetic setup; selection/Save/Add/worker execution always use unchanged M65-M70.
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { metadata, row, readSql, lookupSql, selectSql } from './editionPickerFixture.mjs';
import { reviewedValue, commitSql } from './unit7aFixture.mjs';
import { json, literal, owner, q, rpcSql, service, sql } from './editionPickerPostgresConnections.mjs';
export { readSql, lookupSql, selectSql };
export const worker = 'edition-picker-postgres-worker';
export const ownerAction = (statement, f) => ({ statement, role: 'authenticated', actor: f.ownerId });
export const workerAction = statement => ({ statement, role: 'service_role' });
export async function card(parent = null) {
  const f = { storeId: parent?.storeId ?? randomUUID(), ownerId: parent?.ownerId ?? randomUUID(),
    sessionId: parent?.sessionId ?? randomUUID(), candidateId: randomUUID() };
  const review = reviewedValue({ originalTitle: metadata.title, authors: ['Fixture Author'] });
  // Same administrative seed as unit7aFixture/editionPickerFixture; no mocked production command.
  if (!parent) await sql('INSERT INTO public.stores(id,display_name) VALUES(' + q(f.storeId)
    + ",'Edition picker local PostgreSQL'); INSERT INTO public.store_administrators(store_id,user_id,role,status)"
    + ' VALUES(' + q(f.storeId) + ',' + q(f.ownerId) + ",'owner','active');"
    + ' INSERT INTO public.image_extraction_sessions(id,store_id,created_by,status,selected_language,selected_script,'
    + 'default_condition,default_location,default_quantity,default_publication) VALUES('
    + [f.sessionId, f.storeId, f.ownerId, 'active', 'en', 'Latn', 'good', 'A1'].map(q).join(',')
    + ",1,'private')");
  await sql('INSERT INTO public.image_extraction_candidates(id,session_id,store_id,candidate_index,'
    + 'observed_title,observed_authors,observed_language,observed_script,owner_review_snapshot,review_disposition,'
    + 'state,version,metadata_revision,review_ready,review_version) SELECT '
    + [f.candidateId, f.sessionId, f.storeId].map(q).join(',')
    + ',coalesce(max(candidate_index),0)+1,' + q(metadata.title) + ",ARRAY['Fixture Author'],'en','Latn',"
    + literal({ value: review, confirmed_title: { value: review.originalTitle }, confirmed_authors: review.authors })
    + ",'reviewed','ready',1,1,true,1 FROM public.image_extraction_candidates WHERE session_id=" + q(f.sessionId));
  return f;
}
export const state = f => json('SELECT row_to_json(c) FROM public.image_extraction_candidates c WHERE id=' + q(f.candidateId));
export const choices = f => owner(readSql(f), f);
export const options = f => json('SELECT row_to_json(s) FROM public.phase9_candidate_edition_state s WHERE candidate_id=' + q(f.candidateId));
export const inventory = f => json("SELECT coalesce(json_agg(i),'[]') FROM public.store_inventory i WHERE created_from_candidate_id=" + q(f.candidateId));
export async function save(f, overrides = {}) {
  const c = await state(f);
  return owner(rpcSql('phase9_update_candidate_review_v2', [f.sessionId, f.candidateId, c.version,
    c.metadata_revision, { ...c.owner_review_snapshot.value, ...overrides }, randomUUID(), randomUUID()]), f);
}
export async function addSql(f, overrides = {}) {
  const c = await state(f);
  return commitSql(f, { candidateVersion: c.version, reviewVersion: c.review_version ?? 1,
    metadataRevision: c.metadata_revision, idempotencyKey: randomUUID(), commandId: randomUUID(), ...overrides });
}
export async function expire(f) {
  await sql("UPDATE public.phase9_candidate_edition_state SET source_fetched_at=transaction_timestamp()-interval '25 hours',"
    + "options_expires_at=transaction_timestamp()-interval '1 hour' WHERE candidate_id=" + q(f.candidateId));
}
export const fence = f => [f.jobId, worker, f.token, f.attempt, f.candidateId, f.storeId,
  f.sessionId, f.jobId, f.context.requestGeneration, f.context.queryIdentity];
export async function operation(f) {
  const current = await choices(f);
  const receipt = await owner(lookupSql(f, current.requestGeneration), f);
  const claims = await service(rpcSql('claim_phase9_metadata_jobs', [10, worker])
    .replace('SELECT public.', "SELECT coalesce(json_agg(c),'[]') FROM public.") + ' c');
  const claim = claims.find(value => value.id === receipt.operationId);
  assert.ok(claim, 'real SKIP LOCKED claim contains the requested operation');
  const p = { ...f, jobId: claim.id, token: claim.lease_token, attempt: claim.attempt_count };
  p.context = await service(rpcSql('phase9_metadata_job_context', [p.jobId, worker, p.token, p.attempt]));
  const base = [p.jobId, worker, p.token, p.attempt], query = p.context.queryIdentity;
  const lookup = await service(rpcSql('phase9_register_structural_metadata_lookup', [...base,
    p.candidateId, p.context.candidateVersion, query, 'edition-options:' + p.jobId,
    'google_books', '1.0.0', 'cap-v1', 'p9-metadata-foundation-v1', 'bibliographic',
    'p9-metadata-lookup-v1', 'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1',
    'store_private', '1', 'p9-metadata-cache-v1', 'metadata-v1', null]));
  p.lookupId = lookup.lookup_id;
  const usage = await service(rpcSql('phase9_reserve_metadata_usage', [...base, p.lookupId, 'google_books', '1.0.0', 1]));
  const attempt = await service(rpcSql('phase9_register_structural_metadata_attempt', [p.lookupId, ...base,
    p.candidateId, p.context.candidateVersion, randomUUID(), 'edition-options:' + p.jobId,
    'primary', 1, 'google_books', '1.0.0', 'cap-v1', 'p9-metadata-foundation-v1',
    'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1', 'local_insufficient', usage.reservation_id]));
  p.attemptId = attempt.attempt_id;
  const call = await service(rpcSql('phase9_register_metadata_provider_call', [p.attemptId, ...base, randomUUID()]));
  p.callId = call.provider_call_id;
  await service(rpcSql('phase9_finalize_metadata_provider_call', [p.callId, ...base, 'finalized',
    'coherent_match', 'coherent_match', 'fixture-response', false, null, []]));
  return p;
}
export function result(p, overrides = {}) {
  const fetched = new Date().toISOString();
  return { fetched, deadline: new Date(Date.parse(fetched) + 3600000).toISOString(),
    rows: [0, 1].map(ordinal => row(ordinal, { metadata: { ...metadata,
      publisher: ordinal ? 'Alternative Fixture Press' : metadata.publisher,
      ...overrides, correlationId: p.lookupId, attemptId: p.attemptId, fetchedAt: fetched } })) };
}
export const completeSql = (p, r, permission = true) => rpcSql('phase9_complete_candidate_edition_options_v1',
  [...fence(p), p.lookupId, p.attemptId, r.fetched, r.deadline, permission, r.rows]);
export async function withOptions(f = null, overrides = {}) {
  f ??= await card();
  const p = await operation(f), r = result(p, overrides);
  assert.equal((await service(completeSql(p, r))).status, 'completed');
  return { ...f, operation: p, result: r, choices: await choices(f) };
}
export async function chosen(f = null, overrides = {}) {
  f = await withOptions(f, overrides);
  f.selected = await owner(selectSql(f, f.choices, f.result.rows[0].optionId), f);
  await save(f);
  return f;
}
export async function provider(enabled = true) {
  await sql("INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,enabled,"
    + "matching_allowed,storage_allowed,revalidation_seconds,policy_version) VALUES('google_books','metadata',"
    + "'1.0.0'," + enabled + ",true,true,86400,1) ON CONFLICT(adapter_key) DO UPDATE SET enabled="
    + enabled + ",matching_allowed=true,storage_allowed=true,adapter_version='1.0.0'");
}
export async function assertCommitted(f, snapshot = f.selected.selection.snapshot) {
  const rows = await inventory(f);
  assert.equal(rows.length, 1);
  const item = rows[0], c = await state(f), selling = c.owner_review_snapshot.value;
  for (const [dbKey, key] of Object.entries({ title: 'title', authors: 'authors', language: 'language',
    isbn_10: 'isbn10', isbn_13: 'isbn13', publisher: 'publisher', published_date: 'publishedDate',
    cover_url: 'coverReference', description: 'description', edition_statement: 'editionStatement',
    volume: 'volume', format: 'format' })) assert.deepEqual(item[dbKey], snapshot[key], dbKey);
  for (const [dbKey, value] of Object.entries({ selling_price_minor: selling.priceMinor,
    quantity_total: selling.quantity, quantity_available: selling.quantity, condition: selling.baseCondition,
    shelf_location: selling.shelfLocation, internal_notes: selling.notes.internalNote,
    public_notes: selling.notes.publicNote, has_damage: selling.damageDisclosure.hasDamage,
    damage_types: selling.damageDisclosure.damageTypes, damage_notes: selling.damageDisclosure.damageNote,
    is_sellable: selling.damageDisclosure.isSellable, visibility_status: 'draft', publication_status: 'private' }))
    assert.deepEqual(item[dbKey], value, dbKey);
  for (const key of ['quantity_reserved', 'quantity_sold', 'quantity_removed']) assert.equal(item[key], 0);
  assert.equal(c.state, 'committed');
  const s = await options(f);
  assert.deepEqual(s.options, []); assert.equal(s.request_id, null);
  assert.equal(s.selection_id, f.selected.selection.selectionId);
  return item;
}