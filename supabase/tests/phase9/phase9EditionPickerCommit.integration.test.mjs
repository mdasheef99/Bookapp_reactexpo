// Picker §§5-8/9, EP-AC05/11-16/18-20; Unit 7A §§5-11. Sequential PGlite, not race proof.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { canonicalCard, chosenCard, createCommitDatabase, currentCommitSql, expire, inventory, metadata,
  optionsTruth, originalSelection, readSql, resetActor, reviewValue, row, saveReview, scalar,
  seedCard, seedOptions, selectSql, setActor } from './editionPickerCommitFixture.mjs';
let db;
before(async () => { db = await createCommitDatabase(); });
after(async () => { await db?.close(); });

for (const label of ['single Add', 'Add all per-card command']) {
  test(label + ' stores the exact coherent selection and all saved selling fields privately', async () => {
    const f = await chosenCard(db, { metadata: { publisher: 'Chosen Press', publishedDate: '2019-05',
      description: 'Chosen description', editionStatement: 'Chosen edition', volume: null, format: 'paperback' } });
    const review = await reviewValue(db, f);
    await saveReview(db, f);
    const result = await scalar(db, await currentCommitSql(db, f));
    await resetActor(db);
    const item = await inventory(db, result.inventoryId);
    for (const [field, value] of Object.entries({ title: metadata.title, authors: metadata.authors,
      isbn_10: metadata.isbn10, isbn_13: metadata.isbn13, publisher: 'Chosen Press', published_date: '2019-05',
      description: 'Chosen description', edition_statement: 'Chosen edition', format: 'paperback',
      cover_url: metadata.coverReference, language: 'en', condition: review.baseCondition,
      selling_price_minor: review.priceMinor, quantity_total: review.quantity, quantity_available: review.quantity,
      quantity_reserved: 0, quantity_removed: 0, quantity_sold: 0, shelf_location: review.shelfLocation,
      has_damage: review.damageDisclosure.hasDamage, damage_types: review.damageDisclosure.damageTypes,
      damage_notes: review.damageDisclosure.damageNote, is_sellable: review.damageDisclosure.isSellable,
      internal_notes: review.notes.internalNote, public_notes: review.notes.publicNote,
      visibility_status: 'draft', publication_status: 'private', canonical_edition_id: null, canonical_work_id: null,
      created_from_candidate_id: f.candidateId, extraction_session_id: f.sessionId, created_by: f.ownerId })) {
      assert.deepEqual(item[field], value, field);
    }
    const state = await optionsTruth(db, f);
    assert.deepEqual(state.options, []);
    assert.equal(state.selected_option_snapshot.publisher, 'Chosen Press');
    assert.equal(state.selected_option_snapshot.attemptId, f.saved.rows[0].metadata.attemptId);
    assert.equal(state.selected_source_id, f.saved.rows[0].optionId);
    assert.match(item.metadata_snapshot_version, /edition-selection/);
    assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.marketplace_book_listings'), 0);
  });
}

