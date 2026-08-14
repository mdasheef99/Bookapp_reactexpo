import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { migrationPath } from './databaseHarness.mjs';
import {
  createUnit7bDatabase, seedPublicationInventory, setPublication, state,
} from './unit7bFixture.mjs';

const M42 = '20260814000042_marketplace_phase9_generated_authors_projection.sql';

test('U7B-RT17 publication lets the generated authors projection derive from public_authors', async () => {
  const db = await createUnit7bDatabase();
  try {
    await db.exec(`
      CREATE OR REPLACE FUNCTION public.marketplace_authors_text(p_authors text[])
      RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
        SELECT array_to_string(COALESCE(p_authors, '{}'::text[]), ' ')
      $$;
      ALTER TABLE public.marketplace_book_listings DROP COLUMN authors_text;
      ALTER TABLE public.marketplace_book_listings
        ADD COLUMN authors_text text GENERATED ALWAYS AS (
          public.marketplace_authors_text(public_authors)
        ) STORED;
    `);
    await db.exec(fs.readFileSync(migrationPath(M42), 'utf8'));

    const fixture = await seedPublicationInventory(db, {
      title: 'Generated authors projection',
    });

    assert.equal((await setPublication(db, fixture)).outcome, 'published');
    const publicationState = await state(db, fixture);
    assert.equal(publicationState.listings.length, 1);
    assert.equal(publicationState.listings[0].authors_text, 'Unit 7B Author');
  } finally {
    await db.close();
  }
});
