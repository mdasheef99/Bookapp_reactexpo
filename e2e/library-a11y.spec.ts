import { AxeBuilder } from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  UB,
  NOTE_IDS,
  startLibrarySession,
  openComposer,
  openWrite,
  currentFixtureWrites,
  currentFixtureUnhandledReads,
} from './fixtures/libraryFixture';

test.use({ viewport: { width: 390, height: 844 } });

// The global bottom tab bar is excluded: its contrast is owned by D07-01 / RA-W01.
const TAB_BAR_SELECTOR = '[role="tablist"]';
// Any entry here needs a written justification beside it (the lead decides after the first run).
const DISABLED_RULES: string[] = [];

type RuleSummary = { count: number; impact: string | null; sample: string[] };
type StateSummary = Record<string, RuleSummary>;
type BaselineFile = {
  axeCoreVersion: string;
  recordedOn: string;
  states: Record<string, StateSummary>;
};

const BASELINE_PATH = path.join(__dirname, 'library-a11y.baseline.json');
const UPDATE_MODE = process.env.UPDATE_A11Y_BASELINE === '1';
const collected = new Map<string, StateSummary>();

function loadBaseline(): BaselineFile {
  try {
    const raw = fs.readFileSync(BASELINE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as BaselineFile;
    if (!parsed || typeof parsed !== 'object' || !parsed.states) {
      return { axeCoreVersion: '4.13.0', recordedOn: '', states: {} };
    }
    return parsed;
  } catch {
    return { axeCoreVersion: '4.13.0', recordedOn: '', states: {} };
  }
}

type Violations = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'];

function summarise(violations: Violations): StateSummary {
  const out: StateSummary = {};
  for (const violation of violations) {
    const sample = violation.nodes.slice(0, 3).map(node =>
      node.target
        .map(part => (Array.isArray(part) ? part.join(' ') : String(part)))
        .join(' '),
    );
    out[violation.id] = {
      count: violation.nodes.length,
      impact: violation.impact ?? null,
      sample,
    };
  }
  return out;
}

// Baseline policy: compare ONLY rule ids and counts. New or higher counts fail;
// missing or lower counts fail as fixed (baseline entry must be removed or lowered).
function compareState(state: string, actual: StateSummary, expected: StateSummary | undefined) {
  const base: StateSummary = expected ?? {};
  for (const id of Object.keys(actual).sort()) {
    if (!(id in base)) {
      expect(
        actual[id].count,
        `state "${state}" rule "${id}": expected count 0 (no baseline entry), actual count ${actual[id].count}`,
      ).toBe(0);
    } else if (actual[id].count > base[id].count) {
      expect(
        actual[id].count,
        `state "${state}" rule "${id}": expected count ${base[id].count}, actual count ${actual[id].count}`,
      ).toBe(base[id].count);
    } else if (actual[id].count < base[id].count) {
      expect(
        actual[id].count,
        `state "${state}" rule "${id}": expected count ${base[id].count}, actual count ${actual[id].count} (fixed: remove or lower this entry in e2e/library-a11y.baseline.json by running with UPDATE_A11Y_BASELINE=1)`,
      ).toBe(base[id].count);
    }
  }
  for (const id of Object.keys(base).sort()) {
    if (!(id in actual)) {
      expect(
        0,
        `state "${state}" rule "${id}": expected count ${base[id].count}, actual count 0 (fixed: remove or lower this entry in e2e/library-a11y.baseline.json by running with UPDATE_A11Y_BASELINE=1)`,
      ).toBe(base[id].count);
    }
  }
}

async function runScan(page: Page): Promise<StateSummary> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .exclude(TAB_BAR_SELECTOR)
    .disableRules(DISABLED_RULES)
    .analyze();
  const summary = summarise(results.violations);
  expect(currentFixtureWrites()).toEqual([]);
  expect(currentFixtureUnhandledReads()).toEqual([]);
  return summary;
}

