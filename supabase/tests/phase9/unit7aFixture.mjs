import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  createPhase9Database, migrationPath, resetActor, scalar, setActor,
} from './databaseHarness.mjs';

export const M39 = '20260812000039_marketplace_phase9_create_only_inventory_commit.sql';
const postM35 = [
  '20260810000037_marketplace_phase9_owner_discovery_scope_correction.sql',
  '20260810000038_marketplace_phase9_metadata_retry_correction.sql',
];

const sqlJson = (value) => JSON.stringify(value).replaceAll("'", "''");

export function reviewedValue(overrides = {}) {
  return {
    originalTitle: 'Owner reviewed title',
    authors: ['Owner Reviewed Author'],
    originalLanguage: 'en',
    script: 'Latn',
    metadataChoice: { mode: 'manual', selectionId: null },
    quantity: 3,
    priceMinor: 725,
    baseCondition: 'very_good',
    damageDisclosure: {
      hasDamage: true,
      damageTypes: ['cover'],
      damageNote: 'Small owner-reviewed cover mark.',
      isSellable: true,
      completeReadableSafe: true,
    },
    shelfLocation: 'Reviewed Shelf B2',
    notes: {
      publicNote: 'Reviewed public note.',
      internalNote: 'Reviewed internal note.',
    },
    publicationIntent: 'private',
    duplicateIntent: null,
    originalFieldConfirmation: { title: true, authors: [true] },
    candidateDisposition: 'reviewed',
    ...overrides,
  };
}

export async function createUnit7aDatabase() {
  const db = await createPhase9Database({
    throughMigration: '20260810000035_marketplace_phase9_single_image_removal.sql',
  });
  for (const migration of postM35) {
    await db.exec(fs.readFileSync(migrationPath(migration), 'utf8'));
  }
  if (fs.existsSync(migrationPath(M39))) {
    await db.exec(fs.readFileSync(migrationPath(M39), 'utf8'));
  }
  return db;
}

