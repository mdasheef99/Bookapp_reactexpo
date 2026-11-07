// Approved M99 plan + A1; pipeline sections 10-11/15, WU1 section 6, DOC-8 section 4, 02c sections 4.3/8/9.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {before,after,beforeEach,test} from 'node:test';
import {database,clean,resetActor,value,setActor,seedCard,seedOptions,rpc,nativeConnection,helper,counts,replaced,
 fresh,fail,evidence,reservation,snapshot,metadataAttempt,visionAttempt,mark,definitions} from './fixRound8cFixture.mjs';
import {readSql,row} from './editionPickerFixture.mjs';
import {mutate} from './fixRound8cMutations.mjs';
let db;
before(async()=>{db=await database();await mutate(db);});
beforeEach(async()=>{await clean(db);await db.query("SELECT set_config('request.headers','{}',false)");});after(async()=>{await db?.close();});
const paths=['automatic','explicit','vision'];
const choices=f=>value(db,readSql(f));
async function job(f){await resetActor(db);return value(db,'SELECT to_jsonb(j) FROM public.image_extraction_jobs j WHERE id=$1',[f.jobId]);}
async function expectUsage(f,status,cost){const r=await reservation(db,f);assert.equal(r.status,status);assert.equal(r.actual_cost_units===null?null:Number(r.actual_cost_units),cost);}

test('D2 native choices read ignores held session and candidate row locks',
 {skip:!process.env.PHASE9_PROVIDER_NATIVE_PORT?'native two-connection proof only':false},async()=>{
 const f=await seedCard(db),a=await nativeConnection(db.database),b=await nativeConnection(db.database);
 try {
  assert.notEqual((await a.query('SELECT pg_backend_pid() id')).rows[0].id,(await b.query('SELECT pg_backend_pid() id')).rows[0].id);
  await a.query('BEGIN');
  await a.query('SELECT id FROM public.image_extraction_sessions WHERE id=$1 FOR UPDATE',[f.sessionId]);
  await a.query('SELECT id FROM public.image_extraction_candidates WHERE id=$1 FOR UPDATE',[f.candidateId]);
  await b.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[f.ownerId]);
  await b.query("SET ROLE authenticated; SET statement_timeout='750ms'");
  const start=performance.now();const result=(await b.query(readSql(f))).rows[0];
  assert.equal(Object.values(result)[0].candidateId,f.candidateId);assert.ok(performance.now()-start<1500);
 }finally{await a.query('ROLLBACK');await Promise.all([a.end(),b.end()]);}
});
test('D2 foreign initiating owner and foreign store candidate denied',async()=>{
 const a=await seedCard(db),b=await seedCard(db);await setActor(db,b.ownerId);
 await assert.rejects(choices(a),/P9_OWNER_NOT_AUTHORIZED/);
 await setActor(db,a.ownerId);await assert.rejects(value(db,readSql({...a,candidateId:b.candidateId})),/P9_NOT_FOUND/);
});
for(const status of ['closed','closing','expired'])test('D2 session '+status+' preserves state conflict',async()=>{
 const f=await seedCard(db);await resetActor(db);
 await db.query('UPDATE public.image_extraction_sessions SET status=$1 WHERE id=$2',[status,f.sessionId]);
 await setActor(db,f.ownerId);await assert.rejects(choices(f),/P9_STATE_CONFLICT/);
});
for(const change of ["expires_at=transaction_timestamp()-interval '1 second'","state='failed'",
 "review_disposition='owner_removed_from_scan'","review_disposition='skipped_false_detection'"])
 test('D2 candidate eligibility '+change,async()=>{
  const f=await seedCard(db);await resetActor(db);
  await db.query('UPDATE public.image_extraction_candidates SET '+change+' WHERE id=$1',[f.candidateId]);
  await setActor(db,f.ownerId);await assert.rejects(choices(f),/P9_STATE_CONFLICT/);
 });
