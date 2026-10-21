import { expect, test, type Page, type Request } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// SDD-08 U2 export web verification (Expo web on port 8086, worktree Bookconnect4_sdd08, branch sdd08/export).
// Adapted from tb2-tab-bar.pw.ts. Every https request is intercepted and answered by fixtures;
// non-GET Supabase requests are aborted and recorded. Fake OTP login only. Nothing is written to Supabase.

const OUT = __dirname;
const SUPA_HOST = 'placeholder.supabase.co'; // matches the placeholder EXPO_PUBLIC_SUPABASE_URL in .env
const APP = 'http://localhost:8086';
const APP_ALT = 'http://app.localhost:8086'; // non-local hostname so useNetworkStatus does not exempt offline
const ACTOR = '11111111-1111-4111-8111-111111111111';
const COVER_PATH = path.resolve(OUT, '..', '..', 'correction-evidence-20261003', 'chooser-320.jpg');
const COVER = fs.existsSync(COVER_PATH)
  ? fs.readFileSync(COVER_PATH)
  : Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const SESSION = {
  access_token: 'fixture-access-token', refresh_token: 'fixture-refresh-token',
  expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
  user: { id: ACTOR, email: 'fixture@booktalks.test', phone: '+911234567890', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
};
const READ_RPC: Record<string, unknown> = { check_note_word_limit: true, check_page_word_limit: true, get_public_book_reviews: [] };
const PROFILE = { id: 'profile-fixture', user_id: ACTOR, display_name: 'Fixture', username: 'fixture', account_type: 'user', membership_tier: 'free', trust_score: 10 };
const TS = '2026-10-01T00:00:00Z';
const COVER_URL = 'https://covers.fixture.test/cover-1.jpg';
const BOOK1_TITLE = '=Formula, "Quoted" Title';
const BOOK2_TITLE = 'किताब की दुनिया';
const BOOK1_ID = 'bbbbbbbb-0000-4000-8000-000000000001';
const BOOK2_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const UB1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const UB2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const BOOK1 = {
  id: BOOK1_ID, google_books_id: null, title: BOOK1_TITLE, subtitle: null, authors: ['Ada Cover'],
  cover_url: COVER_URL, description: null, page_count: 320, categories: null,
  publisher: 'Fixture Pub', published_date: '2020', isbn_13: null, isbn_10: null,
};
const BOOK2 = {
  id: BOOK2_ID, google_books_id: null, title: BOOK2_TITLE, subtitle: null, authors: ['Ravi Fixture'],
  cover_url: null, description: null, page_count: 210, categories: null,
  publisher: 'Fixture Pub', published_date: '2021', isbn_13: null, isbn_10: null,
};
const USER_BOOKS = [
  { id: UB1, user_id: ACTOR, book_id: BOOK1_ID, reading_status: 'reading', ownership: 'owned', condition: 'good',
    rating: 4, review: null, review_is_public: false, available_for_lending: false, completed_at: null,
    created_at: '2026-10-01T00:00:00Z', updated_at: TS, book: BOOK1 },
  { id: UB2, user_id: ACTOR, book_id: BOOK2_ID, reading_status: 'want_to_read', ownership: 'wishlist', condition: null,
    rating: null, review: null, review_is_public: false, available_for_lending: false, completed_at: null,
    created_at: '2026-09-30T00:00:00Z', updated_at: TS, book: BOOK2 },
];
const NOTES = [
  { id: 'cccccccc-0000-4000-8000-000000000001', user_id: ACTOR, user_book_id: UB1,
    content: 'First line of the quote\nSecond line of the quote', tag: 'quote', page_number: 12,
    created_at: '2026-10-02T00:00:00Z', updated_at: null, version: 1, last_operation_id: null },
  { id: 'cccccccc-0000-4000-8000-000000000002', user_id: ACTOR, user_book_id: UB1,
    content: 'A reflection about this book', tag: 'reflect', page_number: null,
    created_at: '2026-10-03T00:00:00Z', updated_at: null, version: 1, last_operation_id: null },
];
const BOOKS = [BOOK1, BOOK2];

type Verdict = { id: string; check: string; pass: boolean | null; measured: string };
const extra: Record<string, unknown> = {};
const RESULTS_FILE = path.join(OUT, 'sdd08-u2-results.json');
const REQUESTS_FILE = path.join(OUT, 'requests.json');
// Module state is per worker; a worker restart after a failed test reloads what earlier tests recorded.
const readJson = (file: string): any => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const priorRequests = readJson(REQUESTS_FILE);
const priorResults = readJson(RESULTS_FILE);
const requests: Array<{ method: string; url: string; resourceType: string; range: string | null }> = priorRequests?.requests ?? [];
const writes: string[] = priorRequests?.nonGetWrittenToFixture ?? [];
const consoleErrors: string[] = priorResults?.consoleErrors ?? [];
const verdicts: Verdict[] = priorResults?.verdicts ?? [];
const save = () => {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify({ verdicts, extra, consoleErrors: Array.from(new Set(consoleErrors)).slice(0, 30) }, null, 2));
  fs.writeFileSync(REQUESTS_FILE, JSON.stringify({ requests, nonGetWrittenToFixture: writes }, null, 2));
};
const rec = (id: string, check: string, pass: boolean | null, measured: string) => {
  verdicts.push({ id, check, pass, measured });
  save();
};
// Runs a check body; an exception becomes a FAIL with the message rather than aborting the test.
async function check(id: string, label: string, body: () => Promise<[boolean | null, string]>) {
  try {
    const [pass, measured] = await body();
    rec(id, label, pass, measured);
  } catch (error) {
    rec(id, label, false, `exception: ${(error as Error).message.split('\n')[0].slice(0, 240)}`);
  }
}