export async function seedReviewedCandidate(db, options = {}) {
  await resetActor(db);
  const storeId = randomUUID();
  const ownerId = randomUUID();
  const sessionId = randomUUID();
  const candidateId = randomUUID();
  let review = reviewedValue(options.review);
  await db.exec(`
    INSERT INTO public.stores(id,display_name) VALUES('${storeId}','Unit 7A Store');
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
      VALUES('${storeId}','${ownerId}','owner','${options.ownerStatus ?? 'active'}');
    INSERT INTO public.image_extraction_sessions(
      id,store_id,created_by,status,selected_language,selected_script,
      default_condition,default_location,default_quantity,default_publication)
    VALUES('${sessionId}','${storeId}','${ownerId}','${options.sessionStatus ?? 'active'}',
      'en','Latn','good','Default Shelf',1,'private');
    INSERT INTO public.image_extraction_candidates(
      id,session_id,store_id,candidate_index,observed_title,observed_authors,
      observed_language,observed_script,owner_review_snapshot,review_disposition,
      state,version,metadata_revision,review_ready,review_version,duplicate_advice,
      duplicate_advice_version)
    VALUES('${candidateId}','${sessionId}','${storeId}',1,'Observed title',
      ARRAY['Observed Author'],'en','Latn',
      '${sqlJson({ value: review, confirmed_title: { value: review.originalTitle }, confirmed_authors: review.authors })}'::jsonb,
      'reviewed','ready',1,1,true,1,
      ${options.duplicateAdvice ? `'${sqlJson(options.duplicateAdvice)}'::jsonb` : 'NULL'},
      ${options.duplicateAdvice ? '1' : 'NULL'});
  `);

  let canonicalEditionId = null;
  let canonicalWorkId = null;
  let selectionId = null;
  let isbn13 = null;
  let canonicalDescription = null;
  let canonicalEditionStatement = null;
  let canonicalVolume = null;
  let canonicalFormat = null;
  if (options.selectedMetadata) {
    isbn13 = `978${candidateId.replaceAll('-', '').slice(0, 10)}`;
    canonicalDescription = `Selected canonical description ${candidateId}`;
    canonicalEditionStatement = 'Unit 7A canonical edition';
    canonicalVolume = 'Volume 7A';
    canonicalFormat = 'hardcover';
    const jobId = await scalar(db, `INSERT INTO public.image_extraction_jobs(
      store_id,entity_type,entity_id,job_kind,dedupe_key)
      VALUES('${storeId}','candidate','${candidateId}','metadata_enrich','u7a:${candidateId}')
      RETURNING id::text`);
    const lookupId = await scalar(db, `INSERT INTO public.phase9_metadata_lookups(
      candidate_id,store_id,job_id,query_identity,execution_mode,schema_version,
      lookup_strategy,lookup_contract_version,normalizer_version,routing_policy_version,
      privacy_scope,claim_attempt_number,claim_worker,claim_lease_token_hash,normalized_outcome)
      VALUES('${candidateId}','${storeId}','${jobId}','u7a-selected','local','v1',
        'bibliographic','v1','v1','v1','public_bibliographic',1,
        'unit7a-worker-0001','${'a'.repeat(64)}','local_canonical_match')
      RETURNING id::text`);
    canonicalWorkId = await scalar(db, `INSERT INTO public.canonical_works(
      id,title_normalized,primary_title,primary_authors)
      VALUES(gen_random_uuid(),'selected canonical title ${candidateId}',
        'Selected canonical title ${candidateId}',
        ARRAY['Canonical Author']) RETURNING id::text`);
    canonicalEditionId = await scalar(db, `INSERT INTO public.canonical_editions(
      id,work_id,title,authors,language,isbn_13,publisher,published_date,cover_url,
      page_count,categories,description,edition_statement,volume,format)
      VALUES(gen_random_uuid(),'${canonicalWorkId}','Selected canonical title ${candidateId}',
        ARRAY['Canonical Author'],'en','${isbn13}','Canonical Publisher','2026',
        'https://books.google.com/cover.jpg',321,ARRAY['Fiction'],
        '${canonicalDescription}','${canonicalEditionStatement}',
        '${canonicalVolume}','${canonicalFormat}') RETURNING id::text`);
    selectionId = await scalar(db, `INSERT INTO public.phase9_selected_metadata_snapshots(
      candidate_id,store_id,lookup_id,canonical_edition_id,snapshot_version,
      selection_policy_version,match_evidence,manual_outcome)
      VALUES('${candidateId}','${storeId}','${lookupId}','${canonicalEditionId}',
        'p9-selected-v1','policy-v1','[]','local_canonical_match') RETURNING id::text`);
    review = reviewedValue({
      ...options.review,
      metadataChoice: { mode: 'selected', selectionId },
    });
    await db.exec(`UPDATE public.image_extraction_candidates SET
      selected_metadata_snapshot_id='${selectionId}',canonical_edition_id='${canonicalEditionId}',
      owner_review_snapshot='${sqlJson({ value: review, confirmed_title: { value: review.originalTitle }, confirmed_authors: review.authors })}'::jsonb,
      review_ready=true WHERE id='${candidateId}'`);
    await db.exec(`UPDATE public.image_extraction_candidates SET review_ready=true
      WHERE id='${candidateId}'`);
  }
  const versions = (await db.query(`SELECT version,review_version,metadata_revision
    FROM public.image_extraction_candidates WHERE id='${candidateId}'`)).rows[0];
  await setActor(db, ownerId);
  return {
    storeId, ownerId, sessionId, candidateId, review, selectionId,
    canonicalEditionId, canonicalWorkId, isbn13,
    canonicalDescription, canonicalEditionStatement, canonicalVolume, canonicalFormat,
    candidateVersion: versions.version,
    reviewVersion: versions.review_version,
    metadataRevision: versions.metadata_revision,
  };
}

export function commitSql(fixture, overrides = {}) {
  return `SELECT public.phase9_add_candidate_to_inventory_v1(
    '${overrides.sessionId ?? fixture.sessionId}',
    '${overrides.candidateId ?? fixture.candidateId}',
    ${overrides.candidateVersion ?? fixture.candidateVersion},
    ${overrides.reviewVersion ?? fixture.reviewVersion},
    ${overrides.metadataRevision ?? fixture.metadataRevision},
    '${overrides.idempotencyKey ?? `unit7a-commit-${fixture.candidateId}`}',
    '${overrides.commandId ?? randomUUID()}'
  )`;
}
