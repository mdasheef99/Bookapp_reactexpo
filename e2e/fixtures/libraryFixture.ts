import { expect, type Page } from '@playwright/test';

// Deterministic, transport-level fixtures for the Library screen audit.
// Every HTTP(S) request outside the local dev server origins is intercepted. Supabase GET/HEAD reads are answered from
// per-test fixture data; any other method is aborted and recorded as a write.
// Read-only RPCs that the app calls with POST are answered and listed separately.
// Nothing is saved, edited or deleted; no real credentials are used.

const SUPA_HOST = 'ahntbtktjjmvfosgkmgn.supabase.co';
const ACTOR = '11111111-1111-4111-8111-111111111111';
const COVER = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
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

export const LONG_TITLE = 'A Fixture Title Of Roughly One Hundred And Forty Characters Written To Exercise Wrapping, Truncation And Clipping Of Long Book Titles In Cards, Headers And Details';
export const LONG_AUTHOR = 'Dr. Evangeline Maximilian Fixture-Hyphenated Longname of the Anglo-Saxon Literary Society and Associates';
const LONG_NOTE = Array.from({ length: 500 }, (_, i) => `reflection${i + 1}`).join(' ');
const OVER_LIMIT = Array.from({ length: 501 }, (_, i) => `pasted${i + 1}`).join(' ');
const PAGE_TEXT = Array.from({ length: 100 }, (_, i) => 'word').join(' ');

export const UB = {
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
export const NOTE_IDS = {
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

export type Fx = {
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

export function gate(ms = 9000) {
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
    else if (raw.startsWith('in.(')) { const values = raw.slice(4, -1).split(',').map(v => v.replace(/^"|"$/g, '')); out = out.filter(r => values.includes(String(r[key]))); }
    else if (raw === 'is.null') out = out.filter(r => r[key] == null);
  }
  return out;
}

// The dev server port; LIBRARY_A11Y_PORT lets a second worktree run the suite while 8083 is busy.
const APP_PORT = process.env.LIBRARY_A11Y_PORT ?? '8083';

async function installRoutes(page: Page) {
  await page.route(url => /^https?:$/.test(url.protocol)
    && ![`http://localhost:${APP_PORT}`, `http://127.0.0.1:${APP_PORT}`].includes(url.origin), async route => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      route.fulfill({ status, contentType: 'application/json', headers, body: method === 'HEAD' ? '' : JSON.stringify(body) });
    const errBody = (status: number) => status === 406
      ? { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows', hint: null }
      : { code: 'FIXTURE', message: 'fixture failure', details: null, hint: null };

    if (url.hostname === 'covers.fixture.test') return route.fulfill({ status: 200, contentType: 'image/png', body: COVER });
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
    // Cast silences TS2801 (Record index types as always-defined); runtime behaviour matches the audit.
    const hold = fx.holds[key] as Promise<void> | undefined;
    if (method === 'GET' && hold) await hold;
    if (method === 'GET' && fx.status[key]) return json(fx.status[key], errBody(fx.status[key]));

    let rows: any[];
    if (resource === 'user_profiles') rows = [PROFILE];
    else if (resource === 'user_books') rows = applyFilters(fx.userBooks, sp);
    else if (resource === 'books') rows = applyFilters(fx.books, sp);
    else if (resource === 'reading_notes') rows = applyFilters(fx.notes, sp);
    else if (resource === 'user_book_pages') rows = applyFilters(fx.pages, sp);
    else if (resource === 'user_book_reads') rows = [];
    else if (resource === 'user_reading_goals') rows = [];
    else if (resource === 'user_reading_settings') rows = [];
    else { fx.unhandledReads.push(`${method} ${p}`); rows = []; }

    const orders = (sp.get('order') ?? '').split(',').filter(Boolean);
    if (orders.length) rows = [...rows].sort((a, b) => {
      for (const order of orders) { const [column, direction] = order.split('.'); const difference = String(a[column]).localeCompare(String(b[column])); if (difference) return difference * (direction === 'desc' ? -1 : 1); }
      return 0;
    });
    const range = req.headers()['range']?.split('-').map(Number);
    const offset = Number(sp.get('offset') ?? range?.[0] ?? 0);
    const limit = Number(sp.get('limit') ?? (range ? range[1] - range[0] + 1 : 1000));
    rows = rows.slice(offset, offset + limit);
    if (isSingle) {
      if (rows.length === 1) return json(200, rows[0]);
      return json(406, errBody(406));
    }
    const headers = { 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : `*/0` };
    return json(200, rows, headers);
  });
}

export async function startLibrarySession(page: Page, over: Partial<Fx> = {}, hour?: number) {
  fx = freshFx(over);
  // Same override as e2e/library-vault-smoke.spec.ts: the app's search screen reads navigator.onLine
  // and otherwise shows "You're offline" because the harness blocks non-Supabase connectivity probes.
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
  });
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

export async function openComposer(page: Page, ub: string) {
  await page.goto(`/library/${ub}`);
  await expect(page.getByRole('button', { name: 'Add note', exact: true }).first()).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Add note', exact: true }).first().click();
  await expect(page.getByRole('radio', { name: 'Thought', exact: true }).first()).toBeVisible({ timeout: 20000 });
}

export async function openWrite(page: Page, ub: string) {
  await openComposer(page, ub);
  await page.getByRole('button', { name: 'Write note', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Note text', exact: true })).toBeVisible({ timeout: 10000 });
}

export function currentFixtureWrites(): string[] {
  return [...fx.writes];
}

export function currentFixtureUnhandledReads(): string[] {
  return [...fx.unhandledReads];
}
