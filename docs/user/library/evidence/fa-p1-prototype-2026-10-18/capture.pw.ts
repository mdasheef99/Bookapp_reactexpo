import { expect, test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// FA-P1 prototype screenshot capture (Expo web dev build, /library/dev-flow-a).
// Adapted from library-screen-audit-2026-10-18/capture.pw.ts. Transport-level fixtures:
// every https request is intercepted. Supabase GET/HEAD reads are answered from fixture data;
// any other method is aborted and recorded as a write. Nothing is saved, edited or deleted;
// no real credentials are used. Localhost dev-server traffic is not intercepted (it is listed
// separately as non-GET requests so it can be inspected).

const OUT = __dirname;
const SUPA_HOST = 'ahntbtktjjmvfosgkmgn.supabase.co';
const ACTOR = '11111111-1111-4111-8111-111111111111';
const COVER = fs.readFileSync(path.resolve(__dirname, '..', '..', 'correction-evidence-20261003', 'chooser-390.jpg'));
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
const PROFILE = { id: 'profile-fixture', user_id: ACTOR, display_name: 'Fixture', username: 'fixture', account_type: 'user', membership_tier: 'free', trust_score: 10 };

type Fx = { writes: string[]; rpcReads: string[]; authCalls: string[]; externalReads: string[]; unhandledReads: string[]; nonGet: string[] };
const freshFx = (): Fx => ({ writes: [], rpcReads: [], authCalls: [], externalReads: [], unhandledReads: [], nonGet: [] });
let fx: Fx = freshFx();

const audit: Array<{ test: string; writes: string[]; rpcReads: string[]; authCalls: string[]; externalReads: string[] }> = [];
const records: Array<Record<string, unknown>> = [];

async function installRoutes(page: Page) {
  page.on('request', req => {
    if (req.method() !== 'GET') fx.nonGet.push(`${req.method()} ${req.url().split('?')[0]}`);
  });
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
      return json(200, { totalItems: 0, items: [] });
    }
    if (url.hostname === 'openlibrary.org' && url.pathname.startsWith('/search.json')) {
      fx.externalReads.push('openlibrary GET');
      return json(200, { numFound: 0, docs: [] });
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

    const accept = req.headers()['accept'] ?? '';
    const isSingle = accept.includes('application/vnd.pgrst.object+json');
    let rows: any[] = [];
    if (resource === 'user_profiles') rows = [PROFILE];
    else fx.unhandledReads.push(`${method} ${p}`);

    if (isSingle) {
      if (rows.length === 1) return json(200, rows[0]);
      return json(406, errBody(406));
    }
    const headers = { 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : `*/0` };
    return json(200, rows, headers);
  });
}

async function start(page: Page) {
  fx = freshFx();
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
  });
  await installRoutes(page);
  await page.goto('/login');
  // The fu1a .env may set EXPO_PUBLIC_DEV_SKIP_AUTH, in which case /login redirects straight to /library.
  // Handle both: fill the fake-OTP login only when the phone field appears.
  const phone = page.getByTestId('login-phone-input');
  await Promise.race([
    phone.waitFor({ state: 'visible', timeout: 45000 }).catch(() => {}),
    page.waitForURL(/\/library(\/|$|\?)/, { timeout: 45000 }).catch(() => {}),
  ]);
  if (await phone.count()) {
    await phone.fill('1234567890');
    await page.getByTestId('login-continue-button').click();
    await page.getByTestId('verify-otp-input').fill('123456');
    await page.getByTestId('verify-otp-button').click();
  }
  await expect(page).toHaveURL(/\/library(\/|$|\?)/, { timeout: 45000 });
}

// Count focusable elements up to and including [data-testid="fa-primary"] in DOM order.
async function focusAbovePrimary(page: Page) {
  return page.evaluate(() => {
    const nodes = document.querySelectorAll('[data-testid="fa-primary"]');
    const p = nodes[0] as HTMLElement | undefined;
    if (!p) return { primaryCount: nodes.length, focusableUpToPrimary: null as number | null };
    const sel = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),[role="button"],[role="radio"],[role="link"],[role="checkbox"],[role="switch"],[role="tab"],[role="menuitem"]';
    const all = Array.from(document.querySelectorAll(sel));
    const before = all.filter(el => el !== p && !el.contains(p) && !!(el.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING)).length;
    return { primaryCount: nodes.length, focusableUpToPrimary: before + 1 };
  });
}