function rangeStart(headers: Record<string, string>, url: URL): number {
  const range = headers['range'];
  if (range) {
    const match = /(\d+)-\d+$/.exec(range);
    if (match) return Number(match[1]);
  }
  const offset = url.searchParams.get('offset');
  return offset ? Number(offset) : 0;
}

async function installRoutes(page: Page) {
  page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(`console.error: ${m.text().slice(0, 200)}`); });
  page.on('request', (req: Request) => {
    requests.push({ method: req.method(), url: req.url(), resourceType: req.resourceType(), range: req.headers()['range'] ?? null });
  });
  await page.route(/^https:\/\//, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const headers = req.headers();
    const json = (status: number, body: unknown, extraHeaders: Record<string, string> = {}) =>
      route.fulfill({ status, contentType: 'application/json', headers: extraHeaders, body: method === 'HEAD' ? '' : JSON.stringify(body) });
    if (url.hostname === 'covers.fixture.test') return route.fulfill({ status: 200, contentType: 'image/jpeg', body: COVER });
    if (url.hostname !== SUPA_HOST) return route.abort();
    const p = url.pathname;
    if (p === '/auth/v1/otp') return json(200, {});
    if (p === '/auth/v1/verify' || p === '/auth/v1/token') return json(200, SESSION);
    if (p === '/auth/v1/user') return json(200, SESSION.user);
    if (!p.startsWith('/rest/v1/')) { writes.push(`${method} ${p}`); return route.abort(); }
    const resource = p.slice('/rest/v1/'.length);
    if (method === 'POST' && resource.startsWith('rpc/')) {
      const fn = resource.slice(4);
      if (fn in READ_RPC) return json(200, READ_RPC[fn]);
      writes.push(`POST ${p}`); return route.abort();
    }
    if (method !== 'GET' && method !== 'HEAD') { writes.push(`${method} ${p}`); return route.abort(); }
    const accept = headers['accept'] ?? '';
    const isSingle = accept.includes('application/vnd.pgrst.object+json');
    const start = rangeStart(headers, url);
    const contentRange = (n: number) => (n ? `0-${n - 1}/${n}` : '*/0');
    let rows: unknown[] = [];
    if (resource === 'user_profiles') rows = [PROFILE];
    else if (resource === 'books') rows = start === 0 ? BOOKS : [];
    else if (resource === 'user_books') {
      if (url.searchParams.has('id')) {
        const wanted = url.searchParams.get('id');
        const match = USER_BOOKS.filter(b => wanted === `eq.${b.id}`);
        if (isSingle) {
          if (match.length === 1) return json(200, match[0]);
          return json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: null, hint: null });
        }
        return json(200, match, { 'content-range': contentRange(match.length) });
      }
      rows = start === 0 ? USER_BOOKS : [];
    } else if (resource === 'reading_notes') {
      const scope = url.searchParams.get('user_book_id');
      const scoped = scope ? NOTES.filter(n => scope === `eq.${n.user_book_id}`) : NOTES;
      rows = start === 0 ? scoped : [];
    }
    const n = (rows as unknown[]).length;
    if (isSingle) {
      if (n === 1) return json(200, rows[0]);
      return json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: null, hint: null });
    }
    return json(200, rows, { 'content-range': contentRange(n) });
  });
}

