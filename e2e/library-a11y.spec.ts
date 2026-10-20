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

const STATES = [
  'home-list',
  'home-empty',
  'home-error',
  'details-populated',
  'details-no-cover',
  'notes-list',
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