test('D2 active but time-expired session rejected and missing candidate not found',async()=>{
 const f=await seedCard(db);await assert.rejects(value(db,readSql({...f,candidateId:randomUUID()})),/P9_NOT_FOUND/);
 await resetActor(db);await db.query("UPDATE public.image_extraction_sessions SET expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1",[f.sessionId]);
 await setActor(db,f.ownerId);await assert.rejects(choices(f),/P9_STATE_CONFLICT/);
});
for(const headers of [{},{'x-client-info':'bookconnect/edition-reasons-v1'},{'x-client-info':'bookconnect/edition-reasons-v2'}])
 test('D2 current projection equality '+JSON.stringify(headers),async()=>{
  const f=await seedCard(db);await seedOptions(db,f,[row(),row(1,{eligibility:'ineligible'})]);
  await resetActor(db);await db.query("SELECT set_config('request.headers',$1,false)",[JSON.stringify(headers)]);
  const expected=await value(db,'SELECT marketplace_sec.phase9_edition_choices(c) FROM public.image_extraction_candidates c WHERE id=$1',[f.candidateId]);
  await setActor(db,f.ownerId);assert.deepEqual(await choices(f),expected);
 });
async function inventoryFor(storeId,ownerId,rows){await resetActor(db);for(const [visibility,quantity] of rows)
 await db.query(`INSERT INTO public.store_inventory(id,store_id,title,authors,condition,selling_price_minor,
  quantity_total,quantity_available,visibility_status,publication_status,created_by)
  VALUES(gen_random_uuid(),$1,'M99 count fixture',ARRAY['Fixture'],'good',100,$2,$2,$3,'private',$4)`,[storeId,quantity,visibility,ownerId]);}
async function inventory(f,rows){await inventoryFor(f.storeId,f.ownerId,rows);}
async function addStore(ownerId,name='M99 second store'){await resetActor(db);const storeId=randomUUID();
 await db.query('INSERT INTO public.stores(id,display_name) VALUES($1,$2)',[storeId,name]);
 await db.query("INSERT INTO public.store_administrators(store_id,user_id,role,status) VALUES($1,$2,'owner','active')",[storeId,ownerId]);
 return {storeId,ownerId};}
test('D3 all six row counts overlap stock and include other visibility states; direct select denied',async()=>{
 const f=await seedCard(db);await inventory(f,[['published',2],['published',1],['draft',0],['draft',3],['paused',1],['blocked',0],['needs_review',4],['out_of_stock',0]]);
 await setActor(db,f.ownerId);assert.deepEqual(await rpc(db,counts,[f.storeId]),{total:8,published:2,draft:2,paused:1,lowStock:2,outOfStock:3});
 await assert.rejects(db.query('SELECT visibility_status,quantity_available FROM public.store_inventory'),{code:'42501'});
});
test('D3 two owners receive only their own counts and empty owner receives zeros',async()=>{
 const a=await seedCard(db),b=await seedCard(db),empty=await seedCard(db);await inventory(a,[['draft',1]]);await inventory(b,[['paused',0],['published',2]]);
 await setActor(db,a.ownerId);assert.deepEqual(await rpc(db,counts,[a.storeId]),{total:1,published:0,draft:1,paused:0,lowStock:1,outOfStock:0});
 await setActor(db,b.ownerId);assert.deepEqual(await rpc(db,counts,[b.storeId]),{total:2,published:1,draft:0,paused:1,lowStock:0,outOfStock:1});
 await setActor(db,empty.ownerId);assert.deepEqual(await rpc(db,counts,[empty.storeId]),{total:0,published:0,draft:0,paused:0,lowStock:0,outOfStock:0});
});
test('D3 null store is rejected before any fallback',async()=>{
 const f=await seedCard(db);await inventory(f,[['draft',1]]);await setActor(db,f.ownerId);
 await assert.rejects(rpc(db,counts,[null]),/P9_REQUEST_INVALID/);
});
test('D3 another owner store id is rejected',async()=>{
 const a=await seedCard(db),b=await seedCard(db);await setActor(db,a.ownerId);
 await assert.rejects(rpc(db,counts,[b.storeId]),/P9_OWNER_NOT_AUTHORIZED/);
});
test('D3 owner of two eligible stores receives each store\'s own counts',async()=>{
 const f=await seedCard(db),second=await addStore(f.ownerId);
 await inventoryFor(f.storeId,f.ownerId,[['draft',1]]);
 await inventoryFor(second.storeId,f.ownerId,[['published',2],['paused',0]]);
 await setActor(db,f.ownerId);
 assert.deepEqual(await rpc(db,counts,[f.storeId]),{total:1,published:0,draft:1,paused:0,lowStock:1,outOfStock:0});
 assert.deepEqual(await rpc(db,counts,[second.storeId]),{total:2,published:1,draft:0,paused:1,lowStock:0,outOfStock:1});
});
for(const change of ["status='suspended'","setup_status='incomplete'","selling_status='not_allowed'"])
 test('D3 eligible owner capability required '+change,async()=>{
  const f=await seedCard(db);await resetActor(db);await db.query('UPDATE public.stores SET '+change+' WHERE id=$1',[f.storeId]);
  await setActor(db,f.ownerId);await assert.rejects(rpc(db,counts,[f.storeId]),/P9_OWNER_NOT_AUTHORIZED/);
 });