async function start(page: Page, base: string) {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
  });
  await page.addInitScript(() => { Date.prototype.getHours = function () { return 12; }; });
  await installRoutes(page);
  await page.goto(`${base}/login`, { timeout: 180000 });
  const phone = page.getByTestId('login-phone-input');
  await Promise.race([
    phone.waitFor({ state: 'visible', timeout: 120000 }).catch(() => {}),
    page.waitForURL(/\/library(\/|$|\?)/, { timeout: 120000 }).catch(() => {}),
  ]);
  if (await phone.count()) {
    await phone.fill('1234567890');
    await page.getByTestId('login-continue-button').click();
    await page.getByTestId('verify-otp-input').fill('123456');
    await page.getByTestId('verify-otp-button').click();
  }
  await expect(page).toHaveURL(/\/library(\/|$|\?)/, { timeout: 120000 });
  await page.waitForTimeout(1500);
}

async function openNotes(page: Page) {
  await page.getByText(BOOK1_TITLE, { exact: true }).first().click();
  await page.getByText('All notes', { exact: true }).first().click();
  await expect(page.getByRole('button', { name: /^Export notes for/ })).toBeVisible({ timeout: 60000 });
}

const exportNotesButton = (page: Page) => page.getByRole('button', { name: /^Export notes for/ });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Export notes' });
async function openDialog(page: Page) {
  await exportNotesButton(page).click();
  await expect(dialog(page)).toBeVisible({ timeout: 15000 });
}
const iframeCount = (page: Page) => page.evaluate(() => document.querySelectorAll('iframe').length);

// ---------- E1 ----------
test('E1 library CSV export on the library home at 390x844', async ({ page }) => {
  test.setTimeout(300000);
  await start(page, APP);
  await check('E1-button', 'Export library as CSV button visible beside Add a book', async () => {
    const exp = page.getByRole('button', { name: 'Export library as CSV', exact: true });
    await expect(exp).toBeVisible({ timeout: 60000 });
    const add = page.getByRole('button', { name: 'Add a book', exact: true });
    const [a, e] = await Promise.all([add.boundingBox(), exp.boundingBox()]);
    const sameRow = !!a && !!e && Math.abs(a.y - e.y) < 24;
    return [sameRow, `add=${JSON.stringify(a)} export=${JSON.stringify(e)}`];
  });
  let download: Awaited<ReturnType<Page['waitForEvent']>> | null = null;
  try {
    [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      page.getByRole('button', { name: 'Export library as CSV', exact: true }).click(),
    ]);
  } catch (error) {
    rec('E1-download', 'CSV download event fired', false, (error as Error).message.split('\n')[0]);
  }
  if (download) {
    const suggested = download.suggestedFilename();
    await download.saveAs(path.join(OUT, 'library.csv'));
    const buf = fs.readFileSync(path.join(OUT, 'library.csv'));
    const text = buf.toString('utf8');
    const bom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
    const body = text.slice(1);
    const lines = body.split('\r\n');
    const bareLf = /(^|[^\r])\n/.test(body);
    const header = lines[0] ?? '';
    const formulaCell = '"\'=Formula, ""Quoted"" Title"';
    const formulaOk = text.includes(formulaCell);
    const devaOk = text.includes(BOOK2_TITLE);
    const filenameOk = /^bookconnect-library-\d{4}-\d{2}-\d{2}\.csv$/.test(suggested);
    rec('E1-filename', 'Suggested filename matches bookconnect-library-YYYY-MM-DD.csv', filenameOk, suggested);
    rec('E1-csv', 'CSV: BOM, CRLF only, header, formula cell quoted with leading apostrophe, Devanagari intact',
      bom && !bareLf && header.startsWith('Title,Authors,ISBN-13,') && formulaOk && devaOk,
      `bom=${bom}; crlfOnly=${!bareLf}; header=${header.slice(0, 80)}; formulaCell=${formulaOk}; devanagari=${devaOk}; first3=${JSON.stringify(lines.slice(0, 3))}`);
    extra.E1_first3Lines = lines.slice(0, 3); // BOM stripped; shown separately as <BOM>
    extra.E1_bomBytes = [buf[0], buf[1], buf[2]];
  }
  await check('E1-caption', 'Caption "Saved to your downloads." visible after download', async () => {
    await expect(page.getByText('Saved to your downloads.', { exact: true })).toBeVisible({ timeout: 15000 });
    return [true, 'visible'];
  });
  await page.screenshot({ path: path.join(OUT, 'shot-01-library-home-390.png') });
  save();
});