async function reachState(page: Page, state: string, hour: number) {
  if (state === 'home-list') {
    await startLibrarySession(page, {}, hour);
    await expect(page.getByText('My Library').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('The Cover Fixture Book').first()).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1000);
  } else if (state === 'home-empty') {
    await startLibrarySession(page, { userBooks: [] }, hour);
    await expect(page.getByText('My Library').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Your library is empty', { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Add a book to start your shelf.', { exact: true })).toBeVisible();
    await page.waitForTimeout(1500);
  } else if (state === 'home-error') {
    await startLibrarySession(page, { status: { 'user_books:list': 500 } }, hour);
    await expect(page.getByText("Couldn't load your library.", { exact: true })).toBeVisible({ timeout: 25000 });
    await expect(page.getByLabel('Try again', { exact: true })).toBeVisible();
    await page.waitForTimeout(1000);
  } else if (state === 'details-populated') {
    await startLibrarySession(page, {}, hour);
    await page.goto(`/library/${UB.manyNotes}`);
    await expect(page.getByText('Many Notes Fixture Book').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Your notes', { exact: true }).first()).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1000);
  } else if (state === 'details-no-cover') {
    await startLibrarySession(page, {}, hour);
    await page.goto(`/library/${UB.noCover}`);
    await expect(page.getByText('No Cover Fixture').first()).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);
  } else if (state === 'notes-list') {
    await startLibrarySession(page, {}, hour);
    await page.goto(`/library/notes?userBookId=${UB.manyNotes}`);
    await expect(page.getByText(/^\d+ notes?$/).first()).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1000);
  } else if (state === 'notes-swipe') {
    await startLibrarySession(page, {}, hour);
    await page.goto(`/library/notes-swipe?scope=book&userBookId=${UB.manyNotes}`);
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('note-card-slot-0')).toContainText('Many Notes Fixture Book', { timeout: 20000 });
    await page.waitForTimeout(800);
  } else if (state === 'reader') {
    await startLibrarySession(page, {}, hour);
    await page.goto(`/library/note?bookId=${UB.manyNotes}&noteId=${NOTE_IDS.quote}`);
    await expect(page.getByText(/quoted line from the fixture book/i).first()).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(800);
  } else if (state === 'composer-choose') {
    await startLibrarySession(page, {}, hour);
    await openComposer(page, UB.manyNotes);
    await page.waitForTimeout(800);
  } else if (state === 'composer-write') {
    await startLibrarySession(page, {}, hour);
    await openWrite(page, UB.manyNotes);
    await page.waitForTimeout(800);
  }
}

const PHASES = [
  { name: 'daylight', hour: 12 },
  { name: 'golden', hour: 18 },
  { name: 'midnight', hour: 22 },
] as const;

