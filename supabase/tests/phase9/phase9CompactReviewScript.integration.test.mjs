// Post-scan SDD-1 §6 / AC4-7: production app validation versus current disposable SQL.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import ts from 'typescript';
import { migrationPath } from './databaseHarness.mjs';
import { createCommitDatabase } from './editionPickerCommitFixture.mjs';

// Load the real TS modules and their dependencies; no app logic is copied or stubbed.
const require = createRequire(import.meta.url);
const previous = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  module._compile(output, filename);
};
let validateCompactReview, fixtures;
let canonicalBcp47, normalizeSafeText, languageScripts, isServerLanguageScriptCoherent;
try {
  ({ validateCompactReview } = require(path.resolve('src/features/imageInventory/review/compactReviewDraft.ts')));
  ({ canonicalBcp47, normalizeSafeText, languageScripts, isServerLanguageScriptCoherent }
    = require(path.resolve('src/features/imageInventory/contracts/ownerUxValidation.ts')));
  fixtures = require(path.resolve('src/features/imageInventory/testing/compactScriptFixtures.ts'));
} finally {
  if (previous) require.extensions['.ts'] = previous;
  else delete require.extensions['.ts'];
}

let db;
before(async () => {
  db = await createCommitDatabase();
  for (const migration of [
    '20261008000070_marketplace_phase9_edition_picker_confirmation.sql',
    '20261010000071_marketplace_phase9_edition_picker_selection_eligibility.sql',
    '20261010000072_marketplace_phase9_edition_picker_superseded_jobs.sql',
    '20261011000073_marketplace_phase9_open_library_edition_options.sql',
    '20261012000074_marketplace_phase9_open_library_author_isolation.sql',
    '20261016000076_marketplace_phase9_edition_explicit_matching.sql',
    '20261017000075_marketplace_phase9_edition_picker_exhausted_lookup_recovery.sql',
    '20261017000077_marketplace_phase9_edition_matching_variants.sql',
  ]) await db.exec(fs.readFileSync(migrationPath(migration), 'utf8'));
});

test('server mirror matches phase9_owner_ux_language_script', async t => {
  for (const input of fixtures.scriptCases) {
    // M29: PGlite's [:alpha:] omits U+0345, so this fixture's denominator
    // differs from the production Unicode-aware locale and JS Alphabetic.
    if (input.name === 'Alphabetic denominator') continue;
    await t.test(input.name, async () => {
      const language = canonicalBcp47(input.language);
      const title = normalizeSafeText(input.title, 512);
      const authors = input.authors.map(author => normalizeSafeText(author, 256));
      const text = [title, ...authors].join(' ');
      const explicit = language.split('-').slice(1).find(part => /^[A-Z][a-z]{3}$/u.test(part));
      for (const script of [explicit, languageScripts[language.split('-')[0]], 'Latn', input.observed]) {
        if (script == null) continue;
        const response = await db.query(
          'SELECT marketplace_sec.phase9_owner_ux_language_script($1,$2,$3) AS accepted',
          [language, script, text],
        );
        assert.equal(isServerLanguageScriptCoherent(text, language, script), response.rows[0].accepted,
          `${input.name}: ${script}`);
      }
    });
  }
});
after(async () => db?.close());

test('app script choice is accepted by phase9_owner_ux_language_script', async t => {
  for (const input of fixtures.scriptCases) await t.test(input.name, async () => {
    const result = validateCompactReview(fixtures.scriptCard(input), fixtures.scriptDefaults, {});
    assert.deepEqual(result.issues, []);
    assert.ok(result.review, 'manual card stays addable');
    assert.equal(result.review.script, input.expected, 'the real app derives the expected choice');
    if (result.review.script === null) return;
    const { originalTitle, authors, originalLanguage, script } = result.review;
    const response = await db.query(
      'SELECT marketplace_sec.phase9_owner_ux_language_script($1,$2,$3) AS accepted',
      [originalLanguage, script, [originalTitle, ...authors].join(' ')],
    );
    assert.equal(response.rows[0].accepted, true);
  });
});