// ---------- E2 ----------
test('E2 notes Markdown export from the notes list at 390x844', async ({ page }) => {
  test.setTimeout(300000);
  await start(page, APP);
  await check('E2-open', 'Notes list opened for the first book; Export button visible', async () => {
    await openNotes(page);
    return [true, (await exportNotesButton(page).textContent()) ?? ''];
  });
  await openDialog(page);
  await check('E2-dialog-shape', 'Dialog role=dialog named Export notes; radiogroups Format and Scope; privacy line; Export and Cancel', async () => {
    const d = dialog(page);
    const groups = await d.getByRole('radiogroup').evaluateAll(els => els.map(el => el.getAttribute('aria-label')));
    const privacy = await d.getByText('Includes private notes. Notes still saving are not included.', { exact: true }).count();
    const exportBtn = await d.getByRole('button', { name: 'Export', exact: true }).count();
    const cancelBtn = await d.getByRole('button', { name: 'Cancel', exact: true }).count();
    await page.screenshot({ path: path.join(OUT, 'shot-02-dialog-default-390.png') });
    const ok = groups.includes('Format') && groups.includes('Scope') && privacy === 1 && exportBtn === 1 && cancelBtn === 1;
    return [ok, `radiogroups=${JSON.stringify(groups)}; privacyLine=${privacy}; export=${exportBtn}; cancel=${cancelBtn}`];
  });
  await check('E2-choose', 'Choose Markdown file and This book', async () => {
    const d = dialog(page);
    await d.getByRole('radio', { name: 'Markdown file', exact: true }).click();
    await d.getByRole('radio', { name: 'This book', exact: true }).click();
    const checked = await d.getByRole('radio', { checked: true }).evaluateAll(els => els.map(el => el.getAttribute('aria-label')));
    return [checked.includes('Markdown file') && checked.includes('This book'), `checked=${JSON.stringify(checked)}`];
  });
  let download: Awaited<ReturnType<Page['waitForEvent']>> | null = null;
  try {
    [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      dialog(page).getByRole('button', { name: 'Export', exact: true }).click(),
    ]);
  } catch (error) {
    rec('E2-download', 'Markdown download event fired', false, (error as Error).message.split('\n')[0]);
  }
  if (download) {
    const suggested = download.suggestedFilename();
    await download.saveAs(path.join(OUT, 'notes.md'));
    const text = fs.readFileSync(path.join(OUT, 'notes.md'), 'utf8');
    const quoteLines = text.split('\n').filter(l => l.includes('First line of the quote') || l.includes('Second line of the quote'));
    const quoteOk = quoteLines.length === 2 && quoteLines.every(l => l.startsWith('> '));
    rec('E2-filename', 'Suggested filename matches bookconnect-notes-…-YYYY-MM-DD.md', /^bookconnect-notes-.+-\d{4}-\d{2}-\d{2}\.md$/.test(suggested), suggested);
    rec('E2-quote', 'Quote lines start with "> "', quoteOk, JSON.stringify(quoteLines));
  }
  await check('E2-caption', 'Caption "Saved to your downloads." appears', async () => {
    await expect(page.getByText('Saved to your downloads.', { exact: true })).toBeVisible({ timeout: 15000 });
    return [true, 'visible'];
  });
  save();
});