const labelActor = '11111111-1111-4111-8111-111111111111';
const borrowedLabel = { id: 'label-borrowed', user_id: labelActor, name: 'Borrowed', created_at: '2026-10-01', updated_at: '2026-10-01' };
for (const phase of PHASES) {
  test(`${phase.name} organising labels without books`, async ({ page }) => {
    await startLibrarySession(page, { userBooks: [], labels: [borrowedLabel] }, phase.hour);
    await page.getByRole('button', { name: 'Filter books by label', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await runScan(page)).toEqual({});
    await page.getByRole('button', { name: 'Manage', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Rename Borrowed', exact: true })).toBeVisible();
    expect(await runScan(page)).toEqual({});
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Filter books by label', exact: true })).toBeFocused();
  });
}
test('organising labels combine status counts and empty states in list and shelf', async ({ page }) => {
  await startLibrarySession(page, { labels: [borrowedLabel], bookLabels: [{ user_id: labelActor, user_book_id: UB.cover, label_id: borrowedLabel.id, created_at: '2026-10-01' }] });
  await page.getByRole('button', { name: 'Filter books by label', exact: true }).click();
  await page.getByRole('radio', { name: 'Filter by Borrowed', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'All, 1 book', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: /^Finished, 0 books$/ }).click();
  await expect(page.getByText('No Borrowed books', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Shelf view', exact: true }).click();
  await expect(page.getByText('No Borrowed books', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Arrange shelf', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Filter books by label', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Clear label filter', exact: true })).toHaveCount(0);
});

const noteGroup = { ...borrowedLabel, id: 'collection-one', name: 'Lines about grief' };
const collectionItems = [
  { user_id: labelActor, collection_id: noteGroup.id, note_id: NOTE_IDS.quote, added_at: '2026-10-20' },
  { user_id: labelActor, collection_id: noteGroup.id, note_id: NOTE_IDS.cover, added_at: '2026-10-21' },
];
for (const phase of PHASES) {
  test(`${phase.name} organising collections management and opener focus`, async ({ page }) => {
    await startLibrarySession(page, { userBooks: [], notes: [], collections: [noteGroup] }, phase.hour);
    await page.getByRole('button', { name: 'Collections', exact: true }).click();
    await expect(page.getByText('0 notes', { exact: true })).toBeVisible();
    expect(await runScan(page)).toEqual({});
    await page.getByRole('button', { name: `Rename ${noteGroup.name}`, exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Collection name', exact: true })).toHaveValue(noteGroup.name);
    expect(await runScan(page)).toEqual({});
    await page.getByRole('button', { name: 'Back in collections', exact: true }).click();
    await expect(page.getByRole('button', { name: `Rename ${noteGroup.name}`, exact: true })).toBeFocused();
    await page.getByRole('button', { name: `Delete ${noteGroup.name}`, exact: true }).click();
    await expect(page.getByText('Only the collection is deleted. Your notes will be kept.', { exact: true })).toBeVisible();
    expect(await runScan(page)).toEqual({});
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: `Delete ${noteGroup.name}`, exact: true })).toBeFocused();
  });
  test(`${phase.name} organising collection rows reader and dedicated deck`, async ({ page }) => {
    await startLibrarySession(page, { collections: [noteGroup], collectionItems }, phase.hour);
    await page.goto(`/library/collection?collectionId=${noteGroup.id}`);
    await expect(page.getByTestId(`collection-note-${NOTE_IDS.cover}`)).toBeVisible();
    await expect(page.getByTestId(`collection-note-${NOTE_IDS.quote}`)).toBeVisible();
    expect(await runScan(page)).toEqual({});
    await page.getByTestId(`collection-note-${NOTE_IDS.quote}`).click();
    await expect(page.getByRole('button', { name: 'Back to collection', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add to collection', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: noteGroup.name, exact: true })).toHaveAttribute('aria-checked', 'true');
    expect(await runScan(page)).toEqual({});
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
    await page.getByRole('button', { name: 'Swipe through', exact: true }).click();
    await expect(page.getByTestId('note-card-slot-0')).toContainText(/Fixture Book/);
    await expect(page.getByRole('heading', { name: noteGroup.name, exact: true })).toBeVisible();
    expect(await runScan(page)).toEqual({});
    await page.getByTestId('note-card-slot-0').dblclick({ delay: 80 });
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: noteGroup.name, exact: true })).toHaveAttribute('aria-checked', 'true');
  });
}
test('organising collections cap and missing collection recovery', async ({ page }) => {
  await startLibrarySession(page, { collections: Array.from({ length: 25 }, (_, index) => ({ ...noteGroup, id: `g${index}`, name: `Group ${index}` })) });
  await page.goto('/library/collections');
  await expect(page.getByRole('button', { name: 'New collection', exact: true })).toBeDisabled();
  await expect(page.getByText('You have 25 collections. Delete one to create another.', { exact: true })).toBeVisible();
  await page.goto('/library/notes-swipe?scope=collection&collectionId=deleted');
  await expect(page.getByText('This collection no longer exists.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
});
test('organising label arrows browse without dismissing before explicit selection', async ({ page }) => {
  await startLibrarySession(page, { labels: [borrowedLabel, { ...borrowedLabel, id: 'classics', name: 'Classics' }] });
  await page.getByRole('button', { name: 'Filter books by label', exact: true }).click();
  await page.getByRole('radio', { name: 'Filter by Borrowed', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: 'Filter by Classics', exact: true })).toBeFocused();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Labels: Classics', exact: true })).toBeFocused();
});
test('organising collection chips distinguish category names and preserve the book scope', async ({ page }) => {
  const quoteGroup = { ...noteGroup, name: 'Quote' }, otherGroup = { ...noteGroup, id: 'other-group', name: 'Another book' };
  await startLibrarySession(page, { collections: [quoteGroup, otherGroup], collectionItems: [collectionItems[0], { ...collectionItems[1], collection_id: otherGroup.id }] });
  await page.goto(`/library/notes-swipe?scope=book&userBookId=${UB.manyNotes}&order=oldest`);
  await expect(page.getByRole('radio', { name: 'Quote', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Collection: Quote', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Collection: Another book', exact: true })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Collection: Quote', exact: true }).click();
  await expect(page.getByTestId('note-card-slot-0')).toContainText('Many Notes Fixture Book');
  await expect(page.getByRole('radio', { name: 'Collection: Quote', exact: true })).toHaveAttribute('aria-checked', 'true');
  expect(await runScan(page)).toEqual({});
});
for (const height of [560, 640]) {
  test(`organising controls reachable with doubled web text in ${height}px window`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height });
    await startLibrarySession(page);
    await page.goto(`/library/notes-swipe?scope=book&userBookId=${UB.manyNotes}&order=oldest`);
    await expect(page.getByTestId('note-card-slot-0')).toContainText('Many Notes Fixture Book');
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll<HTMLElement>('[class*="css-text"]')].map(node => ({ node, size: parseFloat(getComputedStyle(node).fontSize), line: parseFloat(getComputedStyle(node).lineHeight) }));
      if (sizes.length === 0) throw new Error('expected css-text nodes to double for the 200% check');
      for (const { node, size, line } of sizes) { node.style.fontSize = `${size * 2}px`; if (Number.isFinite(line)) node.style.lineHeight = `${line * 2}px`; }
    });
    for (const label of ['Previous', 'Read full note', 'Add to collection', 'Next']) {
      const control = page.getByRole('button', { name: label, exact: true });
      // Scroll offsets are rounded while flex widths remain fractional in RN Web.
      await control.scrollIntoViewIfNeeded(); await expect(control).toBeInViewport({ ratio: 0.99 });
      if (!(await control.isDisabled())) await control.click({ trial: true });
    }
    await page.getByRole('radio', { name: 'Question', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('radio', { name: 'Question', exact: true })).toBeInViewport({ ratio: 0.99 });
    expect(currentFixtureWrites()).toEqual([]);
  });
}

const STATES = [
  'home-list',
  'home-empty',
  'home-error',
  'details-populated',
  'details-no-cover',
  'notes-list',
  'notes-swipe',
  'reader',
  'composer-choose',
  'composer-write',
] as const;

for (const phase of PHASES) {
  for (const stateName of STATES) {
    const fullName = `${phase.name} ${stateName}`;
    test(fullName, async ({ page }) => {
      await reachState(page, stateName, phase.hour);
      const summary = await runScan(page);
      if (UPDATE_MODE) {
        collected.set(fullName, summary);
        return;
      }
      const baseline = loadBaseline();
      compareState(fullName, summary, baseline.states[fullName]);
    });
  }
}

test.afterAll(() => {
  if (!UPDATE_MODE) return;
  const previous = loadBaseline();
  const nextStates: Record<string, StateSummary> = {};
  for (const name of Object.keys(previous.states).sort()) {
    if (!collected.has(name)) {
      nextStates[name] = previous.states[name];
    }
  }
  for (const [name, summary] of [...collected.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (Object.keys(summary).length > 0) {
      const sorted: StateSummary = {};
      for (const id of Object.keys(summary).sort()) {
        sorted[id] = summary[id];
      }
      nextStates[name] = sorted;
    }
  }
  const sortedStates: Record<string, StateSummary> = {};
  for (const name of Object.keys(nextStates).sort()) {
    sortedStates[name] = nextStates[name];
  }
  const out: BaselineFile = {
    axeCoreVersion: '4.13.0',
    recordedOn: new Date().toISOString().slice(0, 10),
    states: sortedStates,
  };
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(out, null, 2)}\n`);
});
