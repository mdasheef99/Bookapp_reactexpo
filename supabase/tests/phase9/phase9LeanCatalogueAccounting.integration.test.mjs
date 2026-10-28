// 02b sections 5/7.1/11 AC7-23: M78 accounting parity, no HTTP.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { catalogueBatch, completeCatalogueV2, createLeanDatabase, requireM84 } from './leanCatalogueFixture.mjs';
import { enableOL, resetActor } from './catalogueLinkFixture.mjs';
import { complete } from './editionOptionsCompletionFixture.mjs';
const v2 = 'public.phase9_complete_candidate_edition_options_v2(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb,jsonb)';
let db;
before(async () => { db = await createLeanDatabase({m84:true}); });
beforeEach(async () => {
  await resetActor(db); await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE'); await enableOL(db);
});
after(async () => { await db?.close(); });

// Ã‚Â§5 fixes this pure validator's accounting envelope; receipts are synthetic
// inputs to the real postgres-only function, never substitutes for worker RPCs.
async function accountingEnvelope() {
  const f = await catalogueBatch(db), row = structuredClone(f.rows[0]);
  Object.assign(row.metadata,{isbn10:'0306406152',isbn13:'9780306406157',matchRationale:'exact_validated_isbn'});
  const call = (callSequence,callStage) => ({ callSequence,callStage,status:'finalized',egressStarted:true,
    retryable:false,normalizedOutcome:'no_acceptable_match',logicalOutcome:'no_acceptable_match',
    normalizedCandidate:null,matchEvidence:[] });
  const receipts = [call(0,'search'),call(1,'edition')];
  return { providerRole:'primary',primaryAdapterKey:'open_library',predecessorOutcome:null,
    queryKind:'isbn',rows:[row],terminalReceipt:receipts[1],receipts };
}
async function validateAccounting(input) {
  await resetActor(db);
  return (await db.query(`SELECT * FROM marketplace_sec.phase9_catalogue_provider_ids_valid_v1(
    'open_library',NULL,NULL,NULL,NULL,$1)`,[input])).rows[0];
}
test('AC7-23: accounting validator accepts the ISBN search and single-edition stages', async () => {
  const input = await accountingEnvelope(), result = await validateAccounting(input);
  assert.equal(result.valid,true,'M84 accounting mode must accept the M78-valid ISBN receipt');
  assert.equal(result.logical_outcome,'coherent_match');
});
for (const variant of ['bibliographic single-edition stage','missing search','missing edition','unfinalized call','no egress','retryable receipt','failed mandatory stage'])
test(`AC7-23: accounting validator rejects ${variant}`, async () => {
  const input = await accountingEnvelope();
  assert.equal((await validateAccounting(input)).valid,true,'the matching ISBN control must first be admitted');
  if (variant === 'bibliographic single-edition stage') input.queryKind='bibliographic';
  if (variant === 'missing search') input.receipts.shift();
  if (variant === 'missing edition') { input.receipts.pop(); input.terminalReceipt=input.receipts[0]; }
  if (variant === 'unfinalized call') input.receipts[0].status='registered';
  if (variant === 'no egress') input.receipts[0].egressStarted=false;
  if (variant === 'retryable receipt') input.receipts[0].retryable=true;
  if (variant === 'failed mandatory stage') input.receipts[0].normalizedOutcome='malformed_response';
  assert.equal((await validateAccounting(input)).valid,false);
});

