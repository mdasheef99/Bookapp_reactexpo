// 02b sections 3.2/7.1/9/11: disposable completion-boundary fixtures only.
import assert from 'node:assert/strict';
import { catalogueBatch, completeCatalogueV2 } from './leanCatalogueFixture.mjs';
import { add, bytes, readSql, resetActor, saveReview, scalar, seedIncumbent, selectionBytes, selectSql, setActor } from './catalogueLinkFixture.mjs';
import { complete } from './editionOptionsCompletionFixture.mjs';
import { expire } from './editionPickerCommitFixture.mjs';

export async function completionFootprint(db) {
  await resetActor(db);
  const tables=(await db.query(`SELECT table_schema,table_name FROM information_schema.tables
    WHERE table_schema IN('public','marketplace_sec') AND table_type='BASE TABLE' ORDER BY 1,2`)).rows;
  assert.ok(tables.some(t => t.table_name==='phase9_catalogue_companions'));
  assert.ok(tables.some(t => t.table_name==='phase9_catalogue_lookup_effects'));
  const parts=tables.map(({table_schema:s,table_name:t}) => {
    assert.match(s+t,/^[a-z0-9_]+$/);
    return `SELECT '${s}.${t}' AS name,coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::jsonb) AS body FROM ${s}.${t} r`;
  });
  return (await db.query(`SELECT jsonb_object_agg(name,body)::text AS bytes FROM (${parts.join(' UNION ALL ')}) all_tables`)).rows[0].bytes;
}
export async function clearCatalogueOptions(db,f) {
  await resetActor(db);
  await db.query(`UPDATE public.phase9_candidate_edition_state SET options='[]'::jsonb,source_lookup_id=NULL,
    source_attempt_id=NULL,source_fetched_at=NULL,options_expires_at=NULL WHERE candidate_id=$1`,[f.candidateId]);
}
export async function originalChoiceAfterCleanup(db,v2=false) {
  const finish=f => v2 ? completeCatalogueV2(db,f) : complete(db,f,{rows:f.rows,fetched:f.fetched,deadline:f.deadline});
  const original=await catalogueBatch(db,{},['B. Author']); await finish(original);
  await setActor(db,original.ownerId);
  await scalar(db,selectSql(original,await scalar(db,readSql(original)),original.rows[0].optionId));
  await saveReview(db,original);
  const saved=await selectionBytes(db,original);
  await expire(db,original); await resetActor(db);
  await db.query('SELECT marketplace_sec.phase9_edition_clear_options($1)',[original.candidateId]);
  const newer=await catalogueBatch(db,{authors:['B. Author','C. Author']},null,
    {existing:original,recordBase:200,workExternalId:'OL701W'});
  assert.notEqual(newer.lookupId,original.lookupId); assert.notEqual(newer.attemptId,original.attemptId);
  assert.notEqual(newer.catalogueCompanions[0].workExternalId,original.catalogueCompanions[0].workExternalId);
  assert.notEqual(newer.rows[0].metadata.providerRecordId,original.rows[0].metadata.providerRecordId);
  await finish(newer); await clearCatalogueOptions(db,newer);
  assert.equal(await selectionBytes(db,original),saved,'new lookup and cleanup must preserve the original choice bytes');
  await setActor(db,original.ownerId); await saveReview(db,original);
  const committed=await add(db,original), item=committed.item;
  const sources=JSON.parse(await bytes(db,'book_metadata_sources','canonical_edition_id=$1',[item.canonical_edition_id]));
  assert.equal(sources.length,1); assert.equal(sources[0].provider_book_id,original.rows[0].metadata.providerRecordId);
  assert.notEqual(sources[0].provider_book_id,newer.rows[0].metadata.providerRecordId);
  return {original,newer,item,sources};
}

// AC7-2f/17: exercise the same incumbent fixture before and after the v1 delegate.
export async function v1IncumbentCompletion(db) {
  const f = await catalogueBatch(db,{isbn10:'0306406152',isbn13:'9780306406157'});
  const target = await seedIncumbent(db,f.rows[0].metadata);
  await db.query('UPDATE public.canonical_editions SET oclc=$1,lccn=$2 WHERE id=$3',
    ['0001234','n 79021164',target.editionId]);
  const incumbent = () => db.query('SELECT oclc,lccn FROM public.canonical_editions WHERE id=$1',[target.editionId]);
  const before = (await incumbent()).rows;
  assert.deepEqual(before,[{oclc:'0001234',lccn:'n 79021164'}]);
  await setActor(db,f.ownerId,'service_role');
  assert.equal((await complete(db, f, { rows:f.rows, fetched:f.fetched, deadline:f.deadline })).status, 'completed');
  await resetActor(db);
  assert.deepEqual((await incumbent()).rows,before,'old workers without companions must preserve incumbent OCLC/LCCN');
  return f;
}
