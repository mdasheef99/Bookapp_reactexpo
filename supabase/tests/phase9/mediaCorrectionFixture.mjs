import fs from 'node:fs';
import { createUnit7bDatabase } from './unit7bFixture.mjs';
import { migrationPath } from './databaseHarness.mjs';

export const mediaCorrectionMigrations = [
  '20260906000057_marketplace_phase9_media_output_intents.sql',
  '20260906000058_marketplace_phase9_media_completion_receipts.sql',
  '20260906000059_marketplace_phase9_media_output_cleanup.sql',
];

export async function createMediaCorrectionDatabase() {
  const db = await createUnit7bDatabase();
  for (const name of mediaCorrectionMigrations) {
    await db.exec(fs.readFileSync(migrationPath(name), 'utf8'));
  }
  return db;
}
