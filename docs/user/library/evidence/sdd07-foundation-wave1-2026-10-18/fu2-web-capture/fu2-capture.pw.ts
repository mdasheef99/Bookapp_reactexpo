import { expect, test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Deterministic, transport-level fixtures for the Library screen audit.
// Every https request is intercepted. Supabase GET/HEAD reads are answered from
// per-test fixture data; any other method is aborted and recorded as a write.
// Read-only RPCs that the app calls with POST are answered and listed separately.
// Nothing is saved, edited or deleted; no real credentials are used.

const OUT = __dirname;
const SUPA_HOST = 'ahntbtktjjmvfosgkmgn.supabase.co';
const ACTOR = '11111111-1111-4111-8111-111111111111';
const COVER = fs.readFileSync('C:/Users/LEGION/Desktop/Bookconnect4_library/docs/user/library/correction-evidence-20261003/chooser-390.jpg');
const SESSION = {
  access_token: 'fixture-access-token', refresh_token: 'fixture-refresh-token',
  expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
  user: { id: ACTOR, email: 'fixture@booktalks.test', phone: '+911234567890', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
};
const READ_RPC: Record<string, unknown> = {
  check_note_word_limit: true,
  check_page_word_limit: true,
  get_public_book_reviews: [],
};

const LONG_TITLE = 'A Fixture Title Of Roughly One Hundred And Forty Characters Written To Exercise Wrapping, Truncation And Clipping Of Long Book Titles In Cards, Headers And Details';
const LONG_AUTHOR = 'Dr. Evangeline Maximilian Fixture-Hyphenated Longname of the Anglo-Saxon Literary Society and Associates';
const LONG_NOTE = Array.from({ length: 500 }, (_, i) => `reflection${i + 1}`).join(' ');
const OVER_LIMIT = Array.from({ length: 501 }, (_, i) => `pasted${i + 1}`).join(' ');
const PAGE_TEXT = Array.from({ length: 100 }, (_, i) => 'word').join(' ');

const UB = {
  cover: 'aaaaaaaa-0000-4000-8000-000000000001',
  longTitle: 'aaaaaaaa-0000-4000-8000-000000000002',
  noCover: 'aaaaaaaa-0000-4000-8000-000000000003',
  zeroNotes: 'aaaaaaaa-0000-4000-8000-000000000004',
  manyNotes: 'aaaaaaaa-0000-4000-8000-000000000005',
  pages: 'aaaaaaaa-0000-4000-8000-000000000006',
};
const BK = {
  cover: 'bbbbbbbb-0000-4000-8000-000000000001',
  longTitle: 'bbbbbbbb-0000-4000-8000-000000000002',
  noCover: 'bbbbbbbb-0000-4000-8000-000000000003',
  zeroNotes: 'bbbbbbbb-0000-4000-8000-000000000004',
  manyNotes: 'bbbbbbbb-0000-4000-8000-000000000005',
  pages: 'bbbbbbbb-0000-4000-8000-000000000006',
};
const TS = '2026-10-01T00:00:00Z';
const mkBook = (key: keyof typeof BK, title: string, authors: string[], cover: string | null, pages = 300) => ({
  id: BK[key], google_books_id: null, title, subtitle: null, authors, cover_url: cover, description: null,
  page_count: pages, categories: null, publisher: 'Fixture Pub', published_date: '2020', isbn_13: null,
});
const BOOKS = [
  mkBook('cover', 'The Cover Fixture Book', ['Ada Cover'], 'https://covers.fixture.test/cover-1.jpg', 320),
  mkBook('longTitle', LONG_TITLE, [LONG_AUTHOR], null, 480),
  mkBook('noCover', 'No Cover Fixture', ['Nora Blank'], null, 210),
  mkBook('zeroNotes', 'Zero Notes Fixture', ['Zed Empty'], null, 150),
  mkBook('manyNotes', 'Many Notes Fixture Book', ['Mona Notes'], null, 400),
  mkBook('pages', 'Vault Pages Fixture', ['Pia Pages'], null, 260),
];
const mkUB = (key: keyof typeof UB, status: string, ownership = 'owned') => ({
  id: UB[key], user_id: ACTOR, book_id: BK[key], reading_status: status, ownership, condition: 'good',
  rating: null, review: null, review_is_public: false, available_for_lending: false,
  created_at: TS, updated_at: TS, book: BOOKS.find(b => b.id === BK[key]),
});
const USER_BOOKS = [
  mkUB('cover', 'reading'),
  mkUB('longTitle', 'completed'),
  mkUB('noCover', 'completed'),
  mkUB('zeroNotes', 'want_to_read'),
  mkUB('manyNotes', 'reading'),
  mkUB('pages', 'reading'),
];
const NOTE_IDS = {
  cover: 'eeeeeeee-0000-4000-8000-0000000000a1',
  long: 'eeeeeeee-0000-4000-8000-0000000000a2',
  nocover: 'eeeeeeee-0000-4000-8000-0000000000a3',
  quote: 'eeeeeeee-0000-4000-8000-0000000000b1',
  reflect: 'eeeeeeee-0000-4000-8000-0000000000b2',
  distill: 'eeeeeeee-0000-4000-8000-0000000000b3',
  apply: 'eeeeeeee-0000-4000-8000-0000000000b4',
  question: 'eeeeeeee-0000-4000-8000-0000000000b5',
  uncat: 'eeeeeeee-0000-4000-8000-0000000000b6',
  longNote: 'eeeeeeee-0000-4000-8000-0000000000b7',
  missing: 'eeeeeeee-0000-4000-8000-0000000000ff',
};
const mkNote = (id: string, ub: string, tag: string | null, page: number | null, content: string, n: number) => ({
  id, user_id: ACTOR, user_book_id: ub, content, tag, page_number: page, version: 1,
  created_at: `2026-09-${String(10 + n).padStart(2, '0')}T10:00:00Z`, updated_at: `2026-09-${String(10 + n).padStart(2, '0')}T10:00:00Z`,
});
const NOTES = [
  mkNote(NOTE_IDS.cover, UB.cover, 'reflect', 7, 'A note on the cover book, short and plain.', 1),
  mkNote(NOTE_IDS.long, UB.longTitle, 'quote', 1, 'Quoted line from the long-title fixture book.', 2),
  mkNote(NOTE_IDS.nocover, UB.noCover, 'apply', null, 'Apply this idea at work on Monday.', 3),
  mkNote(NOTE_IDS.quote, UB.manyNotes, 'quote', 42, 'A quoted line from the fixture book that should render in the note card.', 4),
  mkNote(NOTE_IDS.reflect, UB.manyNotes, 'reflect', 12, 'Reflection fixture note with page number twelve.', 5),
  mkNote(NOTE_IDS.distill, UB.manyNotes, 'distill', null, 'Takeaway note with no page number.', 6),
  mkNote(NOTE_IDS.apply, UB.manyNotes, 'apply', 88, 'Action note about applying the idea this week.', 7),
  mkNote(NOTE_IDS.question, UB.manyNotes, 'question', 5, 'A question I still have about this chapter?', 8),
  mkNote(NOTE_IDS.uncat, UB.manyNotes, null, null, 'Uncategorised fixture note with no category at all.', 9),
  mkNote(NOTE_IDS.longNote, UB.manyNotes, 'reflect', 3, LONG_NOTE, 10),
];
const PAGES = [{
  id: 'af679a19-5ad1-4c66-882f-aaff467929ed', user_id: ACTOR, user_book_id: UB.pages, page_number: 1,
  content_excerpt: PAGE_TEXT.slice(0, 200), full_text: PAGE_TEXT, word_count: 100, created_at: TS, updated_at: TS,
}];
const PROFILE = { id: 'profile-fixture', user_id: ACTOR, display_name: 'Fixture', username: 'fixture', account_type: 'user', membership_tier: 'free', trust_score: 10 };
const GOOGLE = {
  totalItems: 2,
  items: [
    { id: 'gfix1', volumeInfo: { title: 'Fixture Search Result One', authors: ['Fixture Writer'], imageLinks: { thumbnail: 'https://covers.fixture.test/cover-1.jpg' }, pageCount: 210, publishedDate: '2020', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781111111111' }] } },
    { id: 'gfix2', volumeInfo: { title: 'Fixture Search Result Two', authors: ['Second Writer'], pageCount: 180, publishedDate: '2019' } },
  ],
};
const OPENLIB = { numFound: 1, docs: [{ key: '/works/OL1W', title: 'Fixture Search Result One', author_name: ['Fixture Writer'], cover_i: 1, first_publish_year: 2020, isbn: ['9781111111111'], edition_count: 1 }] };

type Fx = {
  userBooks: any[]; notes: any[]; pages: any[]; books: any[];
  status: Record<string, number>; holds: Record<string, Promise<void>>;
  provider: 'ok' | 'empty' | 'error' | 'hold'; providerHold?: Promise<void>;
  writes: string[]; rpcReads: string[]; authCalls: string[]; externalReads: string[]; unhandledReads: string[];
};
const freshFx = (over: Partial<Fx> = {}): Fx => ({
  userBooks: USER_BOOKS, notes: NOTES, pages: PAGES, books: BOOKS,
  status: {}, holds: {}, provider: 'ok', writes: [], rpcReads: [], authCalls: [], externalReads: [], unhandledReads: [],
  ...over,
});
let fx: Fx = freshFx();
const audit: Array<{ test: string; writes: string[]; rpcReads: string[]; authCalls: string[]; externalReads: string[] }> = [];

function gate(ms = 9000) {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  const timer = setTimeout(() => release(), ms);
  return { promise, release: () => { clearTimeout(timer); release(); } };
}

function applyFilters(rows: any[], sp: URLSearchParams) {
  let out = rows;
  for (const [key, raw] of sp.entries()) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'and', 'or'].includes(key)) continue;
    if (raw.startsWith('eq.')) { const v = raw.slice(3); out = out.filter(r => String(r[key]) === v); }
    else if (raw === 'is.null') out = out.filter(r => r[key] == null);
  }
  return out;
}

async function installRoutes(page: Page) {
  await page.route(/^https:\/\//, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      route.fulfill({ status, contentType: 'application/json', headers, body: method === 'HEAD' ? '' : JSON.stringify(body) });
    const errBody = (status: number) => status === 406
      ? { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows', hint: null }
      : { code: 'FIXTURE', message: 'fixture failure', details: null, hint: null };

    if (url.hostname === 'covers.fixture.test') return route.fulfill({ status: 200, contentType: 'image/jpeg', body: COVER });
    if (url.hostname === 'www.googleapis.com' && url.pathname.startsWith('/books/v1/volumes')) {
      fx.externalReads.push('googleapis GET');
      if (fx.provider === 'error') return json(500, { error: { code: 500, message: 'fixture provider error' } });
      if (fx.provider === 'hold' && fx.providerHold) await fx.providerHold;
      if (fx.provider === 'empty') return json(200, { totalItems: 0, items: [] });
      return json(200, GOOGLE);
    }
    if (url.hostname === 'openlibrary.org' && url.pathname.startsWith('/search.json')) {
      fx.externalReads.push('openlibrary GET');
      if (fx.provider === 'error') return json(500, { error: 'fixture provider error' });
      if (fx.provider === 'hold' && fx.providerHold) await fx.providerHold;
      if (fx.provider === 'empty') return json(200, { numFound: 0, docs: [] });
      return json(200, OPENLIB);
    }
    if (url.hostname !== SUPA_HOST) return route.abort();

    const p = url.pathname;
    if (p === '/auth/v1/otp') { fx.authCalls.push('POST otp'); return json(200, {}); }
    if (p === '/auth/v1/verify' || p === '/auth/v1/token') { fx.authCalls.push(`POST ${p}`); return json(200, SESSION); }
    if (p === '/auth/v1/user') return json(200, SESSION.user);
    if (!p.startsWith('/rest/v1/')) { fx.writes.push(`${method} ${p}`); return route.abort(); }

    const resource = p.slice('/rest/v1/'.length);
    if (method === 'POST' && resource.startsWith('rpc/')) {
      const fn = resource.slice(4);
      if (fn in READ_RPC) { fx.rpcReads.push(`POST ${fn}`); return json(200, READ_RPC[fn]); }
      fx.writes.push(`POST ${p}`); return route.abort();
    }
    if (method !== 'GET' && method !== 'HEAD') { fx.writes.push(`${method} ${p}`); return route.abort(); }

    const sp = url.searchParams;
    const accept = req.headers()['accept'] ?? '';
    const isSingle = accept.includes('application/vnd.pgrst.object+json');
    const key = `${resource}:${isSingle ? 'single' : 'list'}`;
    if (method === 'GET' && fx.holds[key]) await fx.holds[key];
    if (method === 'GET' && fx.status[key]) return json(fx.status[key], errBody(fx.status[key]));

    let rows: any[];
    if (resource === 'user_profiles') rows = [PROFILE];
    else if (resource === 'user_books') rows = applyFilters(fx.userBooks, sp);
    else if (resource === 'books') rows = applyFilters(fx.books, sp);
    else if (resource === 'reading_notes') rows = applyFilters(fx.notes, sp);
    else if (resource === 'user_book_pages') rows = applyFilters(fx.pages, sp);
    else { fx.unhandledReads.push(`${method} ${p}`); rows = []; }

    if (isSingle) {
      if (rows.length === 1) return json(200, rows[0]);
      return json(406, errBody(406));
    }
    const headers = { 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : `*/0` };
    return json(200, rows, headers);
  });
}

async function start(page: Page, over: Partial<Fx> = {}, hour?: number, online = true) {
  fx = freshFx(over);
  if (online) {
    // Same override as e2e/library-vault-smoke.spec.ts: the app's search screen reads navigator.onLine
    // and otherwise shows "You're offline" because the harness blocks non-Supabase connectivity probes.
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
    });
  }
  if (hour !== undefined) {
    await page.addInitScript((h: number) => { Date.prototype.getHours = function () { return h; }; }, hour);
  }
  await installRoutes(page);
  await page.goto('/login');
  await page.getByTestId('login-phone-input').fill('1234567890');
  await page.getByTestId('login-continue-button').click();
  await page.getByTestId('verify-otp-input').fill('123456');
  await page.getByTestId('verify-otp-button').click();
  await expect(page).toHaveURL(/\/library$/, { timeout: 30000 });
}