async function shot(page: Page, id: string) {
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.screenshot({ path: path.join(OUT, `${id}-fold.png`) });
  await page.screenshot({ path: path.join(OUT, `${id}.png`), fullPage: true });
  const text = await page.locator('body').innerText().catch(() => '(innerText failed)');
  fs.writeFileSync(path.join(OUT, `${id}.txt`), text);
  return text;
}

type Cap = { id: string; query: string; width?: number; height?: number };
const PRESETS = ['populated', 'no-cover', 'zero-notes', 'many-notes', 'long-title', 'saved-absent', 'review-absent', 'want-to-read', 'finished', 'lent-out', 'uncategorised-note', 'notes-loading', 'notes-error', 'loading', 'error', 'not-found', 'offline'];
const PHASES = ['daylight', 'golden', 'midnight'];
const CAPS: Cap[] = [];
for (const s of PRESETS) for (const ph of PHASES) CAPS.push({ id: `${s}-${ph}`, query: `s=${s}&phase=${ph}` });
CAPS.push({ id: 'populated-daylight-open-review', query: 's=populated&phase=daylight&open=review' });
CAPS.push({ id: 'populated-daylight-open-saved', query: 's=populated&phase=daylight&open=saved' });
CAPS.push({ id: 'populated-daylight-open-remove', query: 's=populated&phase=daylight&open=remove' });
CAPS.push({ id: 'populated-daylight-slots1', query: 's=populated&phase=daylight&slots=1' });
CAPS.push({ id: 'populated-daylight-w320', query: 's=populated&phase=daylight', width: 320, height: 844 });
CAPS.push({ id: 'populated-daylight-w1280', query: 's=populated&phase=daylight', width: 1280, height: 800 });

test.afterEach(async ({}, testInfo) => {
  audit.push({ test: testInfo.title, writes: [...fx.writes], rpcReads: [...fx.rpcReads], authCalls: [...fx.authCalls], externalReads: [...fx.externalReads] });
  expect(fx.writes, `non-GET writes in ${testInfo.title}`).toEqual([]);
});

test.afterAll(() => {
  const writes = audit.flatMap(a => a.writes);
  const nonGetAll = records.flatMap(r => (r.nonGetRequests as string[]) ?? []);
  fs.writeFileSync(path.join(OUT, 'write-audit.json'), JSON.stringify({
    totalWrites: writes.length,
    totalNonGetRequestsAllHosts: nonGetAll.length,
    nonGetRequestsAllHosts: nonGetAll,
    writes,
    perTest: audit,
  }, null, 2));
  fs.writeFileSync(path.join(OUT, 'capture-index.json'), JSON.stringify(records, null, 2));
  console.log(`WRITE AUDIT: ${writes.length} harness non-GET writes; ${nonGetAll.length} non-GET requests (all hosts)`);
});

for (const cap of CAPS) {
  test(`FA ${cap.id}`, async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
    if (cap.width) await page.setViewportSize({ width: cap.width, height: cap.height ?? 844 });
    await start(page);
    await page.goto(`/library/dev-flow-a?${cap.query}`);
    await expect(page.getByTestId('FA_P1_PROTOTYPE_MARKER').first()).toBeAttached({ timeout: 30000 });
    await page.waitForTimeout(1200);
    const focus = await focusAbovePrimary(page);
    const text = await shot(page, cap.id);
    const errorTextSeen = /Unhandled|Error:|Something went wrong/i.test(text);
    records.push({
      id: cap.id, query: cap.query, viewport: `${cap.width ?? 390}x${cap.height ?? 844}`,
      primaryCount: focus.primaryCount, focusableUpToPrimary: focus.focusableUpToPrimary,
      bodyTextLength: text.length, errorTextSeen,
      pageErrors, consoleErrorCount: consoleErrors.length, consoleErrors: consoleErrors.slice(0, 5),
      harnessWrites: fx.writes.length,
      nonGetRequests: [...fx.nonGet],
      unhandledReads: fx.unhandledReads,
    });
    if (pageErrors.length) console.log(`PAGEERROR ${cap.id}: ${pageErrors.join(' | ')}`);
  });
}
