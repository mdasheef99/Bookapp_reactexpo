import { randomUUID } from 'node:crypto';
import { scalar } from './databaseHarness.mjs';
import {
  createUnit7bDatabase, installTransientProjectionFault, seedPublicationInventory,
} from './unit7bFixture.mjs';

async function run(mode) {
  const db = await createUnit7bDatabase();
  try {
    const fixture = await seedPublicationInventory(db, {
      priceMinor: mode === 'deterministic' ? 0 : 725,
    });
    if (mode === 'transient') await installTransientProjectionFault(db, fixture);
    const commandId = randomUUID();
    const idempotencyKey = `cross-layer-${fixture.inventoryId}`;
    try {
      const data = await scalar(db, `SELECT public.phase9_set_publication_state_v2(
        '${fixture.inventoryId}',1,1,'publish','${idempotencyKey}','${commandId}')`);
      return { fixture, commandId, idempotencyKey, data };
    } catch (error) {
      return { fixture, commandId, idempotencyKey, error: String(error.message) };
    }
  } finally { await db.close(); }
}
const requested = process.argv[2] ?? 'published';
const output = requested === 'all'
  ? Object.fromEntries(await Promise.all(['published', 'transient', 'deterministic']
    .map(async (mode) => [mode, await run(mode)])))
  : await run(requested);
process.stdout.write(JSON.stringify(output));
process.exit(0);