// Picker §§5-7/9: a controlled choice is durable before any selling review exists.
for (const previousSuggestion of [false, true]) {
  test('before first review save, choice replaces ' + (previousSuggestion ? 'automatic suggestion/cover' : 'pending metadata'), async () => {
    let f=await seedCard(db);
    if (previousSuggestion) f=await originalSelection(db,f);
    const selling=await reviewValue(db,f);
    await resetActor(db);
    await db.query('UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL,review_version=NULL,review_ready=false WHERE id=$1',[f.candidateId]);
    await setActor(db,f.ownerId);
    const saved=await seedOptions(db,f,[row(0,{metadata:{...metadata,publisher:'Chosen new edition',coverReference:null}})]);
    const chosen=await scalar(db,selectSql(f,saved.choices,saved.rows[0].optionId));
    await expire(db,f);
    const detail=await scalar(db,"SELECT public.phase9_owner_candidate_detail_v2('"+f.sessionId+"','"+f.candidateId+"')");
    const batch=await scalar(db,"SELECT public.phase9_owner_batch_review_v1('"+f.sessionId+"')");
    assert.equal(detail.metadata.selectionId,chosen.selection.selectionId);
    assert.deepEqual(detail.metadata.snapshot,chosen.selection.snapshot);
    assert.equal(detail.metadata.canonicalEditionId,null);
    assert.equal(detail.metadata.representativeCover,null);
    assert.equal(batch.items[0].metadataSummary.selectionId,chosen.selection.selectionId);
    assert.equal(batch.items[0].metadataSummary.representativeCover,null);
    for (const value of [detail,batch.items[0]]) {
      assert.equal((value.metadata?.state ?? value.metadataState),'selected');
      assert.equal(value.attentionCodes.includes('metadata_pending'),false);
      assert.equal(value.attentionCodes.includes('metadata_manual_required'),false);
      assert.equal(value.allowedActions.includes('add_to_inventory'),false);
    }
    assert.equal(await reviewValue(db,f),null);
    const readiness=await scalar(db,"SELECT public.phase9_owner_session_readiness_v1('"+f.sessionId+"')");
    assert.equal(readiness.blockerCounts.review_missing,1);
    await assert.rejects(scalar(db,await currentCommitSql(db,f,{reviewVersion:1})),/P9_VERSION_CONFLICT/);
    await resetActor(db);
    assert.equal(await scalar(db,"SELECT count(*)::int FROM public.store_inventory WHERE created_from_candidate_id='"+f.candidateId+"'"),0);
    await setActor(db,f.ownerId);
    await saveReview(db,f,{...selling,originalTitle:metadata.title,authors:metadata.authors,
      originalLanguage:metadata.language,script:metadata.script,originalFieldConfirmation:{title:true,authors:[true,true]},
      metadataChoice:{mode:'edition_option',selectionId:chosen.selection.selectionId}});
    const added=await scalar(db,await currentCommitSql(db,f)); await resetActor(db);
    const item=await inventory(db,added.inventoryId);
    assert.equal(item.publisher,'Chosen new edition'); assert.equal(item.representative_cover,null);
    assert.equal(item.selling_price_minor,selling.priceMinor);
  });
}

test('saved edition drives detail, compact-card attention and readiness after options expire', async () => {
  const f=await chosenCard(db); await expire(db,f); await saveReview(db,f);
  const detail=await scalar(db, "SELECT public.phase9_owner_candidate_detail_v2('"+f.sessionId+"','"+f.candidateId+"')");
  const batch=await scalar(db, "SELECT public.phase9_owner_batch_review_v1('"+f.sessionId+"')");
  for (const value of [detail,batch.items[0]]) {
    assert.equal(value.attentionCodes.includes('metadata_pending'),false);
    assert.equal(value.attentionCodes.includes('metadata_manual_required'),false);
    assert.equal(value.allowedActions.includes('add_to_inventory'),true);
  }
  assert.equal(detail.metadata.state,'selected');
  assert.deepEqual(detail.metadata.snapshot.authors,metadata.authors);
  assert.equal(batch.items[0].metadataState,'selected');
  assert.equal(batch.items[0].metadataSummary.selectionId,f.selected.selection.selectionId);
  const readiness=await scalar(db, "SELECT public.phase9_owner_session_readiness_v1('"+f.sessionId+"')");
  assert.equal(readiness.blockerCounts.metadata_choice_missing,0);
  assert.equal(readiness.nextBlockingCandidateId,null);
});

test('newer selection defeats an old Add without effects', async () => {
  const f = await chosenCard(db); await saveReview(db, f);
  const stale = await currentCommitSql(db, f);
  const current = await scalar(db, readSql(f));
  await scalar(db, selectSql(f, current, f.saved.rows[0].optionId));
  await assert.rejects(scalar(db, stale), /P9_(CANDIDATE_)?VERSION_CONFLICT/);
  await resetActor(db);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.store_inventory WHERE created_from_candidate_id=\'' + f.candidateId + '\''), 0);
  assert.equal((await optionsTruth(db, f)).options.length, 1);
});