test('D3 inactive owner, nonowner and missing identity rejected',async()=>{
 const f=await seedCard(db);await resetActor(db);await db.query("UPDATE public.store_administrators SET status='inactive' WHERE store_id=$1",[f.storeId]);
 await setActor(db,f.ownerId);await assert.rejects(rpc(db,counts,[f.storeId]),/P9_OWNER_NOT_AUTHORIZED/);
 await setActor(db,randomUUID());await assert.rejects(rpc(db,counts,[f.storeId]),/P9_OWNER_NOT_AUTHORIZED/);
 await setActor(db,'');await assert.rejects(rpc(db,counts,[f.storeId]),/P9_AUTH_REQUIRED/);
});
for(const role of ['anon','service_role'])test('D3 counts denies '+role,async()=>{
 await setActor(db,'',role);await assert.rejects(rpc(db,counts,[randomUUID()]),{code:'42501'});
});

for(const path of paths) {
 for(const [shape,cost,status,actual] of [['unsent',null,'released',0],['sent',2.75,'consumed',2.75],['sent',null,'reserved',null],['registered',null,'reserved',null],['unknown',null,'reserved',null]])
  test(`D4 ${path} ${shape} cost=${cost} -> ${status}`,async()=>{
   const f=await fresh(db,path,2);await evidence(db,f,shape,cost);
   await fail(db,f);await expectUsage(f,status,actual);assert.equal((await job(f)).status,path==='vision'?'resolved':'dead_letter');
  });
 test(`D4 ${path} earlier sent plus later unsent counts earlier cost once`,async()=>{
  const f=await fresh(db,path,2);await evidence(db,f,'sent',3.25,{calls:path==='vision'?1:3,claim:1});
  if(path!=='vision')await metadataAttempt(db,f,'unsent');
  await fail(db,f);await expectUsage(f,'consumed',3.25);
 });
 test(`D4 ${path} any earlier NULL cost prevents a partial known total`,async()=>{
  const f=await fresh(db,path,3);await evidence(db,f,'sent',2);
  if(path==='vision')await visionAttempt(db,f,'sent',null,1);else await metadataAttempt(db,f,'sent',null,{claim:1});
  await fail(db,f);await expectUsage(f,'reserved',null);
 });
 for(const [status,cost] of [['consumed',0],['consumed',4.5],['released',0]])test(`A1 ${path} ${status} cost=${cost} is byte-identical`,async()=>{
  const f=await fresh(db,path,2);await evidence(db,f,'unsent');await resetActor(db);
  if(status==='consumed'&&cost===0)await db.query("UPDATE public.phase9_usage_reservations SET status='consumed',actual_cost_units=coalesce(actual_cost_units,0) WHERE id=$1",[f.reservationId]);
  else await db.query('UPDATE public.phase9_usage_reservations SET status=$1,actual_cost_units=$2 WHERE id=$3',[status,cost,f.reservationId]);
  const prior=await value(db,'SELECT row_to_json(r)::text FROM public.phase9_usage_reservations r WHERE id=$1',[f.reservationId]);
  await fail(db,f);await resetActor(db);
  assert.equal(await value(db,'SELECT row_to_json(r)::text FROM public.phase9_usage_reservations r WHERE id=$1',[f.reservationId]),prior);
 });
 test(`D4 ${path} foreign store and foreign job reservations untouched`,async()=>{
  const f=await fresh(db,path,2),other=await fresh(db,path,2);await evidence(db,f,'unsent');
  const prior=await reservation(db,other);await resetActor(db);
  const foreign=await value(db,`INSERT INTO public.phase9_usage_reservations(store_id,job_id,cost_kind,policy_version,operation,idempotency_identity,reserved_cost_units)
   VALUES($1,$2,$3,2,'fixture','foreign',1) RETURNING to_jsonb(phase9_usage_reservations)`,[other.storeId,f.jobId,path==='vision'?'vision':'metadata']);
  await fail(db,f);assert.deepEqual(await reservation(db,other),prior);
  assert.deepEqual(await reservation(db,{reservationId:foreign.id}),foreign);await expectUsage(f,'released',0);
 });
 test(`D4 ${path} retry preserves reservation and attempt`,async()=>{
  const f=await fresh(db,path);await evidence(db,f,'unsent');const prior=await reservation(db,f);
  await fail(db,f,'timeout',true);assert.deepEqual(await reservation(db,f),prior);assert.equal((await job(f)).status,'retry_scheduled');assert.equal((await job(f)).attempt_count,1);
 });
 test(`D4 ${path} terminal replay has no further persisted effect`,async()=>{
  const f=await fresh(db,path,2);await evidence(db,f,'unsent');await fail(db,f);const prior=await snapshot(db);
  if(path==='vision')await assert.rejects(fail(db,f),/P9_STATE_CONFLICT/);else assert.equal((await fail(db,f)).status,'replayed');
  assert.deepEqual(await snapshot(db),prior);
 });
 for(const target of ['terminal','suppressed','settlement'])test(`D4 ${path} ${target} failure rolls back entire terminal transaction`,async()=>{
  const f=await fresh(db,path,2);await evidence(db,f,'unsent');const prior=await snapshot(db);
  await resetActor(db);const table=target==='settlement'?'phase9_usage_reservations':'image_extraction_jobs';
  const id=target==='settlement'?f.reservationId:f.jobId;
  await db.exec(`CREATE FUNCTION public.m99_test_abort() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
   IF NEW.id='${id}' THEN ${target==='suppressed'?'RETURN NULL;':"RAISE EXCEPTION 'M99_TEST_ABORT';"} END IF; RETURN NEW; END$$;
   CREATE TRIGGER m99_test_abort BEFORE UPDATE ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.m99_test_abort();`);
  try {await assert.rejects(fail(db,f),target==='suppressed'?/P9_STATE_CONFLICT/:/M99_TEST_ABORT/);assert.deepEqual(await snapshot(db),prior);}
  finally{await resetActor(db);await db.exec(`DROP TRIGGER m99_test_abort ON public.${table}; DROP FUNCTION public.m99_test_abort()`);}
 });
}
for(const path of ['automatic','explicit']) {
 test(`D4 ${path} reservation without lookup or attempt releases`,async()=>{const f=await fresh(db,path);await fail(db,f);await expectUsage(f,'released',0);});
 test(`D4 ${path} linked logical attempt with zero physical calls releases`,async()=>{const f=await fresh(db,path);await metadataAttempt(db,f,'unsent',null,{calls:0});await fail(db,f);await expectUsage(f,'released',0);});
 for(const shape of ['null-egress','legacy'])test(`D4 ${path} ${shape} physical receipt`,async()=>{
  const f=await fresh(db,path);await metadataAttempt(db,f,shape,1.25);await fail(db,f);await expectUsage(f,shape==='legacy'?'consumed':'reserved',shape==='legacy'?1.25:null);
 });
 for(const attempt of [1,5])test(`D5 ${path} technical terminal attempt ${attempt}/5`,async()=>{
  const f=await fresh(db,path,attempt);await fail(db,f);const j=await job(f);assert.equal(j.status,'dead_letter');assert.equal(j.attempt_count,attempt);
  assert.equal(j.last_safe_error_code,attempt===5?'P9_METADATA_ATTEMPTS_EXHAUSTED':'P9_METADATA_TECHNICAL_FAILURE');
 });
 test(`D5 ${path} nontechnical failure remains resolved`,async()=>{const f=await fresh(db,path);await fail(db,f,'provider_disabled');assert.equal((await job(f)).status,'resolved');});
}
for(const [reason,disposition] of [['claim_invalid_before_media_download','stale_rejected'],['media_unavailable','failed'],['claim_invalid_before_provider_egress','stale_rejected']])
 test('D4 vision allowlist '+reason+' settles only at terminal',async()=>{
  const f=await fresh(db,'vision'),id=await visionAttempt(db,f,'registered');await mark(db,f,id,disposition,reason);await expectUsage(f,'reserved',null);
  const prior=await snapshot(db);await mark(db,f,id,disposition,reason);assert.deepEqual(await snapshot(db),prior);
  await fail(db,f);await expectUsage(f,'released',0);
 });
