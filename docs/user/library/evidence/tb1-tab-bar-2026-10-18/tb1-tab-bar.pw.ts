import { expect, test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// TB-1 global tab bar web verification (Expo web on port 8084, worktree Bookconnect4_fu1a, branch sdd07/tab-bar).
// Fixture transport copied from library-screen-audit-2026-10-18/capture.pw.ts (simplified).
// Every https request is intercepted. Supabase GET/HEAD reads come from fixtures. Non-GET Supabase
// requests are aborted and recorded. Fake OTP login only. Nothing saved, edited or deleted.
// Theme phase is forced by overriding Date.prototype.getHours (12 daylight, 18 golden, 22 midnight).

const OUT = __dirname;
const SUPA_HOST = 'ahntbtktjjmvfosgkmgn.supabase.co';
const ACTOR = '11111111-1111-4111-8111-111111111111';
const COVER = fs.readFileSync(path.resolve(OUT, '..', '..', 'correction-evidence-20261003', 'chooser-390.jpg'));
const SESSION = {
  access_token: 'fixture-access-token', refresh_token: 'fixture-refresh-token',
  expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
  user: { id: ACTOR, email: 'fixture@booktalks.test', phone: '+911234567890', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
};
const READ_RPC: Record<string, unknown> = { check_note_word_limit: true, check_page_word_limit: true, get_public_book_reviews: [] };
const PROFILE = { id: 'profile-fixture', user_id: ACTOR, display_name: 'Fixture', username: 'fixture', account_type: 'user', membership_tier: 'free', trust_score: 10 };
const TS = '2026-10-01T00:00:00Z';
const BOOK_ID = 'bbbbbbbb-0000-4000-8000-000000000001';
const UB_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const BOOK = {
  id: BOOK_ID, google_books_id: null, title: 'The Cover Fixture Book', subtitle: null, authors: ['Ada Cover'],
  cover_url: 'https://covers.fixture.test/cover-1.jpg', description: null, page_count: 320, categories: null,
  publisher: 'Fixture Pub', published_date: '2020', isbn_13: null,
};
const USER_BOOK = {
  id: UB_ID, user_id: ACTOR, book_id: BOOK_ID, reading_status: 'reading', ownership: 'owned', condition: 'good',
  rating: null, review: null, review_is_public: false, available_for_lending: false, created_at: TS, updated_at: TS, book: BOOK,
};
const PHASES = [
  { name: 'daylight', hour: 12 },
  { name: 'golden', hour: 18 },
  { name: 'midnight', hour: 22 },
] as const;
const TABS = ['Library', 'Exchange', 'Marketplace', 'Clubs', 'Profile'] as const;

type Fx = { nonGet: string[]; authCalls: string[]; rpcPosts: string[]; writes: string[]; externalGets: string[] };
let fx: Fx = { nonGet: [], authCalls: [], rpcPosts: [], writes: [], externalGets: [] };
const errors: string[] = [];
const RESULTS_FILE = path.join(OUT, 'tb1-results.json');
// Merge with any earlier run's results so a partial (-g) run does not drop other checks.
const results: Record<string, unknown> = fs.existsSync(RESULTS_FILE) ? JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8')) : {};
const save = () => fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

async function installRoutes(page: Page) {
  page.on('pageerror', e => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 200)}`); });
  page.on('request', req => {
    if (req.method() !== 'GET') fx.nonGet.push(`${req.method()} ${req.url().split('?')[0]}`);
  });
  await page.route(/^https:\/\//, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      route.fulfill({ status, contentType: 'application/json', headers, body: method === 'HEAD' ? '' : JSON.stringify(body) });
    if (url.hostname === 'covers.fixture.test') return route.fulfill({ status: 200, contentType: 'image/jpeg', body: COVER });
    if (url.hostname === 'www.googleapis.com' || url.hostname === 'openlibrary.org') {
      fx.externalGets.push(url.hostname);
      return json(200, url.hostname === 'openlibrary.org' ? { numFound: 0, docs: [] } : { totalItems: 0, items: [] });
    }
    if (url.hostname !== SUPA_HOST) return route.abort();
    const p = url.pathname;
    if (p === '/auth/v1/otp') { fx.authCalls.push('POST /auth/v1/otp'); return json(200, {}); }
    if (p === '/auth/v1/verify' || p === '/auth/v1/token') { fx.authCalls.push(`POST ${p}`); return json(200, SESSION); }
    if (p === '/auth/v1/user') return json(200, SESSION.user);
    if (!p.startsWith('/rest/v1/')) { fx.writes.push(`${method} ${p}`); return route.abort(); }
    const resource = p.slice('/rest/v1/'.length);
    if (method === 'POST' && resource.startsWith('rpc/')) {
      const fn = resource.slice(4);
      if (fn in READ_RPC) { fx.rpcPosts.push(`POST ${fn}`); return json(200, READ_RPC[fn]); }
      fx.writes.push(`POST ${p}`); return route.abort();
    }
    if (method !== 'GET' && method !== 'HEAD') { fx.writes.push(`${method} ${p}`); return route.abort(); }
    const accept = req.headers()['accept'] ?? '';
    const isSingle = accept.includes('application/vnd.pgrst.object+json');
    let rows: any[] = [];
    if (resource === 'user_profiles') rows = [PROFILE];
    else if (resource === 'user_books') rows = [USER_BOOK];
    else if (resource === 'books') rows = [BOOK];
    if (isSingle) {
      if (rows.length === 1) return json(200, rows[0]);
      return json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: null, hint: null });
    }
    return json(200, rows, { 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' });
  });
}

async function start(page: Page, hour: number) {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
  });
  await page.addInitScript((h: number) => { Date.prototype.getHours = function () { return h; }; }, hour);
  await installRoutes(page);
  await page.goto('/login', { timeout: 180000 });
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

// Runs in page. Describes every role=tab button in the bar.
function tabReport() {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]')) as HTMLElement[];
  const bg = (el: HTMLElement | null) => {
    let e: HTMLElement | null = el;
    while (e && e !== document.documentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return { value: c, tag: e.tagName.toLowerCase() };
      e = e.parentElement;
    }
    return { value: null, tag: null };
  };
  return tabs.map(t => {
    const name = t.getAttribute('aria-label') || t.id;
    const r = t.getBoundingClientRect();
    const frame = t.querySelector('[data-testid="tab-icon-frame"]') as HTMLElement | null;
    const glyphEls = frame ? Array.from(frame.querySelectorAll('*')).filter(e => (e as HTMLElement).textContent && (e as HTMLElement).textContent!.trim() !== '' && e.children.length === 0) as HTMLElement[] : [];
    const glyph = glyphEls[0];
    const label = Array.from(t.querySelectorAll('div,span')).find(e => !(e as HTMLElement).closest('[id^="tb1-probe-"]') && e.children.length === 0 && (e.textContent || '').trim() === name) as HTMLElement | undefined;
    const bar = bg(t);
    const lr = label ? label.getBoundingClientRect() : null;
    return {
      name,
      id: t.id,
      rect: { x: +r.x.toFixed(1), right: +r.right.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1) },
      labelVisible: !!label,
      labelText: label ? (label.textContent || '') : null,
      labelOverflow: label ? { scrollWidth: label.scrollWidth, clientWidth: label.clientWidth, textOverflow: getComputedStyle(label).textOverflow, insideButton: !!lr && lr.left >= r.left - 0.5 && lr.right <= r.right + 0.5 } : null,
      labelColor: label ? getComputedStyle(label).color : null,
      labelFontWeight: label ? getComputedStyle(label).fontWeight : null,
      labelFontSize: label ? getComputedStyle(label).fontSize : null,
      iconGlyph: glyph ? glyph.textContent!.trim().slice(0, 4) : null,
      iconGlyphCodepoints: glyph ? Array.from(glyph.textContent!.trim().slice(0, 2)).map(c => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase()) : null,
      iconFontFamily: glyph ? getComputedStyle(glyph).fontFamily : null,
      iconSvgCount: frame ? frame.querySelectorAll('svg').length : 0,
      iconColor: glyph ? getComputedStyle(glyph).color : null,
      barBackground: bar.value,
      barBackgroundTag: bar.tag,
      ariaSelected: t.getAttribute('aria-selected'),
      ariaLabel: t.getAttribute('aria-label'),
    };
  });
}

function pageMetrics() {
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    innerWidth: window.innerWidth,
    zoom: document.documentElement.style.zoom || '(none)',
  };
}

async function tabsFor(page: Page) {
  return page.evaluate(tabReport);
}

// ---------- V1 ----------
for (const phase of PHASES) {
  test(`V1 ${phase.name} tab bar at 390x844`, async ({ page }) => {
    test.setTimeout(300000);
    await page.setViewportSize({ width: 390, height: 844 });
    await start(page, phase.hour);
    const out: Record<string, unknown> = {};
    for (const tab of TABS) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await page.waitForTimeout(1500);
      const slug = tab.toLowerCase();
      await page.screenshot({ path: path.join(OUT, `v1-${phase.name}-${slug}.png`) });
      out[slug] = { url: new URL(page.url()).pathname };
    }
    const report = await tabsFor(page);
    out.tabCount = report.length;
    out.tabs = report;
    out.bodyBackgroundStyle = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    results[`V1-${phase.name}`] = out;
    save();
  });
}

// ---------- V2 ----------
test('V2 zoom 2 at 390x844 (library home and book details) and zoom 1 at 320', async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, 12);
  const out: Record<string, unknown> = {};
  const zoomed = async (label: string, url: string | null, file: string) => {
    if (url) { await page.goto(url, { timeout: 120000 }); await page.waitForTimeout(2500); }
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await page.waitForTimeout(800);
    const m = await page.evaluate(pageMetrics);
    const tabs = await tabsFor(page);
    await page.screenshot({ path: path.join(OUT, file) });
    out[label] = {
      metrics: m,
      labelsVisibleCount: tabs.filter(t => t.labelVisible).length,
      tabsWithAriaLabel: tabs.map(t => ({ name: t.name, ariaLabel: t.ariaLabel })),
      tabCount: tabs.length,
    };
    await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  };
  await zoomed('library-home-zoom2-390', '/library', 'v2-library-home-zoom2-390.png');
  await zoomed('book-details-zoom2-390', `/library/${UB_ID}`, 'v2-book-details-zoom2-390.png');
  // zoom 1 at 320
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/library', { timeout: 120000 });
  await page.waitForTimeout(2500);
  const m320 = await page.evaluate(pageMetrics);
  const t320 = await tabsFor(page);
  await page.screenshot({ path: path.join(OUT, 'v2-library-home-w320.png') });
  out['library-home-zoom1-320'] = { metrics: m320, labelsVisibleCount: t320.filter(t => t.labelVisible).length, labelTexts: t320.map(t => t.labelText), tabCount: t320.length };
  results.V2 = out;
  save();
});

// ---------- V3 ----------
test('V3 back navigation from marketplace cart and tab history', async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, 12);
  const steps: Array<Record<string, unknown>> = [];
  const rec = (step: string) => steps.push({ step, path: new URL(page.url()).pathname });
  await page.getByRole('tab', { name: 'Marketplace', exact: true }).click();
  await page.waitForTimeout(1500); rec('after tap Marketplace');
  await page.goto('/marketplace/cart', { timeout: 120000 }); await page.waitForTimeout(2000); rec('after goto /marketplace/cart');
  const inAppBack = page.getByRole('button', { name: /back/i }).first();
  const hasInAppBack = (await inAppBack.count()) > 0;
  await page.goBack(); await page.waitForTimeout(2000); rec('after browser Back');
  await page.getByRole('tab', { name: 'Clubs', exact: true }).click(); await page.waitForTimeout(1500); rec('after tap Clubs');
  await page.getByRole('tab', { name: 'Library', exact: true }).click(); await page.waitForTimeout(1500); rec('after tap Library');
  await page.goBack(); await page.waitForTimeout(2000); rec('after browser Back (expect Clubs)');
  results.V3 = { steps, inAppBackButtonOnCartFound: hasInAppBack };
  if (hasInAppBack) {
    await page.goto('/marketplace/cart', { timeout: 120000 }); await page.waitForTimeout(2000);
    await page.getByRole('button', { name: /back/i }).first().click(); await page.waitForTimeout(2000);
    (results.V3 as any).inAppBackPath = new URL(page.url()).pathname;
  }
  save();
});

// ---------- V4 ----------
test('V4 keyboard focus order, focus outline, Space activation, mouse click no outline', async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, 12);
  await page.evaluate(() => {
    (window as any).__tabClicks = 0;
    document.addEventListener('click', e => { if ((e.target as HTMLElement).closest?.('[role="tab"]')) (window as any).__tabClicks++; }, true);
    (document.activeElement as HTMLElement | null)?.blur?.();
  });
  await page.mouse.click(195, 300); // neutral point, no focus on tab bar
  const focused = () => page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    return a ? { role: a.getAttribute('role'), aria: a.getAttribute('aria-label'), tag: a.tagName.toLowerCase() } : null;
  });
  // Tab until first tab button is focused (bounded)
  let reached = false; let presses = 0;
  for (; presses < 80; presses++) {
    await page.keyboard.press('Tab');
    const f = await focused();
    if (f?.role === 'tab') { reached = true; break; }
  }
  const order: string[] = [];
  const first = await focused();
  if (first?.aria) order.push(first.aria);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    const f = await focused();
    order.push(f?.role === 'tab' ? f.aria! : `(non-tab: ${f?.tag})`);
  }
  // Focus outline on currently focused tab (Profile) - capture style + screenshot
  const outlineInfo = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement;
    const cs = getComputedStyle(a);
    return { id: a.id, aria: a.getAttribute('aria-label'), outline: cs.outline, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor, focusVisible: a.matches(':focus-visible') };
  });
  // Move focus back to Clubs via shift+Tab x2 from Profile (Profile -> Clubs)
  await page.keyboard.press('Shift+Tab');
  const clubsFocused = await focused();
  await page.evaluate(() => { (window as any).__tabClicks = 0; });
  const clubsOutline = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement;
    const cs = getComputedStyle(a);
    return { aria: a.getAttribute('aria-label'), outline: cs.outline, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, focusVisible: a.matches(':focus-visible') };
  });
  await page.locator('#tb1-tab-Clubs, [role="tab"][aria-label="Clubs"]').first().screenshot({ path: path.join(OUT, 'v4-focus-clubs-element.png') }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, 'v4-focus.png') });
  const before = page.url();
  await page.keyboard.press('Space');
  await page.waitForTimeout(1500);
  const afterSpace = await page.evaluate(() => ({
    clicks: (window as any).__tabClicks,
    clubsAriaSelected: document.querySelector('[role="tab"][aria-label="Clubs"]')?.getAttribute('aria-selected'),
  }));
  const afterSpaceUrl = new URL(page.url()).pathname;
  // mouse click Profile: no outline should be drawn
  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await page.waitForTimeout(1200);
  const mouseOutline = await page.evaluate(() => {
    const a = document.querySelector('[role="tab"][aria-label="Profile"]') as HTMLElement;
    const cs = getComputedStyle(a);
    return { outline: cs.outline, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, focusVisible: a.matches(':focus-visible'), active: document.activeElement === a };
  });
  await page.screenshot({ path: path.join(OUT, 'v4-after-mouse-click-profile.png') });
  results.V4 = {
    tabReached: reached, tabPressesToReach: presses, firstFocused: first,
    orderAfterFirst: order, outlineOnFirstReached: outlineInfo, shiftTabToClubs: clubsFocused, clubsOutline,
    spaceOnClubs: { urlBefore: new URL(before).pathname, urlAfter: afterSpaceUrl, ...afterSpace },
    mouseClickProfileOutline: mouseOutline,
  };
  save();
});

// ---------- V6 ----------
test('V6 hidden routes render screens and have no tab buttons', async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, 12);
  const out: Record<string, unknown> = {};
  for (const route of ['/marketplace/cart', '/marketplace/requests']) {
    await page.goto(route, { timeout: 120000 }); await page.waitForTimeout(2500);
    const text = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 240);
    const unmatched = /unmatched|not found|doesn.t exist|404/i.test(text);
    const tabs = await tabsFor(page);
    const hiddenTabNames = tabs.map(t => t.name);
    out[route] = { path: new URL(page.url()).pathname, bodyTextStart: text, looksUnmatched: unmatched, tabButtonNames: hiddenTabNames, tabButtonCount: tabs.length, hasCartOrRequestsOrBookTab: hiddenTabNames.some(n => /cart|request|book/i.test(n)) };
    await page.screenshot({ path: path.join(OUT, `v6-${route.split('/').pop()}.png`) });
  }
  results.V6 = out;
  save();
});

// ---------- D1 diagnostics (label fit at widths, icon font load, cart/requests after longer wait) ----------
test('D1 diagnostics: label probe widths, icon font, cart wait', async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, 12);
  const probe = () => page.evaluate(() => {
    const names = ['Library', 'Exchange', 'Marketplace', 'Clubs', 'Profile'];
    const slot = (n: string) => (document.querySelector(`[role="tab"][aria-label="${n}"]`) as HTMLElement | null)?.getBoundingClientRect().width;
    const probeW = (n: string, w: string) => (document.querySelector(`[id="tb1-probe-${n}-${w}"]`) as HTMLElement | null)?.getBoundingClientRect().width;
    return {
      viewport: window.innerWidth,
      rows: names.map(n => ({ name: n, slotWidth: slot(n), probe400: probeW(n, '400'), probe700: probeW(n, '700') })),
      ionFontLoaded: document.fonts ? Array.from(document.fonts).filter(f => /ionicons/i.test(f.family)).map(f => `${f.family}:${f.status}`) : null,
    };
  });
  const out: Record<string, unknown> = { at390: await probe() };
  for (const w of [360, 430, 320]) {
    await page.setViewportSize({ width: w, height: 844 });
    await page.waitForTimeout(1200);
    out[`at${w}`] = await probe();
    if (w === 430) await page.screenshot({ path: path.join(OUT, 'd1-w430-library.png') });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/marketplace/cart', { timeout: 120000 });
  await page.waitForTimeout(9000);
  out.cartAfter9s = { path: new URL(page.url()).pathname, bodyTextStart: (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200) };
  await page.screenshot({ path: path.join(OUT, 'd1-cart-after-9s.png') });
  results.D1 = out;
  save();
});

test.afterAll(() => {
  results.V7 = {
    pageAndConsoleErrorsCount: errors.length,
    pageAndConsoleErrorsSample: Array.from(new Set(errors)).slice(0, 30),
    nonGetRequests: Array.from(new Set(fx.nonGet)),
    nonGetFromFixtureLayer: fx.writes,
    authCalls: Array.from(new Set(fx.authCalls)),
    rpcReadPosts: Array.from(new Set(fx.rpcPosts)),
    externalGets: Array.from(new Set(fx.externalGets)),
  };
  save();
});