// ---------- E3 ----------
test('E3 notes PDF export: print once, no real dialog, cleanup', async ({ page }) => {
  test.setTimeout(300000);
  await start(page, APP);
  await openNotes(page);
  // Counter wrapper: every iframe contentWindow gets a stub print() that counts calls instead of opening a print dialog.
  await page.evaluate(() => {
    (window as any).__printCalls = 0;
    const desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')!;
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      configurable: true,
      get() {
        const w = desc.get!.call(this) as any;
        if (w && !w.__printStubbed) {
          w.__printStubbed = true;
          w.print = () => { (window as any).__printCalls += 1; };
        }
        return w;
      },
    });
  });
  await openDialog(page);
  await dialog(page).getByRole('radio', { name: 'PDF', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Export', exact: true }).click();
  await check('E3-ready', 'Ready text and primary Print button shown', async () => {
    await expect(page.getByText('Your PDF is ready. Choose Print, then Save as PDF.', { exact: true })).toBeVisible({ timeout: 60000 });
    const print = dialog(page).getByRole('button', { name: 'Print', exact: true });
    const visible = await print.isVisible();
    await page.screenshot({ path: path.join(OUT, 'shot-03-dialog-pdf-ready-390.png') });
    return [visible, `printVisible=${visible}; iframesBeforePrint=${await iframeCount(page)}`];
  });
  await check('E3-print', 'One print call, dialog closed, no error caption', async () => {
    const before = await iframeCount(page);
    await dialog(page).getByRole('button', { name: 'Print', exact: true }).click();
    await page.waitForTimeout(800);
    const calls = await page.evaluate(() => (window as any).__printCalls);
    const dialogHidden = (await dialog(page).count()) === 0 || !(await dialog(page).isVisible());
    const errorCaption = await page.getByText("Couldn't export. Try again.", { exact: true }).count();
    const iframesAfterPrint = await iframeCount(page);
    const hiddenFrameAfterprint = await page.evaluate(() => {
      const f = document.querySelector('iframe') as HTMLIFrameElement | null;
      if (!f || !f.contentWindow) return 'no iframe present';
      f.contentWindow.dispatchEvent(new Event('afterprint'));
      return 'afterprint dispatched';
    });
    await page.waitForTimeout(300);
    const iframesAfterAfterprint = await iframeCount(page);
    extra.E3 = { before, calls, dialogHidden, errorCaption, iframesAfterPrint, hiddenFrameAfterprint, iframesAfterAfterprint };
    const ok = calls === 1 && dialogHidden && errorCaption === 0;
    return [ok, `printCalls=${calls}; dialogClosed=${dialogHidden}; errorCaptions=${errorCaption}; iframesBeforePrint=${before}; iframesAfterPrint=${iframesAfterPrint}; afterprint: ${hiddenFrameAfterprint} -> iframes=${iframesAfterAfterprint}`];
  });
  save();
});