async function shot(page: Page, id: string, fold = false) {
  if (fold) {
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await page.screenshot({ path: path.join(OUT, `${id}-fold.png`) });
  }
  await page.screenshot({ path: path.join(OUT, `${id}.png`), fullPage: true });
  const text = await page.locator('body').innerText().catch(() => '(innerText failed)');
  fs.writeFileSync(path.join(OUT, `${id}.txt`), text);
}

async function chip(page: Page, label: string) {
  await page.getByRole('radio', { name: label, exact: true }).first().click();
}

async function openComposer(page: Page, ub: string) {
  await page.goto(`/library/${ub}`);
  await expect(page.getByRole('button', { name: 'Add note', exact: true }).first()).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Add note', exact: true }).first().click();
  await expect(page.getByRole('radio', { name: 'Thought', exact: true }).first()).toBeVisible({ timeout: 20000 });
}

async function openWrite(page: Page, ub: string) {
  await openComposer(page, ub);
  await page.getByRole('button', { name: 'Write note', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Note text', exact: true })).toBeVisible({ timeout: 10000 });
}

test.afterEach(async ({}, testInfo) => {
  audit.push({ test: testInfo.title, writes: [...fx.writes], rpcReads: [...fx.rpcReads], authCalls: [...fx.authCalls], externalReads: [...fx.externalReads] });
  expect(fx.writes, `non-GET writes in ${testInfo.title}`).toEqual([]);
});

test.afterAll(() => {
  const writes = audit.flatMap(a => a.writes);
  fs.writeFileSync(path.join(OUT, 'write-audit.json'), JSON.stringify({ totalWrites: writes.length, writes, perTest: audit }, null, 2));
  console.log(`WRITE AUDIT: ${writes.length} non-GET writes recorded`, JSON.stringify(writes));
});

// ---------- HOME (A) ----------
test('A01 home populated list mode', async ({ page }) => {
  await start(page);
  await expect(page.getByText('My Library').first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('The Cover Fixture Book').first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, 'A01', true);
});

test('A02 home shelf mode', async ({ page }) => {
  await start(page);
  await expect(page.getByText('The Cover Fixture Book').first()).toBeVisible({ timeout: 20000 });
  await page.getByText('Shelf', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  await shot(page, 'A02', true);
});

test('A03 home empty library', async ({ page }) => {
  await start(page, { userBooks: [] });
  await expect(page.getByText('My Library').first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await shot(page, 'A03', true);
});

test('A04 home loading (user_books delayed ~8s)', async ({ page }) => {
  const g = gate(8000);
  await start(page, { holds: { 'user_books:list': g.promise } });
  await page.waitForTimeout(1500);
  await shot(page, 'A04', true);
  g.release();
});

test('A05 home error (user_books 500)', async ({ page }) => {
  await start(page, { status: { 'user_books:list': 500 } });
  await expect(page.getByText(/couldn.t|went wrong|try again|retry|error/i).first()).toBeVisible({ timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await shot(page, 'A05', true);
});

test('A06 home long-title book visible', async ({ page }) => {
  await start(page);
  const longRow = page.getByText(LONG_TITLE.slice(0, 40)).first();
  await expect(longRow).toBeVisible({ timeout: 20000 });
  await longRow.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await shot(page, 'A06', true);
});

test('A07 home desktop 1280x800 populated', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await start(page);
  await expect(page.getByText('The Cover Fixture Book').first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1000);
  await shot(page, 'A07', true);
});

// ---------- SEARCH (B) ----------
test('B01 search initial empty query', async ({ page }) => {
  await start(page);
  await page.goto('/library/search');
  await page.waitForTimeout(2000);
  await shot(page, 'B01', true);
});

test('B02 search typed query with results (fake provider JSON)', async ({ page }) => {
  await start(page);
  await page.goto('/library/search');
  await page.locator('input').first().fill('fixture');
  await page.waitForTimeout(1000);
  await page.locator('input').first().press('Enter');
  await page.waitForTimeout(3000);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, 'B02', true);
});

test('B03 search no results', async ({ page }) => {
  await start(page, { provider: 'empty' });
  await page.goto('/library/search');
  await page.locator('input').first().fill('zzqxnothing');
  await page.waitForTimeout(3000);
  await shot(page, 'B03', true);
});

test('B04 search provider error (500)', async ({ page }) => {
  await start(page, { provider: 'error' });
  await page.goto('/library/search');
  await page.locator('input').first().fill('fixture');
  await page.waitForTimeout(4000);
  await shot(page, 'B04', true);
});

test('B05 search loading (provider delayed)', async ({ page }) => {
  const g = gate(9000);
  await start(page, { provider: 'hold', providerHold: g.promise });
  await page.goto('/library/search');
  await page.locator('input').first().fill('fixture');
  await page.waitForTimeout(1500);
  await shot(page, 'B05', true);
  g.release();
});

// ---------- BOOK DETAILS (C) ----------
test('C01 book details populated with notes', async ({ page }) => {
  await start(page);
  await page.goto(`/library/${UB.manyNotes}`);
  await expect(page.getByText('Many Notes Fixture Book').first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Notes', { exact: true }).first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, 'C01', true);
});

test('C02 book details zero notes', async ({ page }) => {
  await start(page);
  await page.goto(`/library/${UB.zeroNotes}`);
  await expect(page.getByText('Zero Notes Fixture').first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await shot(page, 'C02', true);
});

test('C03 book details no cover', async ({ page }) => {
  await start(page);
  await page.goto(`/library/${UB.noCover}`);
  await expect(page.getByText('No Cover Fixture').first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await shot(page, 'C03', true);
});

test('C04 book details long title and author', async ({ page }) => {
  await start(page);
  await page.goto(`/library/${UB.longTitle}`);
  await expect(page.getByText(LONG_TITLE.slice(0, 40)).first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await shot(page, 'C04', true);
});

test('C05 book details loading (user_books single delayed)', async ({ page }) => {
  const g = gate(8000);
  await start(page, { holds: { 'user_books:single': g.promise } });
  await page.goto(`/library/${UB.cover}`);
  await page.waitForTimeout(1500);
  await shot(page, 'C05', true);
  g.release();
});

test('C06 book details error (user_books single 500)', async ({ page }) => {
  await start(page, { status: { 'user_books:single': 500 } });
  await page.goto(`/library/${UB.cover}`);
  await expect(page.getByText(/couldn.t|went wrong|try again|retry|not found|error/i).first()).toBeVisible({ timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await shot(page, 'C06', true);
});

test('C06b book details not found (406 no rows)', async ({ page }) => {
  await start(page, { userBooks: [] });
  await page.goto(`/library/${UB.cover}`);
  await expect(page.getByText(/couldn.t|went wrong|try again|retry|not found|error/i).first()).toBeVisible({ timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await shot(page, 'C06b', true);
});

test('C07 book details each collapsible section expanded', async ({ page }) => {
  await start(page);
  await page.goto(`/library/${UB.manyNotes}`);
  await expect(page.getByText('Many Notes Fixture Book').first()).toBeVisible({ timeout: 20000 });
  const sections = ['My review', 'Book options', 'Community reviews', 'Book information'];
  for (const [i, name] of sections.entries()) {
    const btn = page.getByRole('button', { name, exact: true }).first();
    try {
      await btn.scrollIntoViewIfNeeded();
      await btn.click({ timeout: 5000 });
      await page.waitForTimeout(700);
      await shot(page, `C07-${i + 1}-${name.toLowerCase().replace(/\s+/g, '-')}`);
    } catch (e) {
      fs.writeFileSync(path.join(OUT, `C07-${i + 1}-MISSING.txt`), `Section "${name}" not clickable: ${String(e).slice(0, 300)}`);
    }
  }
});

test('C08 book details saved pages present', async ({ page }) => {
  await start(page);
  await page.goto(`/library/${UB.pages}`);
  await expect(page.getByText('Vault Pages Fixture').first()).toBeVisible({ timeout: 20000 });
  const sp = page.getByText('Saved Pages').first();
  await sp.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(1000);
  await shot(page, 'C08');
});

test('C09 book details desktop 1280x800', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await start(page);
  await page.goto(`/library/${UB.cover}`);
  await expect(page.getByText('The Cover Fixture Book').first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1000);
  await shot(page, 'C09', true);
});

// ---------- NOTES LIST (D) ----------
test('D01 notes list populated', async ({ page }) => {
  await start(page);
  await page.goto(`/library/notes?userBookId=${UB.manyNotes}`);
  await expect(page.getByText(/^\d+ saved notes?$/).first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1000);
  await shot(page, 'D01', true);
});

test('D02 notes list empty', async ({ page }) => {
  await start(page);
  await page.goto(`/library/notes?userBookId=${UB.zeroNotes}`);
  await page.waitForTimeout(3000);
  await shot(page, 'D02', true);
});

test('D03 notes list category chips applied (Quote, Thought, Question)', async ({ page }) => {
  await start(page);
  await page.goto(`/library/notes?userBookId=${UB.manyNotes}`);
  await expect(page.getByText(/^\d+ saved notes?$/).first()).toBeVisible({ timeout: 20000 });
  for (const label of ['Quote', 'Thought', 'Question']) {
    await chip(page, label);
    await page.waitForTimeout(800);
    await shot(page, `D03-${label.toLowerCase()}`);
  }
});

test('D04 notes list loading (reading_notes delayed)', async ({ page }) => {
  const g = gate(8000);
  await start(page, { holds: { 'reading_notes:list': g.promise } });
  await page.goto(`/library/notes?userBookId=${UB.manyNotes}`);
  await page.waitForTimeout(1500);
  await shot(page, 'D04', true);
  g.release();
});

test('D05 notes list error (reading_notes 500)', async ({ page }) => {
  await start(page, { status: { 'reading_notes:list': 500 } });
  await page.goto(`/library/notes?userBookId=${UB.manyNotes}`);
  await expect(page.getByText(/couldn.t|went wrong|try again|retry|error/i).first()).toBeVisible({ timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await shot(page, 'D05', true);
});

// ---------- NOTE READER (E) ----------
test('E01 note reader normal note with category and page', async ({ page }) => {
  await start(page);
  await page.goto(`/library/note?bookId=${UB.manyNotes}&noteId=${NOTE_IDS.quote}`);
  await expect(page.getByText(/quoted line from the fixture book/i).first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(800);
  await shot(page, 'E01');
});

test('E02 note reader no category', async ({ page }) => {
  await start(page);
  await page.goto(`/library/note?bookId=${UB.manyNotes}&noteId=${NOTE_IDS.uncat}`);
  await expect(page.getByText(/uncategorised fixture note/i).first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(800);
  await shot(page, 'E02');
});

test('E03 note reader ~500-word note', async ({ page }) => {
  await start(page);
  await page.goto(`/library/note?bookId=${UB.manyNotes}&noteId=${NOTE_IDS.longNote}`);
  await expect(page.getByText(/reflection1 /).first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(800);
  await shot(page, 'E03');
});

test('E04 note reader note not found', async ({ page }) => {
  await start(page);
  await page.goto(`/library/note?bookId=${UB.manyNotes}&noteId=${NOTE_IDS.missing}`);
  await page.waitForTimeout(4000);
  await shot(page, 'E04');
});

// ---------- COMPOSER (F) ----------
test('F01 composer choose step', async ({ page }) => {
  await start(page);
  await openComposer(page, UB.manyNotes);
  await page.waitForTimeout(800);
  await shot(page, 'F01', true);
});

test('F02 composer write step empty', async ({ page }) => {
  await start(page);
  await openWrite(page, UB.manyNotes);
  await page.waitForTimeout(800);
  await shot(page, 'F02', true);
});

test('F03 composer write step with typed text (not saved)', async ({ page }) => {
  await start(page);
  await openWrite(page, UB.manyNotes);
  await page.getByRole('textbox', { name: 'Note text', exact: true }).fill('Typed fixture draft text. Not saved.');
  await page.waitForTimeout(800);
  await shot(page, 'F03');
});

test('F04 composer word-limit state (501 words pasted, not saved)', async ({ page }) => {
  await start(page);
  await openWrite(page, UB.manyNotes);
  await page.getByRole('textbox', { name: 'Note text', exact: true }).fill(OVER_LIMIT);
  await page.waitForTimeout(1200);
  await shot(page, 'F04');
});

test('F05 composer discard dialog on Back with dirty draft', async ({ page }) => {
  await start(page);
  await openWrite(page, UB.manyNotes);
  await page.getByRole('textbox', { name: 'Note text', exact: true }).fill('Dirty draft for the discard dialog. Not saved.');
  await page.goBack({ waitUntil: 'commit' });
  await expect(page.getByRole('heading', { name: 'Discard this note?', exact: true })).toBeVisible({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, 'F05');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click().catch(() => {});
});

test('F06 composer intake step (scan) with file chooser', async ({ page }) => {
  await start(page);
  await openComposer(page, UB.manyNotes);
  await page.getByRole('button', { name: 'Scan text', exact: true }).click();
  await page.waitForTimeout(1500);
  await shot(page, 'F06');
  const photoBtn = page.getByRole('button', { name: /photo|camera|gallery|library|choose|take|pick/i }).first();
  const chooserP = page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null);
  const clicked = await photoBtn.click({ timeout: 5000 }).then(() => true).catch(() => false);
  const chooser = await chooserP;
  fs.writeFileSync(path.join(OUT, 'F06-chooser.txt'), `photo button clicked: ${clicked}; file chooser opened: ${!!chooser}`);
  if (chooser) {
    await chooser.setFiles('C:/Users/LEGION/Desktop/Bookconnect4_library/docs/user/library/correction-evidence-20261003/chooser-390.jpg');
    await page.waitForTimeout(2500);
  }
  await shot(page, 'F07-after-pick');
});

test('F07 composer crop step if reached', async ({ page }) => {
  await start(page);
  await openComposer(page, UB.manyNotes);
  await page.getByRole('button', { name: 'Scan text', exact: true }).click();
  await page.waitForTimeout(1200);
  const chooserP = page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null);
  await page.getByRole('button', { name: /photo|camera|gallery|library|choose|take|pick/i }).first().click({ timeout: 5000 }).catch(() => {});
  const chooser = await chooserP;
  if (chooser) await chooser.setFiles('C:/Users/LEGION/Desktop/Bookconnect4_library/docs/user/library/correction-evidence-20261003/chooser-390.jpg');
  await page.waitForTimeout(2000);
  const cont = page.getByRole('button', { name: 'Continue preparing photo', exact: true });
  if (await cont.count()) await cont.first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, 'F07-crop');
});

test('F08 composer what follows scan on web (crop action)', async ({ page }) => {
  await start(page);
  await openComposer(page, UB.manyNotes);
  await page.getByRole('button', { name: 'Scan text', exact: true }).click();
  await page.waitForTimeout(1200);
  const chooserP = page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null);
  await page.getByRole('button', { name: /photo|camera|gallery|library|choose|take|pick/i }).first().click({ timeout: 5000 }).catch(() => {});
  const chooser = await chooserP;
  if (chooser) await chooser.setFiles('C:/Users/LEGION/Desktop/Bookconnect4_library/docs/user/library/correction-evidence-20261003/chooser-390.jpg');
  await page.waitForTimeout(2000);
  const action = page.getByRole('button', { name: /Find text and crop|Review recognized text/ }).first();
  const enabled = (await action.count()) > 0 && await action.isEnabled().catch(() => false);
  fs.writeFileSync(path.join(OUT, 'F08-action.txt'), `crop action present+enabled: ${enabled}`);
  if (enabled) { await action.click().catch(() => {}); await page.waitForTimeout(6000); }
  await shot(page, 'F08');
});

test('F09 composer edit mode (existing note, not saved)', async ({ page }) => {
  await start(page);
  await page.goto(`/library/notes?userBookId=${UB.manyNotes}`);
  await expect(page.getByText(/^\d+ saved notes?$/).first()).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /^Read note, Quote, page 42$/ }).first().click();
  await page.getByRole('button', { name: 'Edit note', exact: true }).click({ timeout: 15000 });
  await page.waitForTimeout(1000);
  await shot(page, 'F09');
});

// ---------- CROSS-CUTTING (G) ----------
test('G01 CSS zoom 200% approximation on book details and composer', async ({ page }) => {
  await start(page);
  await page.goto(`/library/${UB.cover}`);
  await expect(page.getByText('The Cover Fixture Book').first()).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => { document.body.style.zoom = '2'; });
  await page.waitForTimeout(1000);
  await shot(page, 'G01-details-zoom200-approx');
  await page.evaluate(() => { document.body.style.zoom = ''; });
  await openComposer(page, UB.cover);
  await page.evaluate(() => { document.body.style.zoom = '2'; });
  await page.waitForTimeout(1000);
  await shot(page, 'G01-composer-zoom200-approx');
  await page.evaluate(() => { document.body.style.zoom = ''; });
});

for (const [name, hour] of [['daylight', 12], ['golden', 18], ['midnight', 22]] as const) {
  test(`G02 theme phase ${name} (hour ${hour})`, async ({ page }) => {
    await start(page, {}, hour);
    await expect(page.getByText('My Library').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('The Cover Fixture Book').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);
    await shot(page, `G02-${name}-home`);
    await page.goto(`/library/${UB.cover}`);
    await expect(page.getByText('The Cover Fixture Book').first()).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(800);
    await shot(page, `G02-${name}-details`);
    await openComposer(page, UB.cover);
    await page.waitForTimeout(800);
    await shot(page, `G02-${name}-composer`);
  });
}

test('G03 offline after load: click a book inside the app', async ({ page, context }) => {
  await start(page, {}, undefined, false);
  await expect(page.getByText('The Cover Fixture Book').first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(800);
  await context.setOffline(true);
  try {
    await page.getByText('The Cover Fixture Book').first().click();
    await page.waitForTimeout(4000);
    await shot(page, 'G03-offline-after-book-click');
  } finally {
    await context.setOffline(false);
  }
});

// ---------- FU-2 additions (this folder's copy only; the audit harness is unchanged) ----------
const FU2: Record<string, { console: string[]; pageErrors: string[]; fonts?: unknown }> = {};

test.beforeEach(async ({ page }, testInfo) => {
  const entry = { console: [] as string[], pageErrors: [] as string[] };
  FU2[testInfo.title] = entry;
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') entry.console.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => entry.pageErrors.push(String(e)));
});

test.afterAll(() => {
  fs.writeFileSync(path.join(OUT, 'fu2-console-and-fonts.json'), JSON.stringify(FU2, null, 2));
});

async function fontReport(page: Page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].map(f => ({ family: f.family, weight: f.weight, style: f.style, status: f.status }));
    const headings = [...document.querySelectorAll('h1,h2,[role="heading"]')].slice(0, 8).map(el => ({
      text: (el.textContent || '').slice(0, 40),
      fontFamily: getComputedStyle(el).fontFamily,
    }));
    const bodyFont = getComputedStyle(document.body).fontFamily;
    return {
      faces,
      checkGaramondSemiBold16: document.fonts.check('16px LibraryGaramondSemiBold'),
      checkGaramondMedium16: document.fonts.check('16px LibraryGaramondMedium'),
      checkManrope16: document.fonts.check('16px LibraryManrope'),
      headings,
      bodyFont,
    };
  });
}

for (const [name, hour] of [['daylight', 12], ['golden', 18], ['midnight', 22]] as const) {
  test(`FU2 search empty ${name} (hour ${hour})`, async ({ page }, testInfo) => {
    await start(page, {}, hour);
    await page.goto('/library/search');
    await page.waitForTimeout(2000);
    await shot(page, `FU2-S-empty-${name}`, true);
    FU2[testInfo.title].fonts = await fontReport(page);
  });

  test(`FU2 search query ${name} (hour ${hour})`, async ({ page }, testInfo) => {
    await start(page, {}, hour);
    await page.goto('/library/search');
    await page.locator('input').first().fill('fixture');
    await page.waitForTimeout(1000);
    await page.locator('input').first().press('Enter');
    await page.waitForTimeout(3000);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, `FU2-S-query-${name}`, true);
    FU2[testInfo.title].fonts = await fontReport(page);
  });

  test(`FU2 home fonts ${name} (hour ${hour})`, async ({ page }, testInfo) => {
    await start(page, {}, hour);
    await expect(page.getByText('The Cover Fixture Book').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);
    FU2[testInfo.title].fonts = await fontReport(page);
  });
}

test('FU2 C4 early home (user_books held 4s, capture right after login redirect)', async ({ page }, testInfo) => {
  const g = gate(4000);
  await start(page, { holds: { 'user_books:list': g.promise } }, 12);
  const early = await page.evaluate(() => ({ bodyTextLength: document.body.innerText.length, text: document.body.innerText.slice(0, 300) }));
  FU2[testInfo.title].fonts = { early };
  await page.screenshot({ path: path.join(OUT, 'FU2-C4-home-early.png') });
  await expect(page.getByText('The Cover Fixture Book').first()).toBeVisible({ timeout: 15000 });
  g.release();
});

test('FU2 home heading probe (daylight, hour 12)', async ({ page }, testInfo) => {
  await start(page, {}, 12);
  await expect(page.getByText('The Cover Fixture Book').first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(800);
  FU2[testInfo.title].fonts = await page.evaluate(() => {
    const pick = (t: string) => {
      const el = [...document.querySelectorAll('div,span,p,h1,h2,h3')].find(e => (e as HTMLElement).innerText?.trim() === t && e.children.length === 0) as HTMLElement | undefined;
      return el ? { text: t, fontFamily: getComputedStyle(el).fontFamily, fontWeight: getComputedStyle(el).fontWeight } : { text: t, notFound: true };
    };
    return { probes: [pick('My Library'), pick('The Cover Fixture Book'), pick('Ada Cover')], loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family) };
  });
});
