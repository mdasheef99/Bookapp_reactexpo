// 02d Unit 1a: compiled worker over the post-install chain (W1/W2).
// Disposable databases only; recorded HTTP; no live provider.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { clean, setActor, value } from './providerReplacementFixture.mjs';
import { automaticWorkerFixture } from './automaticWorkerDatabaseFixture.mjs';
import { readSql } from './editionPickerFixture.mjs';
import { createPrefillDatabase, stateRow } from './automaticPrefillFixture.mjs';

let db;
before(async () => { db = await createPrefillDatabase(); });
beforeEach(async () => { await clean(db); });
after(async () => { await db?.close(); });

// W1: the worker receives the saved prefill and the Owner read is already filled.
test('W1 worker retained OL completion saves the prefill and the read shows it', async () => {
  const receipts = [];
  const fixture = await automaticWorkerFixture(db, {
    provider: 'open_library',
    after: async (name, _parameters, result) => {
      if (name === 'phase9_complete_automatic_metadata_v1') receipts.push(result.data);
      return result;
    },
  });
  assert.deepEqual((await fixture.run()).results, [{ outcome: 'accepted_metadata_match' }]);
  assert.equal(fixture.urls.length, 3);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].status, 'completed');
  assert.equal(receipts[0].prefill.status, 'saved');
  assert.equal(receipts[0].prefill.requestId, fixture.jobId);
  assert.equal(receipts[0].prefill.requestGeneration, 0);
  assert.equal(receipts[0].prefill.optionsVersion, 1);
  const command = fixture.calls.find(call => call.name === 'phase9_complete_automatic_metadata_v1').parameters.p_command;
  const saved = await stateRow(db, fixture.candidateId);
  assert.deepEqual(saved.options, command.result.rows);
  assert.equal(saved.request_id, fixture.jobId);
  await setActor(db, fixture.ownerId);
  const choices = await value(db, readSql(fixture));
  assert.equal(choices.lookupStatus, 'ready');
  assert.equal(choices.optionsVersion, 1);
  assert.equal(choices.requestGeneration, 0);
  assert.equal(choices.queryLanguage, 'en');
  assert.ok(choices.rows.length > 0);
});

// W2: a lost completion response recovers the stored saved prefill, no second GET.
test('W2 lost completion response recovers the saved prefill without a second GET', async () => {
  const completions = [], recoveries = [];
  let lost = false;
  const fixture = await automaticWorkerFixture(db, {
    provider: 'open_library',
    after: async (name, _parameters, result) => {
      if (name === 'phase9_complete_automatic_metadata_v1') {
        completions.push(result.data);
        if (!lost) { lost = true; return { data: null, error: { message: 'lost response' } }; }
      }
      if (name === 'phase9_recover_automatic_metadata_v1') recoveries.push(result.data);
      return result;
    },
  });
  assert.deepEqual((await fixture.run()).results, [{ outcome: 'accepted_metadata_match' }]);
  assert.equal(fixture.urls.length, 3);
  assert.equal(completions.length, 1);
  assert.equal(recoveries.length, 1);
  // The recovered receipt is the stored completion receipt, status normalised only.
  assert.deepEqual(recoveries[0], { ...completions[0], status: 'replayed' });
  assert.equal(recoveries[0].prefill.status, 'saved');
  assert.equal(recoveries[0].prefill.requestId, fixture.jobId);
  const command = fixture.calls.find(call => call.name === 'phase9_complete_automatic_metadata_v1').parameters.p_command;
  const saved = await stateRow(db, fixture.candidateId);
  assert.deepEqual(saved.options, command.result.rows);
  assert.equal(saved.options_version, 1);
  assert.equal(saved.request_generation, 0);
});
