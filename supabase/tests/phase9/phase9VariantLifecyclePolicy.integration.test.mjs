import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { resetActor, scalar, setActor } from './databaseHarness.mjs';
import {
  createVariantOwnerDatabase,
  OWNER,
  resetVariantOwnerFixture,
  STORE,
  TITLE,
} from './variantOwnerFixture.mjs';

let db;
const json = (value) => JSON.stringify(value).replaceAll("'", "''");
const latest =
  '20260729000028_marketplace_phase9_variant_benchmark_evidence_read.sql';
const INVENTORY = '78000000-0000-0000-0000-000000000071';

async function proposalId() {
  return scalar(db, 'SELECT id::text FROM public.phase9_search_variant_proposals');
}

async function ownerDenialReason() {
  await setActor(db, OWNER, 'authenticated');
  return scalar(db, `SELECT automatic_activation_denial_reason
    FROM public.phase9_owner_search_variant_review(
      '${STORE}',NULL,NULL,NULL,NULL,10)`);
}

async function approveExactRollout() {
  await resetActor(db);
  await db.exec(`INSERT INTO public.phase9_search_variant_benchmark_manifests(
    id,dataset_key,dataset_version,dataset_identity,manifest_schema_version,
    language,script,sample_count,fixture_set_sha256,canonicalization_version,
    canonical_manifest
  ) VALUES('79000000-0000-0000-0000-000000000091','kn-spines','v1',
    '${'b'.repeat(64)}','p9-search-variant-benchmark-manifest-v1',
    'kn','Knda',100,'${'c'.repeat(64)}',
    'p9-search-variant-benchmark-canonical-v1','{}');
  INSERT INTO public.phase9_search_variant_benchmark_executions(
    id,execution_identity,manifest_id,model_key,model_version,prompt_version,
    sidecar_schema_version,policy_version,runner_version,result_sha256,
    result_canonicalization_version,metrics,eligible_for_review
  ) VALUES('79000000-0000-0000-0000-000000000092','${'d'.repeat(64)}',
    '79000000-0000-0000-0000-000000000091','fixture_multimodal','2026-07-26',
    'fixture-prompt-v2','search_variant_proposals_v1','fixture-policy-v1',
    'fixture-runner-v1','${'e'.repeat(64)}',
    'p9-search-variant-benchmark-result-canonical-v1','{}',true);
  INSERT INTO public.phase9_search_variant_benchmark_reviews(
    id,execution_id,action,actor_user_id,reason,request_identity
  ) VALUES('79000000-0000-0000-0000-000000000093',
    '79000000-0000-0000-0000-000000000092','approved','${OWNER}',
    'fixture_approved','${'f'.repeat(64)}');
  INSERT INTO public.phase9_search_variant_language_rollouts(
    language,script,policy_version,vision_enabled,romanization_enabled,
    automatic_activation_enabled,approved_review_id,version,updated_by
  ) VALUES('kn','Knda','fixture-policy-v1',true,true,true,
    '79000000-0000-0000-0000-000000000093',2,'${OWNER}')`);
}

before(async () => { db = await createVariantOwnerDatabase(latest); });
beforeEach(async () => resetVariantOwnerFixture(db));
after(async () => db.close());

test('candidate-driven staling advances the Owner concurrency version', async () => {
  const proposal = await proposalId();
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET owner_review_snapshot='${json({
      confirmed_title: {
        confirmed: true, text: 'Changed title', language: 'kn', script: 'Knda',
      },
    })}'::jsonb`);
  assert.equal(await scalar(db, `SELECT lifecycle_version
    FROM public.phase9_search_variant_proposals WHERE id='${proposal}'`), 2);
  await setActor(db, OWNER, 'authenticated');
  await assert.rejects(db.query(`SELECT public.phase9_owner_replace_search_variant(
    '${STORE}','${proposal}',1,'Changed Roman','kn-Latn','Latn',
    'roman_alternative','owner_corrected',NULL,'owner-stale-00000091')`),
  /P9_STALE_VERSION/);
});