// ---------- E4 ----------
test('E4 cancel after PDF ready removes the hidden iframe', async ({ page }) => {
  test.setTimeout(300000);
  await start(page, APP);
  await openNotes(page);
  await openDialog(page);
  await dialog(page).getByRole('radio', { name: 'PDF', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Export', exact: true }).click();
  await check('E4-ready', 'PDF ready state reached (iframe present before cancel, informational)', async () => {
    await expect(page.getByText('Your PDF is ready. Choose Print, then Save as PDF.', { exact: true })).toBeVisible({ timeout: 60000 });
    return [true, `iframesBeforeCancel=${await iframeCount(page)}`];
  });
  await check('E4-cancel', 'Cancel removes all iframes from the DOM', async () => {
    await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.waitForTimeout(800);
    const remaining = await iframeCount(page);
    const hidden = (await dialog(page).count()) === 0 || !(await dialog(page).isVisible());
    return [remaining === 0 && hidden, `iframesAfterCancel=${remaining}; dialogClosed=${hidden}`];
  });
  save();
});

// ---------- E5 ----------
// Notes are opened online first; offline is then applied on that page and back navigation returns to the library.
// This avoids loading new routes while offline (the first attempt hung on that step).
async function offlineCheck(page: Page, context: any, base: string, tag: string) {
  await start(page, base);
  await openNotes(page);
  await context.setOffline(true);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    window.dispatchEvent(new Event('offline'));
  });
  await page.waitForTimeout(800);
  const notesState = await exportNotesButton(page).evaluate(el => ({
    disabled: (el as HTMLButtonElement).disabled === true, ariaDisabled: el.getAttribute('aria-disabled'),
  })).catch(e => ({ error: (e as Error).message.slice(0, 120) }));
  const notesCaption = await page.getByText('Export needs a connection.', { exact: true }).count();
  await page.screenshot({ path: path.join(OUT, `shot-05-offline-notes-${tag}.png`) });
  const notesDisabled = ('disabled' in notesState && notesState.disabled) || ('ariaDisabled' in notesState && notesState.ariaDisabled === 'true');
  rec(`E5-notes-${tag}`, `Offline (${base}): notes Export button disabled and "Export needs a connection." visible`,
    !!notesDisabled && notesCaption >= 1,
    `notesButton=${JSON.stringify(notesState)}; captions=${notesCaption}; navigatorOnLine=${await page.evaluate(() => navigator.onLine)}`);
  await page.goBack({ timeout: 15000 }).catch(() => {});
  await page.goBack({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const libState = await page.getByRole('button', { name: 'Export library as CSV', exact: true }).evaluate(el => ({
    disabled: (el as HTMLButtonElement).disabled === true, ariaDisabled: el.getAttribute('aria-disabled'),
  })).catch(e => ({ error: (e as Error).message.slice(0, 120) }));
  const libCaption = await page.getByText('Export needs a connection.', { exact: true }).count();
  await page.screenshot({ path: path.join(OUT, `shot-04-offline-library-${tag}.png`) });
  const libDisabled = ('disabled' in libState && libState.disabled) || ('ariaDisabled' in libState && libState.ariaDisabled === 'true');
  rec(`E5-library-${tag}`, `Offline (${base}): library CSV button disabled and "Export needs a connection." visible`,
    !!libDisabled && libCaption >= 1, `libraryButton=${JSON.stringify(libState)}; captions=${libCaption}; path=${new URL(page.url()).pathname}`);
  await context.setOffline(false);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    window.dispatchEvent(new Event('online'));
  });
}
test('E5 offline state on localhost (hook exempts local previews)', async ({ page, context }) => {
  test.setTimeout(240000);
  await offlineCheck(page, context, APP, 'localhost');
  save();
});
test('E5 offline state on app.localhost (non-local hostname)', async ({ page, context }) => {
  test.setTimeout(240000);
  await offlineCheck(page, context, APP_ALT, 'app-localhost');
  save();
});

// ---------- E6 ----------
const overflowOf = (page: Page) => page.evaluate(() => {
  const w = window.innerWidth;
  const items = Array.from(document.querySelectorAll('[role="button"],[role="radio"]')) as HTMLElement[];
  return items.map(el => {
    const r = el.getBoundingClientRect();
    return { label: el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 30), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
  }).filter(x => x.width > 0 && (x.right > w + 0.5 || x.left < -0.5));
});
const pageMetrics = (page: Page) => page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, innerWidth: window.innerWidth,
}));
test('E6 layout at 320x740 and zoom 2 at 390', async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 320, height: 740 });
  await start(page, APP);
  await expect(page.getByRole('button', { name: 'Export library as CSV', exact: true })).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(800);
  const libMetrics320 = await pageMetrics(page);
  const libOverflow320 = await overflowOf(page);
  await page.screenshot({ path: path.join(OUT, 'shot-06-library-w320.png') });
  rec('E6-library-320', 'Library home at 320: scrollWidth equals viewport, header controls within viewport',
    libMetrics320.scrollWidth === 320 && libOverflow320.length === 0,
    `scrollWidth=${libMetrics320.scrollWidth}; innerWidth=${libMetrics320.innerWidth}; overflowing=${JSON.stringify(libOverflow320)}`);
  await openNotes(page);
  await page.waitForTimeout(800);
  const notesMetrics320 = await pageMetrics(page);
  const notesOverflow320 = await overflowOf(page);
  await page.screenshot({ path: path.join(OUT, 'shot-07-notes-w320.png') });
  rec('E6-notes-320', 'Notes list at 320: scrollWidth equals viewport, header controls within viewport',
    notesMetrics320.scrollWidth === 320 && notesOverflow320.length === 0,
    `scrollWidth=${notesMetrics320.scrollWidth}; innerWidth=${notesMetrics320.innerWidth}; overflowing=${JSON.stringify(notesOverflow320)}`);
  // Zoom 2 at 390, same method as tb2 (documentElement CSS zoom).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await page.waitForTimeout(800);
  const notesZoom = await pageMetrics(page);
  const notesZoomOverflow = await overflowOf(page);
  await page.screenshot({ path: path.join(OUT, 'shot-08-notes-zoom2-390.png') });
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  rec('E6-notes-zoom2', 'Notes list at zoom 2 on 390: scrollWidth equals 390, controls within viewport',
    notesZoom.scrollWidth === 390 && notesZoomOverflow.length === 0, `scrollWidth=${notesZoom.scrollWidth}; overflowing=${JSON.stringify(notesZoomOverflow)}`);
  await page.goto(`${APP}/library`, { timeout: 120000 }).catch(() => {});
  await expect(page.getByRole('button', { name: 'Export library as CSV', exact: true })).toBeVisible({ timeout: 60000 });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await page.waitForTimeout(800);
  const libZoom = await pageMetrics(page);
  const libZoomOverflow = await overflowOf(page);
  await page.screenshot({ path: path.join(OUT, 'shot-09-library-zoom2-390.png') });
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  rec('E6-library-zoom2', 'Library home at zoom 2 on 390: scrollWidth equals 390, controls within viewport',
    libZoom.scrollWidth === 390 && libZoomOverflow.length === 0, `scrollWidth=${libZoom.scrollWidth}; overflowing=${JSON.stringify(libZoomOverflow)}`);
  save();
});