test('legacy Save cannot confirm a text-only automatic suggestion, but controlled confirmation can', async () => {
  const f = await originalSelection(db, await seedCard(db, { isbn: null }), true);
  await assert.rejects(saveReview(db, f), /P9_STATE_CONFLICT/);
  const detail = await scalar(db, "SELECT public.phase9_owner_candidate_detail_v2('" + f.sessionId + "','" + f.candidateId + "')");
  assert.equal(detail.allowedActions.includes('add_to_inventory'), false);
  const choices = await scalar(db, readSql(f));
  await scalar(db, selectSql(f, choices, f.selectionId, { source: 'current_suggestion' }));
  await saveReview(db, f);
  assert.equal((await scalar(db, await currentCommitSql(db, f))).outcome, 'committed_private');
});

test('valid manual review remains an alternative to confirming a text suggestion', async () => {
  const f = await originalSelection(db, await seedCard(db, { isbn: null }), true);
  await saveReview(db, f, { ...await reviewValue(db, f), metadataChoice: { mode: 'manual', selectionId: null } });
  const result = await scalar(db, await currentCommitSql(db, f)); await resetActor(db);
  assert.equal((await inventory(db, result.inventoryId)).representative_cover, null);
});

for (const coverReference of [null, metadata.coverReference]) {
  test('edition option cover ' + coverReference + ' cannot inherit automatic representative cover before insertion', async () => {
    const f = await originalSelection(db, await seedCard(db));
    const saved = await seedOptions(db, f, [row(0, { metadata: { ...metadata, coverReference } })]);
    await scalar(db, selectSql(f, saved.choices, saved.rows[0].optionId)); await saveReview(db, f);
    const result = await scalar(db, await currentCommitSql(db, f)); await resetActor(db);
    const item = await inventory(db, result.inventoryId);
    assert.equal(item.cover_url, coverReference); assert.equal(item.representative_cover, null);
  });
}

test('unchanged strong original selected mode retains automatic representative cover', async () => {
  const f = await originalSelection(db, await seedCard(db)); await saveReview(db, f);
  const result = await scalar(db, await currentCommitSql(db, f)); await resetActor(db);
  assert.equal((await inventory(db, result.inventoryId)).representative_cover.sourceRecordId, 'old-alternate');
});

test('unchanged strong local canonical selection preserves canonical references and source fields', async () => {
  const f=await canonicalCard(db), edition=f.edition; await saveReview(db,f);
  const result=await scalar(db,await currentCommitSql(db,f)); await resetActor(db);
  const item=await inventory(db,result.inventoryId);
  for(const field of ['isbn_13','publisher','published_date','description','edition_statement','volume','format'])
    assert.equal(item[field],edition[field],field);
  assert.equal(item.canonical_work_id,f.canonicalWorkId);
  assert.equal(item.canonical_edition_id,f.canonicalEditionId);
});

for(const source of ['edition_option','current_suggestion']) {
  test(source+' detail and inventory canonical identity follow the effective saved choice', async () => {
    const f=await canonicalCard(db);
    const saved=await seedOptions(db,f,[row(0,{metadata:{...metadata,title:f.edition.title,authors:f.edition.authors,isbn10:null,isbn13:f.edition.isbn_13}})]);
    await scalar(db,selectSql(f,saved.choices,source==='edition_option'?saved.rows[0].optionId:f.selectionId,{source}));
    await saveReview(db,f);
    const detail=await scalar(db,"SELECT public.phase9_owner_candidate_detail_v2('"+f.sessionId+"','"+f.candidateId+"')");
    const canonical=source==='current_suggestion'?f.canonicalEditionId:null;
    assert.equal(detail.metadata.canonicalEditionId,canonical);
    assert.equal(detail.metadata.selectionVersion,1);
    const result=await scalar(db,await currentCommitSql(db,f)); await resetActor(db);
    assert.equal((await inventory(db,result.inventoryId)).canonical_edition_id,canonical);
  });
}