test('replacement revalidates current candidate evidence and later refresh stales it', async () => {
  const source = await proposalId();
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET observed_title='Changed title',
      owner_review_snapshot='${json({
      confirmed_title: {
        confirmed: true, text: 'Changed title', language: 'kn', script: 'Knda',
      },
    })}'::jsonb`);
  assert.equal(await scalar(db, `SELECT
    marketplace_sec.phase9_confirmed_variant_source(c,p)->>'text'
    FROM public.phase9_search_variant_proposals p
    JOIN public.image_extraction_candidates c
      ON c.id=p.candidate_id AND c.store_id=p.store_id
    WHERE p.id='${source}'`), 'Changed title');
  await setActor(db, OWNER, 'authenticated');
  const replaced = await scalar(db,
    `SELECT public.phase9_owner_replace_search_variant(
      '${STORE}','${source}',2,'Changed Roman','kn-Latn','Latn',
      'roman_alternative','owner_corrected',NULL,
      'owner-current-evidence-0091')`);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT source_text
    FROM public.phase9_search_variant_proposals
    WHERE id='${replaced.replacement_proposal_id}'`), 'Changed title');
  assert.equal(await scalar(db, `SELECT status
    FROM public.phase9_search_variant_proposals WHERE id='${source}'`), 'rejected');

  await db.exec(`UPDATE public.image_extraction_candidates
    SET observed_title='Newest title',
      owner_review_snapshot='${json({
      confirmed_title: {
        confirmed: true, text: 'Newest title', language: 'kn', script: 'Knda',
      },
    })}'::jsonb`);
  assert.equal(await scalar(db, `SELECT status
    FROM public.phase9_search_variant_proposals
    WHERE id='${replaced.replacement_proposal_id}'`), 'stale');
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_proposals
    WHERE source_proposal_id='${source}'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_proposals
    WHERE candidate_id=(SELECT candidate_id
      FROM public.phase9_search_variant_proposals WHERE id='${source}')
      AND status='active'`), 0);
});

test('candidate staling retracts its alias exactly once and preserves unrelated aliases', async () => {
  const proposal = await proposalId();
  await resetActor(db);
  await db.exec(`INSERT INTO public.store_inventory(
    id,store_id,title,authors,isbn_13,condition,quantity_total,
    quantity_available,selling_price_minor,visibility_status
  ) VALUES('${INVENTORY}','${STORE}','${TITLE}',ARRAY['Fixture Author'],
    '9780006543541','good',1,1,35000,'published');
  UPDATE public.image_extraction_candidates
    SET committed_inventory_id='${INVENTORY}';
  INSERT INTO public.book_search_aliases(
    store_id,inventory_id,alias_text,alias_normalized,alias_language,
    alias_script,alias_type,source_type,source_ref,approval_status,
    approved_at,approved_by
  ) VALUES('${STORE}','${INVENTORY}','Unrelated','unrelated','en','Latn',
    'common_spelling','owner_verified','fixture-unrelated','approved',
    transaction_timestamp(),'${OWNER}')`);
  await setActor(db, OWNER, 'authenticated');
  const approve = `SELECT public.phase9_owner_decide_search_variant(
    '${STORE}','${proposal}',1,'approve','owner_approved',NULL,
    'owner-stale-alias-0091')`;
  await scalar(db, approve);
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET owner_review_snapshot='${json({
      confirmed_title: {
        confirmed: true, text: 'Changed title', language: 'kn', script: 'Knda',
      },
    })}'::jsonb`);
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_alias_links
    WHERE proposal_id='${proposal}' AND retracted_at IS NOT NULL`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_decisions
    WHERE proposal_id='${proposal}'`), 1);
  assert.equal(await scalar(db, `SELECT approval_status
    FROM public.book_search_aliases
    WHERE source_ref='fixture-unrelated'`), 'approved');
  await setActor(db, OWNER, 'authenticated');
  assert.equal((await scalar(db, approve)).replayed, true);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_decisions
    WHERE proposal_id='${proposal}'`), 1);
});

test('Owner denial reason follows exact evidence, policy, mismatch, and revocation', async () => {
  assert.equal(await ownerDenialReason(), 'rollout_not_configured');
  await approveExactRollout();
  assert.equal(await ownerDenialReason(), null);
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_search_variant_proposals
    SET model_version='mismatched'`);
  assert.equal(await ownerDenialReason(), 'rollout_evidence_invalid');
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_search_variant_proposals
    SET model_version='2026-07-26';
    UPDATE public.phase9_search_variant_language_rollouts
    SET automatic_activation_enabled=false`);
  assert.equal(await ownerDenialReason(), 'automatic_activation_disabled');
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_search_variant_language_rollouts
    SET automatic_activation_enabled=true;
    INSERT INTO public.phase9_search_variant_benchmark_reviews(
      execution_id,action,actor_user_id,reason,prior_review_id,request_identity
    ) VALUES('79000000-0000-0000-0000-000000000092','revoked','${OWNER}',
      'fixture_revoked','79000000-0000-0000-0000-000000000093',
      '${'9'.repeat(64)}')`);
  assert.equal(await ownerDenialReason(), 'rollout_evidence_invalid');
});