// ---------- E7 ----------
test('E7 keyboard: Tab order inside dialog and Escape closes it', async ({ page }) => {
  test.setTimeout(300000);
  await start(page, APP);
  await openNotes(page);
  await openDialog(page);
  const focusName = () => page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a) return 'none';
    const label = a.getAttribute('aria-label') || '';
    const role = a.getAttribute('role') || a.tagName.toLowerCase();
    const checked = a.getAttribute('aria-checked');
    return `${role}:${label}${checked !== null ? `[checked=${checked}]` : ''}`;
  });
  const initial = await focusName();
  const forward: string[] = [];
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); forward.push(await focusName()); }
  const backward: string[] = [];
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Shift+Tab'); backward.push(await focusName()); }
  const all = [initial, ...forward, ...backward].join(' | ');
  const sawRadio = /radio:/.test(all);
  const sawExport = all.includes('button:Export');
  const sawCancel = all.includes('button:Cancel');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  const closed = (await dialog(page).count()) === 0 || !(await dialog(page).isVisible());
  extra.E7 = { initial, forward, backward };
  rec('E7-tab', 'Tab/Shift+Tab reach the radios, Export and Cancel', sawRadio && sawExport && sawCancel,
    `initial=${initial}; forward=${forward.join(' > ')}; backward=${backward.join(' > ')}`);
  rec('E7-escape', 'Escape closes the dialog when not busy', closed, `dialogClosedAfterEscape=${closed}`);
  save();
});

// ---------- E8 ----------
test('E8 network audit of recorded requests', async ({ page }) => {
  test.setTimeout(300000);
  await start(page, APP);
  await openNotes(page);
  save();
  const hostOf = (u: string) => new URL(u).hostname;
  const hosts = Array.from(new Set(requests.map(r => hostOf(r.url))));
  const allowedReal = (h: string) => h === SUPA_HOST || h === 'localhost' || h === '127.0.0.1' || h === 'app.localhost' || h === '[::1]';
  const offHost = requests.filter(r => !allowedReal(hostOf(r.url)));
  const offHostHosts = Array.from(new Set(offHost.map(r => hostOf(r.url))));
  const nonGetTables = requests.filter(r => r.method !== 'GET' && /\/rest\/v1\/(reading_notes|user_books)/.test(r.url));
  rec('E8-hosts', 'Every request goes to the placeholder host or localhost (fixture-only hosts listed)', offHostHosts.length === 0,
    `hosts=${JSON.stringify(hosts)}; outsideAllowed=${JSON.stringify(offHostHosts)}; note: covers.fixture.test is fulfilled by the harness and never leaves the browser`);
  rec('E8-writes', 'No non-GET request to reading_notes or user_books', nonGetTables.length === 0,
    `nonGetToNotesOrBooks=${nonGetTables.length}; all non-GET intercepted=${JSON.stringify(Array.from(new Set(writes)))}`);
  save();
});