for(const reason of ['rate_limited','timeout','provider_error'])test('D4 vision generic '+reason+' is not unsent proof',async()=>{
 const f=await fresh(db,'vision');await visionAttempt(db,f,reason);await fail(db,f);await expectUsage(f,'reserved',null);
});
for(const shape of ['sent','unknown','rate_limited'])test('C9 mark cannot erase '+shape+' evidence',async()=>{
 const f=await fresh(db,'vision'),id=await visionAttempt(db,f,shape,shape==='sent'?1:null),prior=await snapshot(db);
 await assert.rejects(mark(db,f,id,'failed','media_unavailable'),/P9_STATE_CONFLICT/);assert.deepEqual(await snapshot(db),prior);
});
test('D4 private helper replay is byte-identical',async()=>{
 const f=await fresh(db,'automatic');await evidence(db,f,'registered');await fail(db,f);await expectUsage(f,'reserved',null);
 const prior=await snapshot(db);await resetActor(db);
 await db.query('SELECT marketplace_sec.phase9_settle_terminal_usage_v1($1,$2,$3)',[f.jobId,f.storeId,'metadata']);assert.deepEqual(await snapshot(db),prior);
});
test('R6 all replacement attributes and untouched bodies preserved',async()=>{
 const live=await definitions(db);assert.equal(live.length,db.beforeM99.length);
 assert.equal(live.filter(x=>replaced.includes(x.name)).length,5);
 for(const prior of db.beforeM99){const current=live.find(x=>x.name===prior.name);assert.ok(current,prior.name);
  const {body:oldBody,...oldAttrs}=prior,{body:newBody,...newAttrs}=current;assert.deepEqual(newAttrs,oldAttrs,prior.name);
  if(!replaced.includes(prior.name))assert.equal(newBody,oldBody,prior.name);
 }
 // Exercise every replaced public route in addition to catalog readback.
 const card=await seedCard(db);assert.equal((await choices(card)).candidateId,card.candidateId);
 for(const path of paths){const f=await fresh(db,path,2);await evidence(db,f,'unsent');await fail(db,f);}
});
for(const role of ['anon','authenticated','service_role'])test('C13 private helper denies '+role,async()=>{
 await resetActor(db);assert.equal(await value(db,"SELECT has_function_privilege($1,$2,'EXECUTE')",[role,helper]),false);
 await setActor(db,'',role);await assert.rejects(db.query('SELECT marketplace_sec.phase9_settle_terminal_usage_v1(NULL,NULL,NULL)'),{code:'42501'});
});
test('C13 private helper has no PUBLIC execution path',async()=>{
 await resetActor(db);assert.equal(await value(db,`SELECT NOT EXISTS(SELECT 1 FROM pg_proc p,
  aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=$1::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE')`,[helper]),true);
 await db.exec('CREATE ROLE m99_public_probe NOLOGIN; GRANT USAGE ON SCHEMA marketplace_sec TO m99_public_probe; SET ROLE m99_public_probe');
 try{await assert.rejects(db.query('SELECT marketplace_sec.phase9_settle_terminal_usage_v1(NULL,NULL,NULL)'),{code:'42501'});}
 finally{await resetActor(db);await db.exec('REVOKE USAGE ON SCHEMA marketplace_sec FROM m99_public_probe; DROP ROLE m99_public_probe');}
});
test('M99 installation leaves pre-existing business rows byte-identical',async()=>{
 assert.deepEqual(db.dataAfterM99,db.dataBeforeM99);
 const f=await fresh(db,'automatic');await evidence(db,f,'registered');await fail(db,f);await expectUsage(f,'reserved',null);
});

