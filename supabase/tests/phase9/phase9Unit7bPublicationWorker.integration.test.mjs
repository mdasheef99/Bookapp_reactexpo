import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { resetActor, scalar, setActor } from './databaseHarness.mjs';
import {
  createUnit7bDatabase, installTransientProjectionFault, seedPublicationInventory, setPublication,
} from './unit7bFixture.mjs';

function loadProductionWorker() {
  const filename = path.join(process.cwd(), 'workers', 'phase9-publication-worker', 'index.ts');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  Function('exports', 'require', 'module', '__filename', '__dirname', output)(
    module.exports, () => { throw new Error('unexpected worker dependency'); }, module,
    filename, path.dirname(filename),
  );
  return module.exports;
}

function databaseClient(db) {
  return { rpc: async (name, args) => {
    try {
      if (name === 'claim_phase9_publication_jobs') {
        return { data: (await db.query(`SELECT * FROM public.claim_phase9_publication_jobs(
          ${args.p_batch_size},'${args.p_worker}')`)).rows, error: null };
      }
      if (name === 'phase9_retry_publication_worker_v1') {
        return { data: await scalar(db, `SELECT public.phase9_retry_publication_worker_v1(
          '${args.p_inventory_id}',${args.p_expected_publication_intent_version},
          '${args.p_job_id}','${args.p_lease_token}',${args.p_attempt_number},'${args.p_worker}',
          '${args.p_idempotency_key}','${args.p_command_id}')`), error: null };
      }
      if (name === 'phase9_fail_publication_job_v1') {
        return { data: await scalar(db, `SELECT public.phase9_fail_publication_job_v1(
          '${args.p_job_id}','${args.p_lease_token}','${args.p_worker}',${args.p_attempt_number},
          '${args.p_category}','${args.p_safe_code}')`), error: null };
      }
      throw new Error(`unexpected RPC ${name}`);
    } catch (error) { return { data: null, error }; }
  } };
}

test('U7B-RT15 production worker reschedules a committed transient database result without retaining its lease', async () => {
  const db = await createUnit7bDatabase();
  try {
    const fixture = await seedPublicationInventory(db);
    await installTransientProjectionFault(db, fixture);
    assert.equal((await setPublication(db, fixture)).outcome, 'committed_publication_failed');
    await setActor(db, fixture.ownerId, 'service_role');
    const { runPublicationWorkerBatch } = loadProductionWorker();
    const result = await runPublicationWorkerBatch(1, {
      workerId: 'publication-worker-0001', workerAuthToken: 'unused',
      serviceClient: databaseClient(db),
    });
    assert.deepEqual(result, { claimed: 1, results: [{ outcome: 'retry_scheduled' }] });
    await resetActor(db);
    const job = (await db.query(`SELECT status,attempt_count,lease_owner,lease_token,
      lease_expires_at,next_attempt_at FROM public.image_extraction_jobs
      WHERE entity_id='${fixture.inventoryId}' AND job_kind='publication_retry'`)).rows[0];
    assert.equal(job.status, 'retry_scheduled'); assert.equal(job.attempt_count, 1);
    assert.equal(job.lease_owner, null); assert.equal(job.lease_token, null);
    assert.equal(job.lease_expires_at, null); assert.ok(Date.parse(job.next_attempt_at) > Date.now());
  } finally { await db.close(); }
});