const authorFailures = ['malformed_response','unsupported_content_type','response_too_large'];
for (const outcome of authorFailures) {
  test(`[baseline] M78 v1 completes with bounded author-stage ${outcome}`, async () => {
    const f = await catalogueBatch(db,{},null,{authorOutcome:outcome});
    assert.equal((await complete(db,f,{rows:f.rows,fetched:f.fetched,deadline:f.deadline})).status,'completed');
    await resetActor(db);
    const calls = (await db.query(`SELECT edition_call_sequence,edition_call_stage,normalized_outcome
      FROM public.phase9_metadata_provider_calls WHERE logical_attempt_id=$1 ORDER BY edition_call_sequence`,[f.attemptId])).rows;
    assert.deepEqual(calls.map(c => c.normalized_outcome),['no_acceptable_match','no_acceptable_match',outcome]);
    assert.deepEqual(calls.map(c => [c.edition_call_sequence,c.edition_call_stage]),[[0,'search'],[1,'editions'],[2,'author:OL1A']]);
  });
  test(`AC7-23: v2 completes and accounts for bounded author-stage ${outcome}`, async () => {
    await requireM84(db,v2);
    const f = await catalogueBatch(db,{},null,{authorOutcome:outcome});
    assert.equal((await completeCatalogueV2(db,f)).status,'completed'); await resetActor(db);
    const saved = (await db.query(`SELECT a.normalized_outcome,a.disposition,u.status,u.actual_cost_units,
      (SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE logical_attempt_id=a.id) AS calls
      FROM public.metadata_enrichment_attempts a JOIN public.phase9_usage_reservations u ON u.id=a.usage_reservation_id
      WHERE a.id=$1`,[f.attemptId])).rows[0];
    assert.deepEqual({...saved,actual_cost_units:Number(saved.actual_cost_units)},
      {normalized_outcome:'ambiguous_match',disposition:'rejected',status:'consumed',actual_cost_units:0,calls:3});
    const state = (await db.query('SELECT options,options_version FROM public.phase9_candidate_edition_state WHERE candidate_id=$1',[f.candidateId])).rows[0];
    assert.deepEqual(state,{options:f.rows,options_version:1});
  });
  test(`AC7-23: accounting mode accepts author-stage ${outcome} at sequences 2 through 5`, async () => {
    const input = await accountingEnvelope();
    for (let sequence=2;sequence<=5;sequence++) input.receipts.push({
      ...input.receipts[1],callSequence:sequence,callStage:`author:OL${sequence}A`,normalizedOutcome:outcome,logicalOutcome:outcome,
    });
    input.terminalReceipt=input.receipts.at(-1);
    assert.equal((await validateAccounting(input)).valid,true,'M84 must retain every M78 author failure exception');
    assert.equal((await validateAccounting(input)).logical_outcome,'coherent_match');
  });
}
for (const [label,stage,sequence] of [
  ['search failure','search',0],['edition failure','edition',1],['early author','author:OL1A',1],
  ['late author','author:OL1A',6],['invalid author grammar','author:OL0A',2],['non-author stage','editions',2],
]) test(`AC7-23: accounting refuses ${label} failure exception`, async () => {
  const input=await accountingEnvelope();
  const author={...input.receipts[1],callSequence:2,callStage:'author:OL1A',
    normalizedOutcome:'malformed_response',logicalOutcome:'malformed_response'};
  input.receipts.push(author); input.terminalReceipt=author;
  assert.equal((await validateAccounting(input)).valid,true,'valid author failure must be admitted first');
  Object.assign(author,{callStage:stage,callSequence:sequence});
  assert.equal((await validateAccounting(input)).valid,false);
});

// AC7-23: these routing cases are M78's provider-role/predecessor matrix.
for (const [label,routing,valid] of [
  ['valid secondary after Google failure',{providerRole:'secondary',primaryAdapterKey:'google_books',predecessorOutcome:'no_acceptable_match'},true],
  ['forged primary adapter',{primaryAdapterKey:'google_books'},false],
  ['forged provider role',{providerRole:'untrusted'},false],
  ['secondary with wrong primary',{providerRole:'secondary',predecessorOutcome:'no_acceptable_match'},false],
  ['secondary after coherent predecessor',{providerRole:'secondary',primaryAdapterKey:'google_books',predecessorOutcome:'coherent_match'},false],
]) test(`AC7-23: accounting ${valid ? 'accepts' : 'rejects'} ${label}`, async () => {
  const input=await accountingEnvelope();
  assert.equal((await validateAccounting(input)).valid,true,'matching primary receipt must first be admitted');
  Object.assign(input,routing);
  const result=await validateAccounting(input);
  assert.equal(result.valid,valid);
  if (valid) assert.equal(result.logical_outcome,'coherent_match');
});
test('AC7-23: accounting rejects an unsupported author failure outcome', async () => {
  const input=await accountingEnvelope();
  const author={...input.receipts[1],callSequence:2,callStage:'author:OL1A',
    normalizedOutcome:'malformed_response',logicalOutcome:'malformed_response'};
  input.receipts.push(author); input.terminalReceipt=author;
  assert.equal((await validateAccounting(input)).valid,true,'bounded author failure must first be admitted');
  Object.assign(author,{normalizedOutcome:'timeout',logicalOutcome:'timeout'});
  assert.equal((await validateAccounting(input)).valid,false);
});