test('D2 another active owner of the same store cannot read the initiating owner session',async()=>{
 const f=await seedCard(db),owner=randomUUID();await resetActor(db);
 await db.query("INSERT INTO public.store_administrators(store_id,user_id,role,status) VALUES($1,$2,'owner','active')",[f.storeId,owner]);
 await setActor(db,owner);await assert.rejects(choices(f),/P9_OWNER_NOT_AUTHORIZED/);
});
test('D2 candidate must belong to both the authorized session and store',async()=>{
 const f=await seedCard(db),other=await seedCard(db);await resetActor(db);
 // No edition state exists yet; keep the candidate id but deliberately corrupt only its store lineage.
 await db.query('UPDATE public.image_extraction_candidates SET store_id=$1,session_id=$2 WHERE id=$3',[other.storeId,f.sessionId,other.candidateId]);
 await setActor(db,f.ownerId);await assert.rejects(value(db,readSql({...f,candidateId:other.candidateId})),/P9_NOT_FOUND/);
});
test('D2 committed candidate is still ineligible',async()=>{
 const f=await seedCard(db);await inventory(f,[['draft',1]]);
 await db.query('UPDATE public.image_extraction_candidates SET committed_inventory_id=(SELECT id FROM public.store_inventory WHERE store_id=$1 LIMIT 1) WHERE id=$2',[f.storeId,f.candidateId]);
 await setActor(db,f.ownerId);await assert.rejects(choices(f),/P9_STATE_CONFLICT/);
});
for(const path of ['automatic','explicit']) {
 for(const bad of ["normalized_outcome='timeout',logical_outcome='timeout'","retryable=true",
  "edition_egress_started=NULL","status='registered'","provider_request_id='sent-receipt'"])
  test(`D4 ${path} incomplete unsent proof ${bad} stays reserved`,async()=>{
   const f=await fresh(db,path),a=await metadataAttempt(db,f,'unsent');await resetActor(db);
   await db.query('UPDATE public.phase9_metadata_provider_calls SET '+bad+' WHERE id=$1',[a.callIds[0]]);
   await fail(db,f);await expectUsage(f,'reserved',null);
  });
 test(`D4 ${path} cross-job attempt on the reservation stays reserved`,async()=>{
  const f=await fresh(db,path),other=await fresh(db,path),a=await metadataAttempt(db,f,'unsent');await resetActor(db);
  await db.query('UPDATE public.phase9_metadata_lookups SET job_id=$1 WHERE id=$2',[other.jobId,a.lookupId]);
  await fail(db,f);await expectUsage(f,'reserved',null);
 });
}
test('D4 vision sent-only known cost without a pre-egress marker stays reserved',async()=>{
 const f=await fresh(db,'vision');await visionAttempt(db,f,'sent',2);await fail(db,f);await expectUsage(f,'reserved',null);
});
test('D4 vision no persisted mark stays reserved',async()=>{
 const f=await fresh(db,'vision');await fail(db,f);await expectUsage(f,'reserved',null);
});
test('C9 identical marked sent receipt replay preserves all evidence',async()=>{
 const f=await fresh(db,'vision'),id=await visionAttempt(db,f,'sent',2),prior=await snapshot(db);
 await mark(db,f,id,'failed','schema_invalid');assert.deepEqual(await snapshot(db),prior);
});
test('R6 new RPC and private helper have literal owner security search_path and grants',async()=>{
 await resetActor(db);
 for(const [signature,security,volatility] of [[helper,false,'v'],['public.'+counts+'(uuid)',true,'s']]) {
  const attrs=await value(db,`SELECT jsonb_build_object('owner',pg_get_userbyid(proowner),'security',prosecdef,
   'volatility',provolatile,'config',proconfig) FROM pg_proc WHERE oid=$1::regprocedure`,[signature]);
  assert.deepEqual(attrs,{owner:'postgres',security,volatility,config:['search_path=""']});
 }
 const f=await seedCard(db);assert.deepEqual(await rpc(db,counts,[f.storeId]),{total:0,published:0,draft:0,paused:0,lowStock:0,outOfStock:0});
 await resetActor(db);await fail(db,await fresh(db,'automatic')); // Execute the helper through its real authorized terminal caller.
});
for(const path of ['automatic','explicit'])test(`D4 ${path} job call linked to a foreign reservation blocks unsent proof`,async()=>{
 const f=await fresh(db,path),other=await fresh(db,path),a=await metadataAttempt(db,other,'sent',2);
 const prior=await reservation(db,other);
 await db.query('UPDATE public.phase9_metadata_provider_calls SET job_id=$1 WHERE id=$2',[f.jobId,a.callIds[0]]);
 await fail(db,f);await expectUsage(f,'reserved',null);assert.deepEqual(await reservation(db,other),prior);
});
test('D4 vision cross-job sibling is not joined away or charged',async()=>{
 const f=await fresh(db,'vision'),other=await fresh(db,'vision');await evidence(db,f,'unsent');
 const id=await visionAttempt(db,other,'sent',2),prior=await reservation(db,other);
 await db.query('UPDATE public.vision_provider_attempts SET usage_reservation_id=$1 WHERE id=$2',[f.reservationId,id]);
 await fail(db,f);await expectUsage(f,'reserved',null);assert.deepEqual(await reservation(db,other),prior);
});
test('D4 vision later claim with only an earlier pre-egress marker stays reserved',async()=>{
 const f=await fresh(db,'vision',2),prior=await reservation(db,f);
 await visionAttempt(db,f,'unsent',null,1);
 await fail(db,f);await expectUsage(f,'reserved',null);assert.deepEqual(await reservation(db,f),prior);
});