test('a cleanup error rolls back inventory, candidate, receipt and options; retry succeeds', async () => {
  const f = await chosenCard(db); await saveReview(db, f); const sql = await currentCommitSql(db, f);
  await resetActor(db);
  await db.exec(`CREATE FUNCTION public.test_reject_picker_clear() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.options='[]' AND OLD.options<>'[]' THEN RAISE EXCEPTION 'fixture_cleanup_failure'; END IF; RETURN NEW; END$$;
    CREATE TRIGGER test_reject_picker_clear BEFORE UPDATE ON public.phase9_candidate_edition_state
    FOR EACH ROW EXECUTE FUNCTION public.test_reject_picker_clear();`);
  await setActor(db, f.ownerId); await assert.rejects(scalar(db, sql), /fixture_cleanup_failure/);
  await resetActor(db);
  assert.equal(await scalar(db, "SELECT count(*)::int FROM public.store_inventory WHERE created_from_candidate_id='" + f.candidateId + "'"), 0);
  assert.equal((await optionsTruth(db, f)).options.length, 1);
  assert.equal(await scalar(db, "SELECT state FROM public.image_extraction_candidates WHERE id='" + f.candidateId + "'"), 'ready');
  assert.equal(await scalar(db, "SELECT count(*)::int FROM public.phase9_idempotency_keys WHERE operation='U7AC01' AND target_ids->>'candidateId'='" + f.candidateId + "'"), 0);
  await db.exec('DROP TRIGGER test_reject_picker_clear ON public.phase9_candidate_edition_state; DROP FUNCTION public.test_reject_picker_clear();');
  await setActor(db, f.ownerId); assert.equal((await scalar(db, sql)).outcome, 'committed_private');
});

test('response-loss replay returns existing inventory once and does not restore options', async () => {
  const f = await chosenCard(db); await saveReview(db, f); const sql = await currentCommitSql(db, f);
  const first = await scalar(db, sql); const replay = await scalar(db, sql);
  assert.deepEqual(replay, first); await resetActor(db);
  assert.equal(await scalar(db, "SELECT count(*)::int FROM public.store_inventory WHERE created_from_candidate_id='" + f.candidateId + "'"), 1);
  assert.deepEqual((await optionsTruth(db, f)).options, []);
});

test('adding one card leaves another independently requested same-book set intact', async () => {
  const first=await chosenCard(db), other=await seedCard(db);
  await resetActor(db);
  await db.query('UPDATE public.image_extraction_candidates SET store_id=$1,session_id=$2,candidate_index=2 WHERE id=$3',
    [first.storeId,first.sessionId,other.candidateId]);
  const second={...other,storeId:first.storeId,sessionId:first.sessionId,ownerId:first.ownerId};
  await setActor(db,first.ownerId);
  const saved=await seedOptions(db,second,[row(0,{metadata:{...metadata,publisher:'Other chosen press'}})]);
  await scalar(db,selectSql(second,saved.choices,saved.rows[0].optionId));
  await saveReview(db,first); await saveReview(db,second);
  const firstResult=await scalar(db,await currentCommitSql(db,first));
  assert.deepEqual((await optionsTruth(db,first)).options,[]);
  assert.deepEqual((await optionsTruth(db,second)).options,saved.rows);
  const secondResult=await scalar(db,await currentCommitSql(db,second));
  assert.notEqual(firstResult.inventoryId,secondResult.inventoryId);
  await resetActor(db);
  assert.equal((await inventory(db,secondResult.inventoryId)).publisher,'Other chosen press');
  assert.equal(await scalar(db,"SELECT count(*)::int FROM public.store_inventory WHERE store_id='"+first.storeId+"'"),2);
});

test('expiry is immediate at read/select and does not erase chosen metadata or selling details', async () => {
  const f = await chosenCard(db); const before = await reviewValue(db, f); await expire(db, f);
  const choices = await scalar(db, readSql(f));
  assert.deepEqual(choices.rows, []); assert.equal(choices.optionsExpiresAt, null);
  assert.deepEqual(choices.selection, f.selected.selection);
  await assert.rejects(scalar(db, selectSql(f, choices, f.saved.rows[0].optionId)), /P9_STATE_CONFLICT/);
  assert.deepEqual(await reviewValue(db, f), before);
  await saveReview(db, f); assert.equal((await scalar(db, await currentCommitSql(db, f))).outcome, 'committed_private');
});

