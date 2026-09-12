import fs from 'node:fs';
import { createMediaCorrectionDatabase } from './mediaCorrectionFixture.mjs';
import { migrationPath } from './databaseHarness.mjs';

export async function createDuplicateConfirmationDatabase() {
  const db = await createMediaCorrectionDatabase();
  await db.exec(fs.readFileSync(migrationPath(
    '20260911000060_marketplace_phase9_duplicate_confirmation.sql',
  ), 'utf8'));
  return db;
}
