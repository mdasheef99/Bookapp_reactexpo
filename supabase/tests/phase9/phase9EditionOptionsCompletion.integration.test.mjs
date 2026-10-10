// Picker SDD §§4.1-4.3/5/8-9: actual forward SQL effects, receipts, authorization and recovery.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { asService, candidateTruth, complete, createCompletionDatabase, fail, fence, finalize,
  prepareCall, readSql, recover, resetActor, resultRows, rpc, scalar, seedOperation, setActor,
  token, worker } from './editionOptionsCompletionFixture.mjs';
let db;
before(async () => { db = await createCompletionDatabase(); });
after(async () => db?.close());

test('cross-store, candidate, session, attempt and lease inputs cannot publish another card',async()=>{
  const f=await ready();
  for(const mutation of [
    {storeId:randomUUID()},{candidateId:randomUUID()},{sessionId:randomUUID()},
    {attempt:2},{context:{...f.context,requestGeneration:7}},
  ]) assert.equal((await complete(db,{...f,...mutation},resultRows(f))).status,'stale_rejected');
  assert.equal((await rpc(db,'phase9_recover_candidate_edition_options_v1',
    fence(f).map((v,i)=>i===2?'b'.repeat(64):v))).status,'stale_rejected');
});
test('explicit alternative payloads cannot enter attempts, automatic snapshots or cache rows',async()=>{
  const f=await ready(); await resetActor(db);
  await assert.rejects(db.query("UPDATE public.metadata_enrichment_attempts SET normalized_payload=$1 WHERE id=$2",
    [resultRows(f).rows[0].metadata,f.attemptId]),/P9_EDITION_AUTOMATIC_PAYLOAD_DENIED/);
  await assert.rejects(db.query("INSERT INTO public.phase9_selected_metadata_snapshots(candidate_id,store_id,lookup_id,snapshot_version,selection_policy_version,manual_outcome,match_evidence) VALUES($1,$2,$3,'fixture','fixture','no_match','[]')",
    [f.candidateId,f.storeId,f.lookupId]),/P9_EDITION_AUTOMATIC_PAYLOAD_DENIED/);
});
test('same claim cannot authorize a second physical identity; stale finalization preserves bounded spend',async()=>{
  const f=await prepareCall(db,await seedOperation(db));
  await assert.rejects(rpc(db,'phase9_register_metadata_provider_call',[f.attemptId,f.jobId,worker,token,1,randomUUID()]),
    /P9_IDEMPOTENCY_MISMATCH/);
  await resetActor(db); await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1",[f.jobId]);
  await asService(db,f); assert.equal((await finalize(db,f)).status,'stale_rejected');
});
test('worker entrypoints are postgres-owned with empty search paths and deny client-capable roles',async()=>{
  await resetActor(db);
  const rows=(await db.query("SELECT p.proname,p.prosecdef,p.proowner::regrole::text AS owner,p.proconfig,"
    +"has_function_privilege('anon',p.oid,'EXECUTE') AS anon,has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,"
    +"has_function_privilege('service_role',p.oid,'EXECUTE') AS service FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace "
    +"WHERE n.nspname='marketplace_sec' AND p.proname IN('phase9_recover_candidate_edition_options_v1','phase9_complete_candidate_edition_options_v1','phase9_fail_candidate_edition_options_v1')")).rows;
  assert.equal(rows.length,3);
  for(const row of rows){assert.equal(row.owner,'postgres');assert.equal(row.prosecdef,true);
    assert.deepEqual(row.proconfig,['search_path=""']);assert.equal(row.anon,false);assert.equal(row.authenticated,false);assert.equal(row.service,true);}
  assert.equal(await scalar(db,"SELECT has_function_privilege('service_role','marketplace_sec.phase9_fail_metadata_job_automatic(uuid,text,text,integer,uuid,integer,text,text,boolean)','EXECUTE')"),false);
});
async function ready(options) {
  const f = await prepareCall(db, await seedOperation(db, options)); await finalize(db, f); return f;
}
test('explicit corrected query reaches physical egress and atomically saves ten ordered private rows', async () => {
  const f = await ready({ review: { originalTitle: 'Owner corrected book' } });
  const before = await candidateTruth(db, f); await asService(db, f);
  const result = resultRows(f, 10), receipt = await complete(db, f, result);
  assert.equal(receipt.status, 'completed'); assert.equal(receipt.optionsVersion, 1);
  assert.equal('rows' in receipt, false);
  assert.deepEqual(await candidateTruth(db, f), before);
  await setActor(db, f.ownerId);
  const choices = await scalar(db, readSql(f));
  assert.equal(choices.lookupStatus, 'ready');
  assert.deepEqual(choices.rows.map(r => r.ordinal), [0,1,2,3,4,5,6,7,8,9]);
  assert.equal(choices.rows[2].metadata, null); assert.equal(choices.rows[3].eligibility, 'ineligible');
  assert.equal(choices.rows[0].metadata.title, choices.rows[1].metadata.title);
  await resetActor(db);
  assert.equal(await scalar(db, "SELECT status FROM public.image_extraction_jobs WHERE id='" + f.jobId + "'"), 'resolved');
  assert.equal(await scalar(db, "SELECT normalized_payload FROM public.metadata_enrichment_attempts WHERE id='" + f.attemptId + "'"), null);
  assert.equal(await scalar(db, "SELECT count(*)::int FROM public.phase9_metadata_cache_entries WHERE source_attempt_id='" + f.attemptId + "'"), 0);
  assert.equal(await scalar(db, "SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE job_id='" + f.jobId + "'"), 1);
});
test('fresh empty result is reusable with a slim receipt and exact completion replay', async () => {
  const f = await ready(), result = resultRows(f, 0);
  const first = await complete(db, f, result);
  const replay = await complete(db, f, result), recovered = await recover(db, f);
  assert.equal(replay.status, 'replayed'); assert.equal(recovered.status, 'replayed');
  assert.equal(recovered.optionsVersion, first.optionsVersion);
  assert.equal('rows' in recovered, false);
  await setActor(db, f.ownerId); assert.equal((await scalar(db, readSql(f))).lookupStatus, 'ready');
});
test('completion replay rejects a changed payload and never extends the original deadline', async () => {
  const f = await ready(), result = resultRows(f); await complete(db, f, result);
  await assert.rejects(complete(db, f, { ...result, rows: result.rows.map(r => ({
    ...r, metadata: r.metadata ? { ...r.metadata, publisher: 'Changed publisher' } : null,
  })) }), /P9_IDEMPOTENCY_MISMATCH/);
  await assert.rejects(complete(db, f, { ...result, deadline: new Date(Date.parse(result.deadline)+1000).toISOString() }),
    /P9_IDEMPOTENCY_MISMATCH/);
});
for (const [name, mutate] of [
  ['eleven rows', (r,f) => Object.assign(r,resultRows(f,11))],
  ['reordered positions', r => { r.rows[0].ordinal=1; }],
  ['unsafe link', r => { r.rows[0].googleBooksUrl='https://evil.example/books'; }],
  ['selectable null', r => { r.rows[0].metadata=null; }],
  ['extra row payload', r => { r.rows[0].raw={secret:'forbidden'}; }],
  ['wrong attempt provenance', r => { r.rows[0].metadata.attemptId=randomUUID(); }],
  ['wrong original fetch', r => { r.rows[0].metadata.fetchedAt='2026-01-01T00:00:00Z'; }],
  ['incompatible eligible metadata', r => { r.rows[0].metadata.title='Different title'; }],
  ['another record link', r => { r.rows[0].googleBooksUrl='https://books.google.com/books?id=other-record'; }],
  ['another record cover', r => { r.rows[0].metadata.coverReference='https://books.google.com/books/content?id=other-record'; }],
  ['duplicate option identities', r => { r.rows.push({...r.rows[0],ordinal:1}); }],
]) test('controlled completion rejects ' + name + ' without publishing a set', async () => {
  const f=await ready(), result=resultRows(f); mutate(result,f);
  await assert.rejects(complete(db,f,result), /P9_REQUEST_INVALID|P9_EDITION_ROWS_INVALID/);
  await resetActor(db);
  assert.equal(await scalar(db,"SELECT options_version FROM public.phase9_candidate_edition_state WHERE candidate_id='"+f.candidateId+"'"),0);
});
for(const permission of [false,null]) test('verified retention permission is mandatory: '+permission, async()=>{
  const f=await ready(); await assert.rejects(complete(db,f,resultRows(f),permission), /P9_METADATA_STORAGE_DENIED/);
});
test('completion caps retention at original fetch plus 24 hours and denies expired deadlines',async()=>{
  const f=await ready(), result=resultRows(f); result.deadline=new Date(Date.parse(result.fetched)+172800000).toISOString();
  const receipt=await complete(db,f,result); assert.equal(Date.parse(receipt.optionsExpiresAt),Date.parse(result.fetched)+86400000);
  const expired=await ready(), stale=resultRows(expired); stale.deadline=new Date(Date.now()-1000).toISOString();
  await assert.rejects(complete(db,expired,stale),/P9_METADATA_STORAGE_DENIED/);
});
for(const [name,sql] of [
  ['generation changed', f=>"UPDATE public.phase9_candidate_edition_state SET request_generation=request_generation+1 WHERE candidate_id='"+f.candidateId+"'"],
  ['identity changed', f=>"UPDATE public.image_extraction_candidates SET observed_publisher_clue='different' WHERE id='"+f.candidateId+"'"],
  ['removed card', f=>"UPDATE public.image_extraction_candidates SET review_disposition='owner_removed_from_scan' WHERE id='"+f.candidateId+"'"],
  ['Owner revoked', f=>"DELETE FROM public.store_administrators WHERE store_id='"+f.storeId+"'"],
  ['expired lease', f=>"UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()-interval '1 second' WHERE id='"+f.jobId+"'"],
  ['cancelled job', f=>"UPDATE public.image_extraction_jobs SET status='resolved_noop' WHERE id='"+f.jobId+"'"],
  ['committed card', f=>"UPDATE public.image_extraction_candidates SET state='committed' WHERE id='"+f.candidateId+"'"],
  ['expired session', f=>"UPDATE public.image_extraction_sessions SET status='expired' WHERE id='"+f.sessionId+"'"],
]) test('late completion cannot publish after '+name,async()=>{
  const f=await ready(); await resetActor(db); await db.exec(sql(f)); await asService(db,f);
  assert.equal((await complete(db,f,resultRows(f))).status,'stale_rejected');
});
test('selling/version updates survive completion without automatic snapshot mutation',async()=>{
  const f=await ready(); await resetActor(db);
  await db.query("UPDATE public.image_extraction_candidates SET owner_review_snapshot=jsonb_set(owner_review_snapshot,'{value,quantity}','7'),version=version+1 WHERE id=$1",[f.candidateId]);
  const before=await candidateTruth(db,f); await asService(db,f); await complete(db,f);
  assert.deepEqual(await candidateTruth(db,f),before);
});
test('429 schedules another claim and separately records each actual physical request',async()=>{
  const f=await prepareCall(db,await seedOperation(db)); await finalize(db,f,'rate_limited',true);
  assert.equal((await fail(db,f,'rate_limited',true)).status,'retry_scheduled');
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET status='in_progress',attempt_count=2,lease_owner=$1,lease_token_hash=encode(extensions.digest($2,'sha256'),'hex'),lease_expires_at=transaction_timestamp()+interval '5 minutes' WHERE id=$3",[worker,token,f.jobId]);
  await asService(db,f); f.attempt=2;
  await scalar(db,"SELECT public.phase9_metadata_job_context('"+f.jobId+"','"+worker+"','"+token+"',2)");
  const call=await rpc(db,'phase9_register_metadata_provider_call',[f.attemptId,f.jobId,worker,token,2,randomUUID()]);
  f.callId=call.provider_call_id; await finalize(db,f); await complete(db,f);
  await resetActor(db);
  assert.equal(await scalar(db,"SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE job_id='"+f.jobId+"'"),2);
});
test('explicit terminal failure preserves the card and its saved selection',async()=>{
  const f=await seedOperation(db); const before=await candidateTruth(db,f); await asService(db,f);
  assert.equal((await fail(db,f,'policy_denied',false)).status,'resolved');
  assert.deepEqual(await candidateTruth(db,f),before);
});
test('completion requires finalized physical evidence and rolls back all options on persistence failure',async()=>{
  const f=await prepareCall(db,await seedOperation(db));
  await assert.rejects(complete(db,f),/P9_STATE_CONFLICT/); await finalize(db,f);
  await resetActor(db); await db.exec("CREATE FUNCTION public.fixture_fail_options() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'fixture persistence failure'; END$$; CREATE TRIGGER fixture_fail_options BEFORE UPDATE OF options ON public.phase9_candidate_edition_state FOR EACH ROW EXECUTE FUNCTION public.fixture_fail_options();");
  await asService(db,f); await assert.rejects(complete(db,f),/fixture persistence failure/);
  await resetActor(db); await db.exec("DROP TRIGGER fixture_fail_options ON public.phase9_candidate_edition_state; DROP FUNCTION public.fixture_fail_options();");
  assert.equal(await scalar(db,"SELECT status FROM public.image_extraction_jobs WHERE id='"+f.jobId+"'"),'in_progress');
  assert.equal(await scalar(db,"SELECT options_version FROM public.phase9_candidate_edition_state WHERE candidate_id='"+f.candidateId+"'"),0);
});
test('authenticated and anonymous actors cannot invoke the worker completion port or write private options',async()=>{
  const f=await seedOperation(db);
  for(const role of ['authenticated','anon']){
    await setActor(db,f.ownerId,role); await assert.rejects(recover(db,f),/permission denied/);
    await assert.rejects(db.query("UPDATE public.phase9_candidate_edition_state SET options='[]' WHERE candidate_id=$1",[f.candidateId]),/permission denied/);
  }
  await asService(db,f);
  await assert.rejects(db.query("UPDATE public.phase9_candidate_edition_state SET options='[]' WHERE candidate_id=$1",[f.candidateId]),/permission denied/);
});