test('existing minute dispatcher physically clears expired sets, keeps selection, and is retry-idempotent', async () => {
  const f = await chosenCard(db); await expire(db, f); await resetActor(db);
  const result = await scalar(db, 'SELECT marketplace_sec.dispatch_phase9_worker_wakes()');
  assert.equal(result.editionOptionsCleanup.failed, 0);
  assert.ok(result.editionOptionsCleanup.cleared >= 1);
  const state = await optionsTruth(db, f); assert.deepEqual(state.options, []);
  assert.equal(state.selected_option_snapshot.title, metadata.title);
  assert.equal(state.source_fetched_at, null); assert.equal(state.options_expires_at, null);
  assert.equal((await scalar(db, 'SELECT marketplace_sec.dispatch_phase9_worker_wakes()')).editionOptionsCleanup.cleared, 0);
});

test('identity replacement and removal physically clear only the affected card', async () => {
  const f = await chosenCard(db); await resetActor(db);
  await db.query('UPDATE public.image_extraction_candidates SET observed_title=$1 WHERE id=$2', ['Different identity', f.candidateId]);
  assert.deepEqual((await optionsTruth(db, f)).options, []);
  const removed = await chosenCard(db); const choices = await scalar(db, readSql(removed));
  await scalar(db, "SELECT public.phase9_owner_remove_candidate_v1('" + removed.sessionId + "','" + removed.candidateId + "'," + choices.candidateVersion + ",'" + randomUUID() + "','" + randomUUID() + "')");
  await resetActor(db); assert.deepEqual((await optionsTruth(db, removed)).options, []);
});
for (const [field, value] of [['observed_authors', ['Replacement Author']], ['observed_language', 'fr']]) {
  test('bibliographic ' + field + ' replacement invalidates saved alternatives', async () => {
    const f = await chosenCard(db); await resetActor(db);
    await db.query('UPDATE public.image_extraction_candidates SET ' + field + '=$1 WHERE id=$2', [value, f.candidateId]);
    assert.deepEqual((await optionsTruth(db, f)).options, []);
  });
}
for (const field of ['originalTitle', 'authors', 'script']) {
  test('Save cannot stitch changed ' + field + ' into a selected coherent edition', async () => {
    const f = await chosenCard(db), review = await reviewValue(db, f);
    const value = field === 'authors' ? ['Different Author', 'Second Author'] : field === 'script' ? null : 'Different title';
    await assert.rejects(saveReview(db, f, { ...review, [field]: value }), /P9_STATE_CONFLICT/);
    assert.deepEqual(await reviewValue(db, f), review);
  });
}
test('old lookup receipts remain slim and unavailable after expiry and Add', async () => {
  const f = await chosenCard(db); await expire(db, f);
  const expired = await scalar(db, f.saved.receiptSql);
  assert.equal(expired.available, false); assert.equal('rows' in expired, false);
  await saveReview(db, f); await scalar(db, await currentCommitSql(db, f));
  await assert.rejects(scalar(db, f.saved.receiptSql), /P9_STATE_CONFLICT/);
  await resetActor(db);
  const receipts = (await db.query("SELECT canonical_response FROM public.phase9_idempotency_keys WHERE operation IN ('EP_LOOKUP_V1','EP_SELECT_V1')")).rows;
  for (const receipt of receipts) assert.equal((receipt.canonical_response.rows ?? []).length, 0);
});
test('cleanup is bounded, leaves the backlog and preserves selected snapshots', async () => {
  const cards = [];
  for (let i=0;i<3;i++) { const f=await chosenCard(db); await expire(db, f); cards.push(f); }
  await resetActor(db);
  const first = await scalar(db, 'SELECT marketplace_sec.phase9_edition_cleanup_due(2)');
  assert.equal(first.cleared, 2); assert.ok(first.remaining >= 1);
  const second = await scalar(db, 'SELECT marketplace_sec.phase9_edition_cleanup_due(100)');
  assert.ok(second.cleared >= 1);
  for (const f of cards) { const state=await optionsTruth(db,f); assert.deepEqual(state.options, []); assert.equal(state.selection_id, f.selected.selection.selectionId); }
});
test('failed scheduled cleanup rolls back and retries through the next ordinary tick', async () => {
  const f=await chosenCard(db); await expire(db,f); await resetActor(db);
  await db.exec(`CREATE FUNCTION public.test_fail_scheduled_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.options='[]' AND OLD.options<>'[]' THEN RAISE EXCEPTION 'synthetic_delete_failure'; END IF; RETURN NEW; END$$;
    CREATE TRIGGER test_fail_scheduled_cleanup BEFORE UPDATE ON public.phase9_candidate_edition_state
    FOR EACH ROW EXECUTE FUNCTION public.test_fail_scheduled_cleanup();`);
  const failed=await scalar(db,'SELECT marketplace_sec.dispatch_phase9_worker_wakes()');
  assert.equal(failed.editionOptionsCleanup.failed,1); assert.equal((await optionsTruth(db,f)).options.length,1);
  await db.exec('DROP TRIGGER test_fail_scheduled_cleanup ON public.phase9_candidate_edition_state; DROP FUNCTION public.test_fail_scheduled_cleanup();');
  const retried=await scalar(db,'SELECT marketplace_sec.dispatch_phase9_worker_wakes()');
  assert.equal(retried.editionOptionsCleanup.failed,0); assert.ok(retried.editionOptionsCleanup.cleared>=1);
  assert.deepEqual((await optionsTruth(db,f)).options,[]);
});
for (const scope of ['candidate','session']) {
  test(scope+' expiry physically clears fresh alternatives and retains the chosen snapshot', async () => {
    const f=await chosenCard(db); await resetActor(db);
    await db.query('UPDATE public.image_extraction_'+(scope==='session'?'sessions':'candidates')
      +" SET expires_at=transaction_timestamp()-interval '1 minute' WHERE id=$1",[scope==='session'?f.sessionId:f.candidateId]);
    await setActor(db,f.ownerId); await assert.rejects(scalar(db,readSql(f)),/P9_STATE_CONFLICT/);
    await resetActor(db); await scalar(db,'SELECT marketplace_sec.dispatch_phase9_worker_wakes()');
    const state=await optionsTruth(db,f); assert.deepEqual(state.options,[]);
    assert.equal(state.selection_id,f.selected.selection.selectionId);
  });
}
test('bounded cleanup reports due session-expiry backlog before the option deadline', async () => {
  const cards=[await chosenCard(db),await chosenCard(db)]; await resetActor(db);
  for(const f of cards) await db.query("UPDATE public.image_extraction_sessions SET expires_at=transaction_timestamp()-interval '1 minute' WHERE id=$1",[f.sessionId]);
  const first=await scalar(db,'SELECT marketplace_sec.phase9_edition_cleanup_due(1)');
  assert.equal(first.cleared,1); assert.ok(first.remaining>=1);
  await scalar(db,'SELECT marketplace_sec.phase9_edition_cleanup_due(100)');
  for(const f of cards) assert.deepEqual((await optionsTruth(db,f)).options,[]);
});

test('private cleanup/resolvers stay inaccessible and Add keeps its authenticated signature', async () => {
  await resetActor(db);
  for (const role of ['anon','authenticated','service_role']) {
    for (const signature of ['marketplace_sec.phase9_edition_cleanup_due(integer)','marketplace_sec.phase9_edition_clear_options(uuid)',
      'marketplace_sec.phase9_edition_saved_choice_valid(public.image_extraction_candidates,jsonb)',
      'marketplace_sec.phase9_edition_projection_selection(public.image_extraction_candidates)','marketplace_sec.dispatch_phase9_worker_wakes()']) {
      assert.equal(await scalar(db,`SELECT has_function_privilege('${role}','${signature}','EXECUTE')`),false,role+' '+signature);
    }
  }
  const signature='public.phase9_add_candidate_to_inventory_v1(uuid,uuid,integer,integer,integer,text,uuid)';
  assert.equal(await scalar(db,`SELECT has_function_privilege('authenticated','${signature}','EXECUTE')`),true);
  for (const role of ['anon','service_role']) assert.equal(await scalar(db,`SELECT has_function_privilege('${role}','${signature}','EXECUTE')`),false);
});