test('Owner denial reason distinguishes Latin source and trivial text', async () => {
  const proposal = await proposalId();
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_search_variant_proposals
      SET source_script='Latn';
    UPDATE public.image_extraction_candidates
      SET owner_review_snapshot=jsonb_set(
        owner_review_snapshot,'{confirmed_title,script}','"Latn"')`);
  assert.equal(await ownerDenialReason(), 'source_script_ineligible');
  await resetVariantOwnerFixture(db);
  const trivial = await proposalId();
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_search_variant_proposals
    SET variant_text='${TITLE}',variant_normalized='${TITLE}' WHERE id='${trivial}'`);
  assert.equal(await ownerDenialReason(), 'trivial_variant');
});

test('Unit 5C-3 activates only under the exact approved tuple', async () => {
  const proposal = await proposalId();
  await approveExactRollout();
  await setActor(db, OWNER, 'service_role');
  assert.equal(await scalar(db,
    `SELECT public.phase9_search_variant_automatic_activation_allowed(
      '${proposal}','kn','Knda','title','fixture_multimodal','2026-07-26',
      'fixture-prompt-v2','search_variant_proposals_v1')`), true);
  assert.equal((await scalar(db, `SELECT public.phase9_reconcile_search_variants(
    '${STORE}',(SELECT candidate_id FROM public.phase9_search_variant_proposals
      WHERE id='${proposal}'),'{}'::uuid[],'exact_approved_rollout_v1')`))
    .activated_count, 1);
  assert.equal(await scalar(db, `SELECT status
    FROM public.phase9_search_variant_proposals WHERE id='${proposal}'`), 'active');
});

test('Owner approval materializes once and rejection retracts only that alias', async () => {
  const proposal = await proposalId();
  await resetActor(db);
  await db.exec(`INSERT INTO public.store_inventory(
    id,store_id,title,authors,isbn_13,condition,quantity_total,
    quantity_available,selling_price_minor,visibility_status
  ) VALUES('${INVENTORY}','${STORE}','${TITLE}',ARRAY['Fixture Author'],
    '9780006543541','good',1,1,35000,'published');
  UPDATE public.image_extraction_candidates SET committed_inventory_id='${INVENTORY}'`);
  await setActor(db, OWNER, 'authenticated');
  const approve = `SELECT public.phase9_owner_decide_search_variant(
    '${STORE}','${proposal}',1,'approve','owner_approved',NULL,
    'owner-approve-00000091')`;
  await scalar(db, approve);
  await scalar(db, approve);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_alias_links
    WHERE proposal_id='${proposal}' AND retracted_at IS NULL`), 1);
  await setActor(db, OWNER, 'authenticated');
  await scalar(db, `SELECT public.phase9_owner_decide_search_variant(
    '${STORE}','${proposal}',2,'reject','owner_rejected',NULL,
    'owner-reject-00000091')`);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_alias_links
    WHERE proposal_id='${proposal}' AND retracted_at IS NULL`), 0);
});
