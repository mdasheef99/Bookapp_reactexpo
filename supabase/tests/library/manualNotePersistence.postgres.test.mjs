import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../../..');
const migration = path.join(root, 'docs/user/library/evidence/sdd06-live-session-review-2026-10-11/superseded-candidate-20261010172118.sql');
const liveMigrationReceipt = path.join(root, 'docs/user/library/evidence/sdd06-live-session-review-2026-10-11/live-migration.json');
// No URL input is accepted: every connection is hardwired to a fresh loopback cluster.
const binaries = process.env.LIBRARY_PG_BIN;
const modules = process.env.LIBRARY_PG_TOOLS_NODE_MODULES;
assert(binaries && modules, 'Set LIBRARY_PG_BIN and LIBRARY_PG_TOOLS_NODE_MODULES to an existing PostgreSQL 17/pg runtime.');
const require = createRequire(path.join(path.resolve(modules), '__library_runtime__.cjs'));
const { Client } = require('pg');
const native = name => path.join(binaries, name + (process.platform === 'win32' ? '.exe' : ''));
const OWNER='10000000-0000-4000-8000-000000000001', OTHER='10000000-0000-4000-8000-000000000002';
const BOOK='20000000-0000-4000-8000-000000000001', OTHER_BOOK='20000000-0000-4000-8000-000000000002';
const NOTE='30000000-0000-4000-8000-000000000001', OTHER_NOTE='30000000-0000-4000-8000-000000000002';
const OP1='40000000-0000-4000-8000-000000000001', OP2='40000000-0000-4000-8000-000000000002';
let temp, dataDir, port, postgres, admin, logs='', initial;
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
function runNative(name,args) {
 return new Promise((resolve,reject) => {
  const child=spawn(native(name),args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';
  child.stdout.on('data',chunk=>output+=chunk); child.stderr.on('data',chunk=>output+=chunk);
  child.on('error',reject); child.on('exit',code=>code===0?resolve(output):reject(new Error(name+' exited '+code+': '+output)));
 });
}
async function connection(database='postgres') {
 const client=new Client({host:'127.0.0.1',port,database,user:'postgres',connectionTimeoutMillis:2000});
 await client.connect(); return client;
}
async function installBaseline(client,createRoles=false) {
 const fixture=await fs.readFile(path.join(import.meta.dirname,'manualNoteBaseline.sql'),'utf8');
 await client.query(createRoles?fixture:fixture.replace(/CREATE ROLE (anon|authenticated|service_role)[^;]*;/g,''));
 await client.query(await fs.readFile(path.join(root,'supabase/migrations/20260212150120_create_reading_notes.sql'),'utf8'));
 await client.query(await fs.readFile(path.join(root,'supabase/migrations/20260820034004_reading_notes_fk_and_cleanup.sql'),'utf8'));
 await client.query(`ALTER TABLE public.reading_notes ADD CONSTRAINT reading_notes_500w_check CHECK(public.check_note_word_limit(content));
 GRANT ALL ON public.reading_notes TO anon,authenticated,service_role;`);
}
async function isolatedBaseline(database) {
 assert(/^library_[a-z0-9_]+$/.test(database),'Disposable database names must be fixed local identifiers');
 await admin.query('CREATE DATABASE '+database);
 const client=await connection(database);
 try {await installBaseline(client);return client;} catch(error){await client.end();throw error;}
}
async function applyStoredLiveMigration(client) {
 const receipt=JSON.parse(await fs.readFile(liveMigrationReceipt,'utf8'));
 assert.equal(receipt.project_ref,'ahntbtktjjmvfosgkmgn','Stored live SQL must come from the verified BookConnect project');
 const entry=receipt.rows.find(row=>row.version==='20261010221843'&&row.name==='library_manual_note_persistence');
 assert(entry&&entry.statements.length===1,'The exact applied migration statement must be present in the immutable read-only receipt');
 const sql=entry.statements.join('\n');
 assert.equal(createHash('md5').update(sql).digest('hex'),'d187c32b7b0846e735d6696adff6a7ed','Stored SQL must match the fresh live migration hash');
 await client.query(sql);
}
async function assertMigrationAbsent(client) {
 assert.equal((await client.query("SELECT attnotnull FROM pg_attribute WHERE attrelid='reading_notes'::regclass AND attname='tag'")).rows[0].attnotnull,true);
 assert.equal((await client.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='reading_notes' AND column_name IN ('version','last_operation_id')")).rows[0].n,0);
 assert.equal((await client.query("SELECT count(*)::int AS n FROM pg_policy WHERE polrelid='reading_notes'::regclass")).rows[0].n,4);
 assert.equal((await client.query("SELECT to_regprocedure('public.library_manage_note_revision()') AS revision")).rows[0].revision,null);
}
async function asRole(role,actor,fn) {
 const client=await connection();
 try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE '+role);
  await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[actor??'']);
  return await fn(client);
 } finally { await client.query('ROLLBACK'); await client.end(); }
}
const insert=(client,id,tag='reflect',book=BOOK,user=OWNER,content='Body',page=null)=>client.query(
 'INSERT INTO public.reading_notes(id,user_id,user_book_id,content,tag,page_number) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[id,user,book,content,tag,page]);
const rejectsCode=(call,code)=>assert.rejects(call,e=>e.code===code);
before(async()=>{
 temp=await fs.mkdtemp(path.join(os.tmpdir(),'bookconnect-library-notes-pg17-'));
 dataDir=path.join(temp,'data');
 const server=net.createServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 port=server.address().port; await new Promise(resolve=>server.close(resolve));
 await runNative('initdb',['-D',dataDir,'-U','postgres','-A','trust','--no-sync','-E','UTF8','--locale=C']);
 postgres=spawn(native('postgres'),['-D',dataDir,'-p',String(port),'-h','127.0.0.1','-c','fsync=off','-c','full_page_writes=off'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 postgres.stdout.on('data',chunk=>logs+=chunk);postgres.stderr.on('data',chunk=>logs+=chunk);
 for(let attempt=0;attempt<100;attempt++){try{admin=await connection();break;}catch{await sleep(100);}}
 assert(admin,'Fresh loopback PostgreSQL did not start: '+logs);
 const version=Number((await admin.query("SELECT current_setting('server_version_num') AS n")).rows[0].n);
 assert(version>=170000&&version<180000,'This harness requires real PostgreSQL 17');
 await installBaseline(admin,true);
 await admin.query('INSERT INTO auth.users VALUES($1),($2)',[OWNER,OTHER]);
 await admin.query('INSERT INTO books VALUES($1),($2)',[BOOK,OTHER_BOOK]);
 await admin.query('INSERT INTO user_books(id,user_id,book_id) VALUES($1,$2,$1),($3,$4,$3)',[BOOK,OWNER,OTHER_BOOK,OTHER]);
 await insert(admin,NOTE,'quote',BOOK,OWNER,'Existing quote',8);
 await insert(admin,OTHER_NOTE,'reflect',OTHER_BOOK,OTHER,'Other account',null);
 initial=(await admin.query('SELECT id,user_id,user_book_id,content,tag,page_number,created_at,updated_at FROM reading_notes ORDER BY id')).rows;
 await admin.query(await fs.readFile(migration,'utf8'));
 console.log('LOCAL_POSTGRES_VERSION=17 LOCAL_HOST=127.0.0.1 MIGRATION=20261010172118 TEST_DATA=synthetic');
}, {timeout:60000});
after(async()=>{
 if(admin) await admin.end();
 if(postgres){await runNative('pg_ctl',['-D',dataDir,'-m','fast','-w','stop']);}
 if(temp){
  const resolved=path.resolve(temp), parent=path.resolve(os.tmpdir());
  assert(path.dirname(resolved)===parent&&path.basename(resolved).startsWith('bookconnect-library-notes-pg17-'),'Refuse cleanup outside named disposable target');
  await fs.rm(resolved,{recursive:true,force:true});
 }
});
test('upgrades the verified notes projection without changing legacy content or Saved Pages',async()=>{
 const columns=(await admin.query("SELECT column_name,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='reading_notes'")).rows;
 assert.equal(columns.find(x=>x.column_name==='tag').is_nullable,'YES');
 assert(columns.some(x=>x.column_name==='version'));
 const retained=(await admin.query('SELECT id,user_id,user_book_id,content,tag,page_number,created_at,updated_at FROM reading_notes ORDER BY id')).rows;
 assert.deepEqual(retained,initial);
 assert.equal((await admin.query('SELECT full_text FROM user_book_pages')).rows[0].full_text,'Retained passage');
 assert.equal((await admin.query('SELECT version,last_operation_id FROM reading_notes WHERE id=$1',[NOTE])).rows[0].version,1);
});
test('reproduces mutable created_at on the exact applied 20261010221843 variant before correction',async()=>{
 const database='library_live_variant_defect';
 const c=await isolatedBaseline(database);
 let actor;
 try{
  await c.query('INSERT INTO auth.users VALUES($1)',[OWNER]);
  await c.query('INSERT INTO books VALUES($1)',[BOOK]);
  await c.query('INSERT INTO user_books(id,user_id,book_id) VALUES($1,$2,$1)',[BOOK,OWNER]);
  await insert(c,NOTE,'quote',BOOK,OWNER,'Synthetic retained note',8);
  const before=(await c.query('SELECT id,user_id,user_book_id,content,tag,page_number,created_at,updated_at FROM reading_notes WHERE id=$1',[NOTE])).rows[0];
  await applyStoredLiveMigration(c);
  const afterMigration=(await c.query('SELECT id,user_id,user_book_id,content,tag,page_number,created_at,updated_at,version,last_operation_id FROM reading_notes WHERE id=$1',[NOTE])).rows[0];
  assert.deepEqual(Object.fromEntries(Object.keys(before).map(key=>[key,afterMigration[key]])),before,'Applied migration must preserve pre-existing synthetic note fields');
  assert.equal(afterMigration.version,1);
  assert.equal(afterMigration.last_operation_id,null);

  actor=await connection(database);
  await actor.query('BEGIN');
  await actor.query('SET LOCAL ROLE authenticated');
  await actor.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[OWNER]);
  const changed=(await actor.query('UPDATE reading_notes SET created_at=$1 WHERE id=$2 AND user_id=$3 AND user_book_id=$4 RETURNING created_at,updated_at,version',[
   '2000-01-01T00:00:00Z',NOTE,OWNER,BOOK
  ])).rows[0];
  assert(changed,'Owner update must be admitted by the applied variant');
  assert.equal(changed.created_at.toISOString(),'2000-01-01T00:00:00.000Z','Pre-correction live variant exposes client control of creation time');
  assert.notEqual(changed.updated_at.toISOString(),'2000-01-01T00:00:00.000Z','Revision trigger still server-controls updated_at');
  assert.equal(changed.version,2,'Revision trigger still increments version');
  await actor.query('COMMIT');
  const persisted=(await c.query('SELECT created_at,updated_at,version FROM reading_notes WHERE id=$1',[NOTE])).rows[0];
  assert.equal(persisted.created_at.toISOString(),'2000-01-01T00:00:00.000Z','Synthetic local commit confirms the integrity defect is persisted');
  assert.equal(persisted.version,2);
  console.log('RED_PRE_CORRECTION_EVIDENCE=created_at_mutable exact_applied_variant=20261010221843 synthetic_row_only=true');
 }finally{
  if(actor){try{await actor.query('ROLLBACK');}catch{} await actor.end();}
  await c.end();
 }
});
test('round trips all five category identifiers and no category',async()=>{
 for(const [index,tag] of ['quote','reflect','distill','apply','question',null].entries()){
  await asRole('authenticated',OWNER,async client=>{
   const id='31000000-0000-4000-8000-'+String(index+1).padStart(12,'0');
   const row=(await insert(client,id,tag)).rows[0];
   assert.equal(row.tag,tag);assert.equal(row.page_number,null);assert.equal(row.version,1);assert.equal(row.last_operation_id,null);
   assert.equal((await client.query('SELECT tag FROM reading_notes WHERE id=$1',[id])).rows[0].tag,tag);
   const edited=(await client.query('UPDATE reading_notes SET tag=$1,last_operation_id=$2 WHERE id=$3 AND version=1 RETURNING *',[tag,OP1,id])).rows[0];
   assert.equal(edited.tag,tag);assert.equal(edited.version,2);
   await client.query('DELETE FROM reading_notes WHERE id=$1',[id]);
   assert.equal((await client.query('SELECT id FROM reading_notes WHERE id=$1',[id])).rowCount,0);
  });
 }
});
test('rejects invalid category, empty text, excess words and invalid page without altering the original',async()=>{
 for(const [tag,content,page] of [['other','Body',null],['reflect','',null],['reflect','   ',null],['reflect','word '.repeat(501),null],['reflect','word\n\t '.repeat(501),null],['reflect','Body',0],['reflect','Body',-1]]){
  await rejectsCode(()=>asRole('authenticated',OWNER,c=>insert(c,'32000000-0000-4000-8000-000000000001',tag,BOOK,OWNER,content,page)),'23514');
 }
 await asRole('authenticated',OWNER,async c=>{assert.equal((await insert(c,'32000000-0000-4000-8000-000000000002','reflect',BOOK,OWNER,'word '.repeat(500),2147483647)).rows[0].version,1);});
 await rejectsCode(()=>asRole('authenticated',OWNER,c=>c.query("UPDATE reading_notes SET page_number='1.5' WHERE id=$1",[NOTE])),'22P02');
});
test('denies anonymous CRUD and table-wide privileges',async()=>{
 for(const sql of ['SELECT * FROM reading_notes','INSERT INTO reading_notes(content) VALUES(\'Body\')','UPDATE reading_notes SET content=\'x\'','DELETE FROM reading_notes','TRUNCATE reading_notes','TRUNCATE user_books CASCADE']){
  await rejectsCode(()=>asRole('anon',null,c=>c.query(sql)),'42501');
 }
 await rejectsCode(()=>asRole('authenticated',OWNER,c=>c.query('TRUNCATE reading_notes')),'42501');
 await rejectsCode(()=>asRole('authenticated',OWNER,c=>c.query('TRUNCATE user_books CASCADE')),'42501');
 const grants=(await admin.query("SELECT has_table_privilege('authenticated','reading_notes','TRIGGER') AS trigger,has_table_privilege('authenticated','reading_notes','REFERENCES') AS refs,has_table_privilege('authenticated','reading_notes','MAINTAIN') AS maintain")).rows[0];
 assert.deepEqual(grants,{trigger:false,refs:false,maintain:false});
});
test('foreign accounts cannot read, modify or delete a saved note',async()=>{
 await asRole('authenticated',OTHER,async c=>{
  assert.equal((await c.query('SELECT * FROM reading_notes WHERE id=$1',[NOTE])).rowCount,0);
  assert.equal((await c.query('UPDATE reading_notes SET content=$1 WHERE id=$2',['Foreign',NOTE])).rowCount,0);
  assert.equal((await c.query('DELETE FROM reading_notes WHERE id=$1',[NOTE])).rowCount,0);
 });
});
test('rejects foreign-book and foreign-actor insertions',async()=>{
 await rejectsCode(()=>asRole('authenticated',OWNER,c=>insert(c,'33000000-0000-4000-8000-000000000001','reflect',OTHER_BOOK,OWNER)),'42501');
 await rejectsCode(()=>asRole('authenticated',OWNER,c=>insert(c,'33000000-0000-4000-8000-000000000001','reflect',BOOK,OTHER)),'42501');
 await rejectsCode(()=>asRole('service_role',OWNER,c=>insert(c,'33000000-0000-4000-8000-000000000001','reflect',OTHER_BOOK,OWNER)),'23503');
});
test('denies client metadata/identity spoofing while keeping legacy updated_at compatible',async()=>{
 for(const column of ['id','user_id','user_book_id','version','created_at']){
  const value=column==='version'?'99':column==='created_at'?"'2000-01-01'":column==='id'?"'34000000-0000-4000-8000-000000000001'":column==='user_id'?"'"+OTHER+"'":"'"+OTHER_BOOK+"'";
  await rejectsCode(()=>asRole('authenticated',OWNER,c=>c.query('UPDATE reading_notes SET '+column+'='+value+' WHERE id=$1',[NOTE])),'42501');
 }
 await rejectsCode(()=>asRole('authenticated',OWNER,c=>c.query('INSERT INTO reading_notes(id,user_id,user_book_id,content,tag,version) VALUES($1,$2,$3,$4,$5,99)',['34000000-0000-4000-8000-000000000001',OWNER,BOOK,'Body','reflect'])),'42501');
 await asRole('authenticated',OWNER,async c=>{
  const row=(await c.query("UPDATE reading_notes SET content='Legacy',updated_at='2000-01-01' WHERE id=$1 RETURNING *",[NOTE])).rows[0];
  assert.equal(row.version,2);assert.notEqual(row.updated_at.getUTCFullYear(),2000);assert.equal(row.last_operation_id,null);
 });
});
test('trusted metadata is server managed and identity changes also fail for privileged writers',async()=>{
 await asRole('service_role',OWNER,async c=>{
  const row=(await c.query("INSERT INTO reading_notes(id,user_id,user_book_id,content,tag,version,last_operation_id,created_at,updated_at) VALUES($1,$2,$3,'Body','quote',99,$4,'2000-01-01','2000-01-01') RETURNING *",['35000000-0000-4000-8000-000000000001',OWNER,BOOK,OP1])).rows[0];
  assert.equal(row.version,1);assert.equal(row.last_operation_id,null);assert.notEqual(row.created_at.getUTCFullYear(),2000);
 });
 await rejectsCode(()=>asRole('service_role',OWNER,c=>c.query('UPDATE reading_notes SET user_book_id=$1 WHERE id=$2',[OTHER_BOOK,NOTE])),'23514');
});
test('clears a stale operation marker on every unmarked legacy update, including no-op',async()=>{
 await asRole('authenticated',OWNER,async c=>{
  const first=(await c.query('UPDATE reading_notes SET content=$1,last_operation_id=$2 WHERE id=$3 AND version=1 RETURNING *',['Changed',OP1,NOTE])).rows[0];
  assert.equal(first.version,2);assert.equal(first.last_operation_id,OP1);
  const legacy=(await c.query('UPDATE reading_notes SET content=content WHERE id=$1 RETURNING *',[NOTE])).rows[0];
  assert.equal(legacy.version,3);assert.equal(legacy.last_operation_id,null);
  assert.equal((await c.query('UPDATE reading_notes SET content=$1,last_operation_id=$2 WHERE id=$3 AND version=2',['Stale',OP2,NOTE])).rowCount,0);
 });
});
test('the stable create UUID rejects duplicate INSERT without replacing content',async()=>{
 await rejectsCode(()=>asRole('authenticated',OWNER,c=>insert(c,NOTE,'reflect',BOOK,OWNER,'Replacement')),'23505');
 assert.equal((await admin.query('SELECT content FROM reading_notes WHERE id=$1',[NOTE])).rows[0].content,'Existing quote');
});
test('parent owner changes cannot strand notes; parent and account deletion still cascade',async()=>{
 await rejectsCode(()=>admin.query('UPDATE user_books SET user_id=$1 WHERE id=$2',[OTHER,BOOK]),'23503');
 await asRole('authenticated',OWNER,async c=>{await c.query('DELETE FROM user_books WHERE id=$1',[BOOK]);assert.equal((await c.query('SELECT id FROM reading_notes WHERE id=$1',[NOTE])).rowCount,0);});
 await admin.query('BEGIN');try{await admin.query('DELETE FROM auth.users WHERE id=$1',[OTHER]);assert.equal((await admin.query('SELECT id FROM reading_notes WHERE id=$1',[OTHER_NOTE])).rowCount,0);}finally{await admin.query('ROLLBACK');}
});
test('rejects ownership inconsistencies before DDL and rolls back atomically',async()=>{
 // A second isolated database with the same projected baseline; never touch the main test baseline.
 const c=await isolatedBaseline('library_bad_baseline');
 try{
  await c.query('INSERT INTO auth.users VALUES($1),($2)',[OWNER,OTHER]);
  await c.query('INSERT INTO books VALUES($1)',[BOOK]);
  await c.query('INSERT INTO user_books(id,user_id,book_id) VALUES($1,$2,$1)',[BOOK,OTHER]);
  await insert(c,NOTE,'quote',BOOK,OWNER);
  const candidate = await fs.readFile(migration,'utf8');
  await rejectsCode(()=>c.query(candidate),'23514');
  await c.query('ROLLBACK');
  await assertMigrationAbsent(c);
 }finally{await c.end();}
});
test('two competing real connections admit one edit and reject a stale explicit replacement',async()=>{
 const a=await connection(),b=await connection();
 try{
  for(const c of [a,b]){await c.query('BEGIN');await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[OWNER]);}
  const sql='UPDATE reading_notes SET content=$1,last_operation_id=$2 WHERE id=$3 AND user_id=$4 AND user_book_id=$5 AND version=1 RETURNING *';
  const winner=await a.query(sql,['Winner',OP1,NOTE,OWNER,BOOK]);assert.equal(winner.rowCount,1);
  const pid=(await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  const losing=b.query(sql,['Losing',OP2,NOTE,OWNER,BOOK]);let wait;
  for(let i=0;i<100;i++){wait=(await admin.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type;if(wait==='Lock')break;await sleep(10);}
  assert.equal(wait,'Lock','Second connection must genuinely block on the first edit');
  await a.query('COMMIT');assert.equal((await losing).rowCount,0);await b.query('COMMIT');
  const confirmed=(await admin.query('SELECT content,version,last_operation_id FROM reading_notes WHERE id=$1',[NOTE])).rows[0];
  assert.deepEqual(confirmed,{content:'Winner',version:2,last_operation_id:OP1});
  const replacement=await b.query('UPDATE reading_notes SET content=$1,last_operation_id=$2 WHERE id=$3 AND version=1 RETURNING *',['Replace stale comparison',OP2,NOTE]);
  assert.equal(replacement.rowCount,0);
 }finally{for(const c of [a,b]){await c.query('ROLLBACK');await c.end();}}
});

test('refuses a changed same-name constraint instead of silently replacing it',async()=>{
 const c=await isolatedBaseline('library_constraint_baseline');
 try{
  await c.query("ALTER TABLE reading_notes DROP CONSTRAINT reading_notes_tag_check; ALTER TABLE reading_notes ADD CONSTRAINT reading_notes_tag_check CHECK(tag IN ('quote','reflect','distill','apply','unexpected'));");
  const candidate=await fs.readFile(migration,'utf8');
  await assert.rejects(()=>c.query(candidate),/LIBRARY_NOTES_BASELINE_CONSTRAINTS_CHANGED/);
  await c.query('ROLLBACK');
  await assertMigrationAbsent(c);
 }finally{await c.end();}
});

test('refuses word-limit helper body, execution attributes or writer-privilege drift without changing the baseline',async()=>{
 const variants=[
  ['body',"CREATE OR REPLACE FUNCTION public.check_note_word_limit(p_content text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$SELECT true$$;"],
  ['volatility','ALTER FUNCTION public.check_note_word_limit(text) STABLE;'],
  ['path',"ALTER FUNCTION public.check_note_word_limit(text) SET search_path TO public,pg_temp;"],
  ['definer','ALTER FUNCTION public.check_note_word_limit(text) SECURITY DEFINER;'],
  ['execute','REVOKE ALL ON FUNCTION public.check_note_word_limit(text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.check_note_word_limit(text) TO service_role;'],
  ['service','REVOKE ALL ON FUNCTION public.check_note_word_limit(text) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION public.check_note_word_limit(text) TO authenticated;'],
 ];
 const candidate=await fs.readFile(migration,'utf8');
 for(const [name,mutation] of variants){
  const c=await isolatedBaseline('library_helper_'+name);
  try{
   await c.query(mutation);
   if(name==='execute'||name==='service'){
    const privileges=(await c.query("SELECT has_function_privilege('authenticated','public.check_note_word_limit(text)','EXECUTE') AS authenticated,has_function_privilege('service_role','public.check_note_word_limit(text)','EXECUTE') AS service_role")).rows[0];
    assert.deepEqual(privileges,name==='execute'?{authenticated:false,service_role:true}:{authenticated:true,service_role:false});
   }
   await assert.rejects(()=>c.query(candidate),/LIBRARY_NOTES_BASELINE_WORD_HELPER_CHANGED/);
   await c.query('ROLLBACK');
   await assertMigrationAbsent(c);
  }finally{await c.query('ROLLBACK');await c.end();}
 }
});

test('refuses same-name policy predicate, role, command or check drift before replacing policies',async()=>{
 const variants=[
  ['predicate','ALTER POLICY "Users can view own notes" ON public.reading_notes USING (false);'],
  ['role','ALTER POLICY "Users can view own notes" ON public.reading_notes TO authenticated;'],
  ['command','DROP POLICY "Users can view own notes" ON public.reading_notes; CREATE POLICY "Users can view own notes" ON public.reading_notes FOR DELETE USING (auth.uid()=user_id);'],
  ['check','ALTER POLICY "Users can update own notes" ON public.reading_notes WITH CHECK (false);'],
 ];
 const candidate=await fs.readFile(migration,'utf8');
 for(const [name,mutation] of variants){
  const c=await isolatedBaseline('library_policy_'+name);
  try{
   await c.query(mutation);
   const before=(await c.query("SELECT polname,polcmd,polroles,polpermissive,pg_get_expr(polqual,polrelid) AS predicate,pg_get_expr(polwithcheck,polrelid) AS check_expression FROM pg_policy WHERE polrelid='reading_notes'::regclass ORDER BY polname")).rows;
   await assert.rejects(()=>c.query(candidate),/LIBRARY_NOTES_BASELINE_SECURITY_CHANGED/);
   await c.query('ROLLBACK');
   await assertMigrationAbsent(c);
   const after=(await c.query("SELECT polname,polcmd,polroles,polpermissive,pg_get_expr(polqual,polrelid) AS predicate,pg_get_expr(polwithcheck,polrelid) AS check_expression FROM pg_policy WHERE polrelid='reading_notes'::regclass ORDER BY polname")).rows;
   assert.deepEqual(after,before,'Rejected drift must preserve the existing access policy');
  }finally{await c.query('ROLLBACK');await c.end();}
 }
});
// Forward correction cases deliberately start from the exact APPLIED variant,
// not the old candidate used by the historical cases above.
const correction = path.join(root,'supabase/migrations/20261017083830_library_manual_note_privilege_revision_correction.sql');
const JS_WHITESPACE = '\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';
let forwardSequence=0;
async function appliedFixture() {
 const database='library_forward_'+forwardSequence++;
 const c=await isolatedBaseline(database);
 await c.query('INSERT INTO auth.users VALUES($1),($2)',[OWNER,OTHER]);
 await c.query('INSERT INTO books VALUES($1),($2)',[BOOK,OTHER_BOOK]);
 await c.query('INSERT INTO user_books(id,user_id,book_id) VALUES($1,$2,$1),($3,$4,$3)',[BOOK,OWNER,OTHER_BOOK,OTHER]);
 await insert(c,NOTE,'quote',BOOK,OWNER,'Preserved synthetic note',8);
 // Supabase's verified default function grants are environment, not migration SQL.
 await c.query('GRANT EXECUTE ON FUNCTION check_note_word_limit(text) TO anon,authenticated,service_role');
 await c.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role');
 await applyStoredLiveMigration(c);
 const receipt=JSON.parse(await fs.readFile(liveMigrationReceipt,'utf8')).rows[0];
 await c.query('CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[])');
 await c.query('INSERT INTO supabase_migrations.schema_migrations VALUES($1,$2,$3)',[receipt.version,receipt.name,receipt.statements]);
 return {database,c};
}
async function forwardRole(database,role,actor,fn) {
 const c=await connection(database);
 try {await c.query('BEGIN');await c.query('SET LOCAL ROLE '+role);await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[actor??'']);return await fn(c);}
 finally {await c.query('ROLLBACK');await c.end();}
}
async function securitySnapshot(c) {
 return (await c.query(`
 SELECT
 (SELECT jsonb_agg(to_jsonb(n) ORDER BY id) FROM reading_notes n) AS notes,
 (SELECT jsonb_agg(to_jsonb(v) ORDER BY id) FROM user_book_pages v) AS vault,
 (SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM user_books b) AS parent_rows,
 (SELECT jsonb_agg(jsonb_build_array(relname,relrowsecurity,relforcerowsecurity,relacl::text) ORDER BY relname) FROM pg_class WHERE oid IN ('user_books'::regclass,'auth.users'::regclass)) AS parent_security,
 (SELECT jsonb_agg(jsonb_build_array(polname,polcmd,polroles,pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)) ORDER BY polname) FROM pg_policy WHERE polrelid='user_books'::regclass) AS parent_policies,
 (SELECT jsonb_agg(to_jsonb(m) ORDER BY version) FROM supabase_migrations.schema_migrations m) AS ledger,
 (SELECT jsonb_agg(jsonb_build_array(polname,polcmd,polroles,pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)) ORDER BY polname) FROM pg_policy WHERE polrelid='reading_notes'::regclass) AS policies,
 pg_get_functiondef('public.library_manage_note_revision()'::regprocedure) AS revision,
 pg_get_functiondef('public.check_note_word_limit(text)'::regprocedure) AS helper,
 (SELECT jsonb_agg(jsonb_build_array(proname,proacl::text) ORDER BY proname) FROM pg_proc WHERE oid IN ('library_manage_note_revision()'::regprocedure,'check_note_word_limit(text)'::regprocedure)) AS function_acl,
 (SELECT jsonb_agg(jsonb_build_array(tgname,tgenabled,pg_get_triggerdef(oid)) ORDER BY tgname) FROM pg_trigger WHERE tgrelid='reading_notes'::regclass AND NOT tgisinternal) AS triggers,
 (SELECT jsonb_agg(jsonb_build_array(c.conname,t.tgrelid::regclass::text,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) ORDER BY c.conname,t.tgrelid,t.tgtype)
  FROM pg_constraint c JOIN pg_trigger t ON t.tgconstraint=c.oid
  WHERE c.conrelid='reading_notes'::regclass AND c.contype='f') AS fk_triggers,
 (SELECT relacl::text FROM pg_class WHERE oid='reading_notes'::regclass) AS table_acl,
 (SELECT jsonb_agg(jsonb_build_array(attname,attacl::text) ORDER BY attnum) FROM pg_attribute WHERE attrelid='reading_notes'::regclass AND attnum>0 AND NOT attisdropped) AS column_acl,
 (SELECT jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid),convalidated) ORDER BY conname) FROM pg_constraint WHERE conrelid='reading_notes'::regclass) AS constraints,
 (SELECT jsonb_agg(indexdef ORDER BY indexname) FROM pg_indexes WHERE schemaname='public' AND tablename IN ('reading_notes','user_books')) AS indexes
 `)).rows[0];
}
async function correctedFixture(fn) {
 const fixture=await appliedFixture();
 try {const before=await securitySnapshot(fixture.c);await fixture.c.query(await fs.readFile(correction,'utf8'));return await fn({...fixture,before});}
 finally {await fixture.c.query('ROLLBACK');await fixture.c.end();}
}

test('forward correction closes the metadata permission and creation-time defect',async()=>{
 await correctedFixture(async({c,before})=>{
  const p=(await c.query("SELECT has_column_privilege('authenticated','reading_notes','created_at','UPDATE') AS writable")).rows[0];
  assert.equal(p.writable,false,'Authenticated creation metadata must not be writable');
  const row=(await c.query("UPDATE reading_notes SET created_at='2000-01-01',updated_at='2000-01-01',version=99 WHERE id=$1 RETURNING *",[NOTE])).rows[0];
  assert.equal(row.created_at.toISOString(),new Date(before.notes[0].created_at).toISOString());
  assert.equal(row.version,2);assert.notEqual(row.updated_at.getUTCFullYear(),2000);
  const execute=(await c.query("SELECT has_function_privilege('authenticated','library_manage_note_revision()','EXECUTE') AS trigger,has_function_privilege('authenticated','check_note_word_limit(text)','EXECUTE') AS helper")).rows[0];
  assert.deepEqual(execute,{trigger:false,helper:true});
 });
});
test('forward correction preserves every existing row, index and Saved Page',async()=>{
 const {c}=await appliedFixture();
 try {
  await c.query("UPDATE reading_notes SET tag=NULL,last_operation_id=$1 WHERE id=$2",[OP1,NOTE]);
  const before=await securitySnapshot(c);
  await c.query(await fs.readFile(correction,'utf8'));
  const after=await securitySnapshot(c);assert.deepEqual(after.notes,before.notes);assert.deepEqual(after.vault,before.vault);assert.deepEqual(after.indexes,before.indexes);
  assert.deepEqual(after.triggers,before.triggers);
  for(const key of ['fk_triggers','parent_rows','parent_security','parent_policies','ledger']) assert.deepEqual(after[key],before[key],key);
  assert.equal((await c.query("SELECT count(*)::int AS n FROM pg_trigger WHERE tgrelid='reading_notes'::regclass AND NOT tgisinternal")).rows[0].n,1);
  assert.equal((await c.query("SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid='reading_notes'::regclass")).rows[0].n,9);
 } finally {await c.query('ROLLBACK');await c.end();}
});
test('forward correction matches JavaScript whitespace and rejects blank/501-word notes',async()=>{
 await correctedFixture(async({c,database})=>{
  for(const ws of JS_WHITESPACE){
   for(const count of [500,501]){
    const body=Array(count).fill('word').join(ws);
    assert.equal(body.trim().split(/\s+/).length,count);
    assert.equal((await c.query('SELECT check_note_word_limit($1) AS ok',[body])).rows[0].ok,count===500,'word boundary U+'+ws.codePointAt(0).toString(16));
   }
  }
  // NEL is SQL whitespace in some locales, but is not JavaScript whitespace.
  assert.equal((await c.query('SELECT check_note_word_limit($1) AS ok',[Array(501).fill('word').join('\u0085')])).rows[0].ok,true);
  for(const body of ['',JS_WHITESPACE,'\t','\n','\ufeff','\u00a0']){
   await rejectsCode(()=>forwardRole(database,'authenticated',OWNER,x=>insert(x,'36000000-0000-4000-8000-000000000001','quote',BOOK,OWNER,body)),'23514');
  }
  await rejectsCode(()=>forwardRole(database,'authenticated',OWNER,x=>insert(x,'36000000-0000-4000-8000-000000000001','quote',BOOK,OWNER,Array(501).fill('word').join('\ufeff'))),'23514');
 });
});
test('forward correction supports owned CRUD, all categories/null and legacy updated_at',async()=>{
 await correctedFixture(async({database})=>{
  for(const tag of ['quote','reflect','distill','apply','question',null]){
   await forwardRole(database,'authenticated',OWNER,async c=>{
    const id='36000000-0000-4000-8000-000000000001';const added=(await insert(c,id,tag)).rows[0];assert.equal(added.tag,tag);assert.equal(added.version,1);
    const updated=(await c.query("UPDATE reading_notes SET content='Edited',tag=$1,page_number=12,last_operation_id=$2,updated_at='2000-01-01' WHERE id=$3 AND version=1 RETURNING *",[tag,OP1,id])).rows[0];
    assert.equal(updated.version,2);assert.equal(updated.last_operation_id,OP1);assert.notEqual(updated.updated_at.getUTCFullYear(),2000);
    assert.equal((await c.query('DELETE FROM reading_notes WHERE id=$1 RETURNING id',[id])).rowCount,1);
   });
  }
 });
});
test('forward correction denies anonymous, foreign, spoofed metadata and dangerous writes',async()=>{
 await correctedFixture(async({database})=>{
  await rejectsCode(()=>forwardRole(database,'anon',null,c=>c.query('SELECT * FROM reading_notes')),'42501');
  await forwardRole(database,'authenticated',OTHER,async c=>{
   assert.equal((await c.query('SELECT * FROM reading_notes WHERE id=$1',[NOTE])).rowCount,0);
   assert.equal((await c.query("UPDATE reading_notes SET content='Foreign' WHERE id=$1",[NOTE])).rowCount,0);
   assert.equal((await c.query('DELETE FROM reading_notes WHERE id=$1',[NOTE])).rowCount,0);
  });
  await rejectsCode(()=>forwardRole(database,'authenticated',OWNER,c=>insert(c,'36000000-0000-4000-8000-000000000001','quote',OTHER_BOOK)),'42501');
  for(const column of ['id','user_id','user_book_id','version','created_at']){
   await rejectsCode(()=>forwardRole(database,'authenticated',OWNER,c=>c.query('UPDATE reading_notes SET '+column+'='+column+' WHERE id=$1',[NOTE])),'42501');
  }
  await rejectsCode(()=>forwardRole(database,'authenticated',OWNER,c=>c.query('TRUNCATE user_books CASCADE')),'42501');
 });
});

test('forward correction retains trusted-role trigger enforcement without direct EXECUTE',async()=>{
 await correctedFixture(async({database})=>{
  await forwardRole(database,'service_role',null,async c=>{
   const id='36000000-0000-4000-8000-000000000001';
   const added=(await c.query("INSERT INTO reading_notes(id,user_id,user_book_id,content,created_at,updated_at,version,last_operation_id) VALUES($1,$2,$3,'Trusted','2000-01-01','2000-01-01',99,$4) RETURNING *",[id,OWNER,BOOK,OP1])).rows[0];
   assert.equal(added.version,1);assert.equal(added.last_operation_id,null);assert.notEqual(added.created_at.getUTCFullYear(),2000);
   const edited=(await c.query("UPDATE reading_notes SET created_at='2000-01-01',updated_at='2000-01-01',version=99,last_operation_id=$1 WHERE id=$2 RETURNING *",[OP2,id])).rows[0];
   assert.equal(edited.version,2);assert.deepEqual(edited.created_at,added.created_at);assert.notEqual(edited.updated_at.getUTCFullYear(),2000);
  });
  await rejectsCode(()=>forwardRole(database,'service_role',null,c=>c.query('UPDATE reading_notes SET user_id=$1 WHERE id=$2',[OTHER,NOTE])),'23514');
 });
});

test('forward correction rejects forged INSERT metadata, invalid tags and pages',async()=>{
 await correctedFixture(async({database})=>{
  for(const column of ['created_at','updated_at','version','last_operation_id']){
   await rejectsCode(()=>forwardRole(database,'authenticated',OWNER,c=>c.query('INSERT INTO reading_notes(user_id,user_book_id,content,'+column+") VALUES($1,$2,'Forged',DEFAULT)",[OWNER,BOOK])),'42501');
  }
  for(const tag of ['Quote','unknown','']){
   await rejectsCode(()=>forwardRole(database,'authenticated',OWNER,c=>insert(c,'36000000-0000-4000-8000-000000000001',tag)),'23514');
  }
  for(const page of [0,-1]){
   await rejectsCode(()=>forwardRole(database,'authenticated',OWNER,c=>insert(c,'36000000-0000-4000-8000-000000000001','quote',BOOK,OWNER,'Body',page)),'23514');
  }
  await rejectsCode(()=>forwardRole(database,'authenticated',OWNER,c=>insert(c,'36000000-0000-4000-8000-000000000001','quote',BOOK,OTHER)),'42501');
 });
});
test('forward correction rejects a real concurrent stale edit and stale compared replacement',async()=>{
 await correctedFixture(async({c,database})=>{
  const a=await connection(database),b=await connection(database);
  try{
   for(const x of [a,b]){await x.query('BEGIN');await x.query('SET LOCAL ROLE authenticated');await x.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[OWNER]);}
   const sql='UPDATE reading_notes SET content=$1,last_operation_id=$2 WHERE id=$3 AND user_id=$4 AND user_book_id=$5 AND version=1 RETURNING *';
   assert.equal((await a.query(sql,['Winner',OP1,NOTE,OWNER,BOOK])).rowCount,1);
   const pid=(await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
   const loser=b.query(sql,['Loser',OP2,NOTE,OWNER,BOOK]);let wait;
   for(let i=0;i<100;i++){wait=(await c.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type;if(wait==='Lock')break;await sleep(10);}
   assert.equal(wait,'Lock');await a.query('COMMIT');assert.equal((await loser).rowCount,0);await b.query('COMMIT');
   assert.equal((await b.query(sql,['Stale replacement',OP2,NOTE,OWNER,BOOK])).rowCount,0);
   const row=(await c.query('SELECT content,version,last_operation_id FROM reading_notes WHERE id=$1',[NOTE])).rows[0];assert.deepEqual(row,{content:'Winner',version:2,last_operation_id:OP1});
  }finally{for(const x of [a,b]){await x.query('ROLLBACK');await x.end();}}
 });
});
test('forward correction preserves stable UUID/marker semantics and rejects overflow',async()=>{
 await correctedFixture(async({c,database})=>{
  await rejectsCode(()=>forwardRole(database,'authenticated',OWNER,x=>insert(x,NOTE)),'23505');
  await c.query('UPDATE reading_notes SET last_operation_id=$1 WHERE id=$2',[OP1,NOTE]);
  const row=(await c.query('UPDATE reading_notes SET content=content WHERE id=$1 RETURNING version,last_operation_id',[NOTE])).rows[0];assert.equal(row.version,3);assert.equal(row.last_operation_id,null);
  await rejectsCode(()=>c.query("UPDATE user_books SET user_id=$1 WHERE id=$2",[OTHER,BOOK]),'23503');
  // Trigger is disabled only in the synthetic fixture to arrange an integer-boundary row.
  await c.query('ALTER TABLE reading_notes DISABLE TRIGGER reading_notes_manage_revision');
  await c.query('UPDATE reading_notes SET version=2147483647 WHERE id=$1',[NOTE]);
  await c.query('ALTER TABLE reading_notes ENABLE TRIGGER reading_notes_manage_revision');
  await rejectsCode(()=>c.query("UPDATE reading_notes SET content='Overflow' WHERE id=$1",[NOTE]),'22003');
 });
});
test('forward correction rejects baseline drift and restores the complete original variant',async()=>{
 const variants=[
 ['function',"ALTER FUNCTION library_manage_note_revision() SECURITY DEFINER"],
 ['helper',"ALTER FUNCTION check_note_word_limit(text) STABLE"],
 ['policy','ALTER POLICY "Users can view own notes" ON reading_notes USING(false)'],
 ['column',"ALTER TABLE reading_notes ALTER COLUMN tag SET DEFAULT 'quote'"],
 ['constraint','ALTER TABLE reading_notes DROP CONSTRAINT reading_notes_version_positive'],
 ['grant','GRANT SELECT ON reading_notes TO anon'],
 ['ledger',"UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['changed']"]
 ];
 for(const [label,mutation] of variants){
  const {c}=await appliedFixture();
  try{
   await c.query(mutation);const before=await securitySnapshot(c);
   await assert.rejects(async()=>c.query(await fs.readFile(correction,'utf8')),/LIBRARY_NOTE_CORRECTION_/,'drift '+label);
   await c.query('ROLLBACK');assert.deepEqual(await securitySnapshot(c),before,'rollback '+label);
  }finally{await c.query('ROLLBACK');await c.end();}
 }
});

test('forward correction refuses disabled parent ownership enforcement',async()=>{
 const {c}=await appliedFixture();
 try {
  const {tgname}=(await c.query("SELECT t.tgname FROM pg_constraint c JOIN pg_trigger t ON t.tgconstraint=c.oid WHERE c.conrelid='reading_notes'::regclass AND c.conname='reading_notes_book_owner_fkey' AND t.tgrelid='user_books'::regclass AND t.tgtype=17")).rows[0];
  assert.match(tgname,/^RI_ConstraintTrigger_[a-z]_[0-9]+$/);
  await c.query('ALTER TABLE user_books DISABLE TRIGGER "'+tgname+'"');
  const before=await securitySnapshot(c);let error;
  try {await c.query(await fs.readFile(correction,'utf8'));} catch(e){error=e;}
  await c.query('ROLLBACK');
  if(!error){
   await c.query('UPDATE user_books SET user_id=$1 WHERE id=$2',[OTHER,BOOK]);
   const {mismatches}=(await c.query('SELECT count(*)::int AS mismatches FROM reading_notes n JOIN user_books b ON b.id=n.user_book_id WHERE n.user_id<>b.user_id')).rows[0];
   assert.equal(mismatches,1);
   console.log('FK_GUARD_RED=correction_accepted_disabled_parent_trigger owner_mismatch_after_update='+mismatches);
  }
  assert(error,'Correction must reject disabled ownership enforcement before replacing notes definitions');
  assert.match(error.message,/LIBRARY_NOTE_CORRECTION_/);assert.deepEqual(await securitySnapshot(c),before);
 } finally {await c.query('ROLLBACK');await c.end();}
});

test('forward correction rejects all retained FK action/check trigger drift without repair',async()=>{
 const {c}=await appliedFixture();
 try {
  const triggers=(await c.query("SELECT t.tgname,t.tgrelid::regclass::text AS relation,c.conname FROM pg_constraint c JOIN pg_trigger t ON t.tgconstraint=c.oid WHERE c.conrelid='reading_notes'::regclass AND c.contype='f' ORDER BY c.conname,t.tgrelid,t.tgtype")).rows;
  assert.equal(triggers.length,12);
  for(const trigger of [...triggers,{...triggers[0],replica:true}]){
   assert(['reading_notes','user_books','auth.users'].includes(trigger.relation));
   assert.match(trigger.tgname,/^RI_ConstraintTrigger_[a-z]_[0-9]+$/);
   const identifier=trigger.relation+' TRIGGER "'+trigger.tgname+'"';
   const mode=trigger.replica?'ENABLE REPLICA':'DISABLE';
   await c.query('ALTER TABLE '+trigger.relation+' '+mode+' TRIGGER "'+trigger.tgname+'"');
   const before=await securitySnapshot(c);
   await assert.rejects(async()=>c.query(await fs.readFile(correction,'utf8')),/LIBRARY_NOTE_CORRECTION_FK_ENFORCEMENT_CHANGED/);
   await c.query('ROLLBACK');assert.deepEqual(await securitySnapshot(c),before,trigger.conname+' '+identifier);
   await c.query('ALTER TABLE '+trigger.relation+' ENABLE TRIGGER "'+trigger.tgname+'"');
  }
 } finally {await c.query('ROLLBACK');await c.end();}
});

test('forward correction preserves book and account deletion cascades',async()=>{
 await correctedFixture(async({c})=>{
  for(const table of ['user_books','auth.users']){
   await c.query('BEGIN');
   await c.query('DELETE FROM '+table+' WHERE id=$1',[table==='user_books'?BOOK:OWNER]);
   assert.equal((await c.query('SELECT count(*)::int AS n FROM reading_notes WHERE id=$1',[NOTE])).rows[0].n,0);
   await c.query('ROLLBACK');
   assert.equal((await c.query('SELECT count(*)::int AS n FROM reading_notes WHERE id=$1',[NOTE])).rows[0].n,1);
  }
 });
});

test('forward correction refuses hidden column grants and grant options without normalization',async()=>{
 const accepted=[];
 for(const [label,mutation] of [
  ['column_grant','GRANT REFERENCES(content) ON reading_notes TO authenticated'],
  ['table_grant_option','GRANT SELECT ON reading_notes TO authenticated WITH GRANT OPTION'],
  ['function_grant_option','GRANT EXECUTE ON FUNCTION check_note_word_limit(text) TO authenticated WITH GRANT OPTION'],
  ['column_grant_option','GRANT UPDATE(content) ON reading_notes TO authenticated WITH GRANT OPTION']
 ]){
  const {c}=await appliedFixture();
  try {
   await c.query(mutation);const before=await securitySnapshot(c);let error;
   try {await c.query(await fs.readFile(correction,'utf8'));} catch(e){error=e;}
   await c.query('ROLLBACK');
   if(!error){accepted.push(label);continue;}
   assert.match(error.message,/LIBRARY_NOTE_CORRECTION_/);assert.deepEqual(await securitySnapshot(c),before,label);
  } finally {await c.query('ROLLBACK');await c.end();}
 }
 assert.deepEqual(accepted,[],'Every unexpected grant must fail before replacement, preserving its baseline');
});
test('forward correction rejects incompatible stored text without repairing it',async()=>{
 for(const body of ['\t\n',Array(501).fill('word').join('\ufeff')]){
  const {c}=await appliedFixture();
  try{
   await c.query('UPDATE reading_notes SET content=$1 WHERE id=$2',[body,NOTE]);const before=await securitySnapshot(c);
   await rejectsCode(async()=>c.query(await fs.readFile(correction,'utf8')),'23514');await c.query('ROLLBACK');
   assert.deepEqual(await securitySnapshot(c),before);
  }finally{await c.query('ROLLBACK');await c.end();}
 }
});
test('forward correction rolls back after a failure following its actual mutations',async()=>{
 const {c}=await appliedFixture();
 try{const before=await securitySnapshot(c);const sql=(await fs.readFile(correction,'utf8')).replace(/COMMIT;\s*$/,'SELECT 1/0;\nCOMMIT;');
  await rejectsCode(()=>c.query(sql),'22012');await c.query('ROLLBACK');assert.deepEqual(await securitySnapshot(c),before);
 }finally{await c.query('ROLLBACK');await c.end();}
});
test('forward correction lock timeout rolls back without weakening the baseline',async()=>{
 const {c,database}=await appliedFixture();const blocker=await connection(database);
 try{
  const before=await securitySnapshot(c);await blocker.query('BEGIN; LOCK TABLE reading_notes IN ACCESS SHARE MODE');
  const started=Date.now();await rejectsCode(async()=>c.query(await fs.readFile(correction,'utf8')),'55P03');
  assert(Date.now()-started>=4500,'Must exercise the real five-second lock timeout');await c.query('ROLLBACK');await blocker.query('ROLLBACK');
  assert.deepEqual(await securitySnapshot(c),before);
 }finally{await blocker.query('ROLLBACK');await blocker.end();await c.query('ROLLBACK');await c.end();}
});

