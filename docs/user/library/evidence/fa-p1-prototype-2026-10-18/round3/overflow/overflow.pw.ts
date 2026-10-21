import { expect, test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Overflow diagnosis for the FA-P1 prototype (Expo web dev build, /library/dev-flow-a).
// Fixture helpers (fake OTP login, transport-level Supabase fixtures, non-GET write recording)
// are copied from round3/r3-zoom-status.pw.ts. Non-GET Supabase requests are aborted and recorded.
// Nothing is saved, edited or deleted. Zoom is CSS zoom on <html>, as in round 2 K8 and round 3.

const OUT = __dirname;
const SUPA_HOST = 'ahntbtktjjmvfosgkmgn.supabase.co';
const ACTOR = '11111111-1111-4111-8111-111111111111';
const COVER = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', '..', 'correction-evidence-20261003', 'chooser-390.jpg'));
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

// Runs in the page. Reports every element whose raw rect.right exceeds the viewport/clientWidth.
function measure() {
  const de = document.documentElement;
  const cw = de.clientWidth;
  const vw = window.innerWidth;
  const all = Array.from(document.body.querySelectorAll('*')) as HTMLElement[];
  const over = all.filter(el => el.getBoundingClientRect().right > cw + 0.5);
  const innermost = over.filter(el => !over.some(o => o !== el && el.contains(o)));
  const describe = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const fixedAnc = (() => {
      let a: HTMLElement | null = el;
      while (a && a !== document.body) {
        if (getComputedStyle(a).position === 'fixed') return a.tagName.toLowerCase() + (a.getAttribute('data-testid') ? '[' + a.getAttribute('data-testid') + ']' : '');
        a = a.parentElement;
      }
      return null;
    })();
    return {
      tagName: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      ariaLabel: el.getAttribute('aria-label'),
      testId: el.getAttribute('data-testid'),
      text40: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      rect: { left: +r.left.toFixed(2), right: +r.right.toFixed(2), width: +r.width.toFixed(2) },
      overhangPx: +(r.right - cw).toFixed(2),
      minWidth: cs.minWidth,
      width: cs.width,
      inTabBar: !!el.closest('[role="tablist"],[role="tab"]'),
      inNav: !!el.closest('nav'),
      fixedAncestor: fixedAnc,
      prototypeTestId: el.closest('[data-testid^="fa-"]')?.getAttribute('data-testid') ?? null,
    };
  };
  const top = innermost
    .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)
    .slice(0, 5)
    .map(describe);
  return {
    zoomStyle: de.style.zoom,
    computedZoom: getComputedStyle(de).zoom,
    innerWidth: vw,
    clientWidth: cw,
    scrollWidth: de.scrollWidth,
    overflowingCount: over.length,
    innermostCount: innermost.length,
    top5Innermost: top,
  };
}

// Runs in the page. Finds the outermost tab bar container (highest ancestor of the tablist that
// does not contain prototype content), sets display:none on it, and returns what was hidden.
function hideTabBar() {
  const tl = document.querySelector('[role="tablist"]') as HTMLElement | null;
  if (!tl) return { found: false as const };
  let target: HTMLElement = tl;
  let p = tl.parentElement;
  while (p && p !== document.body && p !== document.documentElement && !p.querySelector('[data-testid^="fa-"]')) {
    target = p;
    p = p.parentElement;
  }
  const info = {
    found: true as const,
    tagName: target.tagName.toLowerCase(),
    testId: target.getAttribute('data-testid'),
    role: target.getAttribute('role'),
    rectRight: +target.getBoundingClientRect().right.toFixed(2),
    rectWidth: +target.getBoundingClientRect().width.toFixed(2),
  };
  target.style.display = 'none';
  return info;
}

const RESULTS: Record<string, unknown> = {};
function save() {
  fs.writeFileSync(path.join(OUT, 'overflow-results.json'), JSON.stringify(RESULTS, null, 2));
}

const CASES = [
  { id: 'zoom2-w390', width: 390, zoom: '2' },
  { id: 'zoom1-w320', width: 320, zoom: '' },
];

for (const c of CASES) {
  test(`overflow ${c.id}`, async ({ page }) => {
    await page.setViewportSize({ width: c.width, height: 844 });
    await start(page);
    await page.goto('/library/dev-flow-a?s=populated&phase=daylight');
    await expect(page.getByTestId('FA_P1_PROTOTYPE_MARKER').first()).toBeAttached({ timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.evaluate((z) => { document.documentElement.style.zoom = z; }, c.zoom);
    await page.waitForTimeout(600);

    const step1 = await page.evaluate(measure);
    const tabInfo = await page.evaluate(hideTabBar);
    await page.waitForTimeout(300);
    const step3 = await page.evaluate(measure);

    RESULTS[c.id] = {
      viewport: { width: c.width, height: 844 },
      requestedZoom: c.zoom || '(none)',
      step1_beforeHide: step1,
      tabBarHidden: tabInfo,
      step3_afterHide: { scrollWidth: step3.scrollWidth, overflowingCount: step3.overflowingCount, innermostCount: step3.innermostCount, top5Innermost: step3.top5Innermost },
      nonGetRequests: Array.from(new Set(fx.nonGet)),
      writes: fx.writes,
    };
    save();
    await page.screenshot({ path: path.join(OUT, `${c.id}-overflow.png`) });
  });
}
