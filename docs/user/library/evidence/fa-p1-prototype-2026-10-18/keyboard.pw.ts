import { expect, test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Keyboard and screen-reader-semantics check for the FA-P1 prototype (/library/dev-flow-a).
// Fake-auth harness copied from capture.pw.ts (that file registers its own tests, so it is not imported).
// Every https request is intercepted: Supabase GET reads answered from fixtures, every other method aborted.
// Nothing is saved, edited or deleted. Writes results to keyboard-results.json next to this file.

const OUT = __dirname;
const SUPA_HOST = 'ahntbtktjjmvfosgkmgn.supabase.co';
const ACTOR = '11111111-1111-4111-8111-111111111111';
// 1x1 transparent GIF stands in for covers (cover content is irrelevant to keyboard semantics).
const COVER = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const SESSION = {
  access_token: 'fixture-access-token', refresh_token: 'fixture-refresh-token',
  expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
  user: { id: ACTOR, email: 'fixture@booktalks.test', phone: '+911234567890', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
};
const READ_RPC: Record<string, unknown> = { check_note_word_limit: true, check_page_word_limit: true, get_public_book_reviews: [] };
const PROFILE = { id: 'profile-fixture', user_id: ACTOR, display_name: 'Fixture', username: 'fixture', account_type: 'user', membership_tier: 'free', trust_score: 10 };

const writesBlocked: string[] = [];
const nonGet: string[] = [];

async function installRoutes(page: Page) {
  page.on('request', req => { if (req.method() !== 'GET') nonGet.push(`${req.method()} ${req.url().split('?')[0]}`); });
  await page.route(/^https:\/\//, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      route.fulfill({ status, contentType: 'application/json', headers, body: method === 'HEAD' ? '' : JSON.stringify(body) });
    if (url.hostname === 'covers.fixture.test') return route.fulfill({ status: 200, contentType: 'image/gif', body: COVER });
    if (url.hostname === 'www.googleapis.com' || url.hostname === 'openlibrary.org') return json(200, { totalItems: 0, items: [], numFound: 0, docs: [] });
    if (url.hostname !== SUPA_HOST) return route.abort();
    const p = url.pathname;
    if (p === '/auth/v1/otp') return json(200, {});
    if (p === '/auth/v1/verify' || p === '/auth/v1/token') return json(200, SESSION);
    if (p === '/auth/v1/user') return json(200, SESSION.user);
    if (!p.startsWith('/rest/v1/')) { writesBlocked.push(`${method} ${p}`); return route.abort(); }
    const resource = p.slice('/rest/v1/'.length);
    if (method === 'POST' && resource.startsWith('rpc/')) {
      const fn = resource.slice(4);
      if (fn in READ_RPC) return json(200, READ_RPC[fn]);
      writesBlocked.push(`POST ${p}`); return route.abort();
    }
    if (method !== 'GET' && method !== 'HEAD') { writesBlocked.push(`${method} ${p}`); return route.abort(); }
    const isSingle = (req.headers()['accept'] ?? '').includes('application/vnd.pgrst.object+json');
    const rows: any[] = resource === 'user_profiles' ? [PROFILE] : [];
    if (isSingle) return rows.length === 1 ? json(200, rows[0]) : json(406, { code: 'PGRST116', message: 'multiple (or no) rows returned', details: null, hint: null });
    return json(200, rows, { 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' });
  });
}

async function login(page: Page) {
  await page.addInitScript(() => { Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true }); });
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
}

// Accessible-name approximation: aria-labelledby > aria-label > visible text > title.
const ACC_NAME = `(el) => {
  const lb = el.getAttribute('aria-labelledby');
  if (lb) return lb.split(/\\s+/).map(id => document.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim();
  const al = el.getAttribute('aria-label'); if (al) return al.trim();
  const t = (el.innerText ?? el.textContent ?? '').trim(); if (t) return t.replace(/\\s+/g, ' ');
  return (el.getAttribute('title') ?? '').trim();
}`;

type Info = { tag: string; role: string; name: string; ariaChecked: string | null; ariaExpanded: string | null; tabindex: string | null; inTabBar: boolean; outline: string; boxShadow: string };

const focusInfo = (page: Page): Promise<Info | null> => page.evaluate(`(() => {
  const accName = ${ACC_NAME};
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const role = el.getAttribute('role') || (el.tagName === 'A' ? 'link' : el.tagName === 'BUTTON' ? 'button' : el.tagName.toLowerCase());
  const cs = getComputedStyle(el);
  return { tag: el.tagName, role, name: accName(el), ariaChecked: el.getAttribute('aria-checked'), ariaExpanded: el.getAttribute('aria-expanded'),
    tabindex: el.getAttribute('tabindex'), inTabBar: !!el.closest('[role="tablist"],[role="tab"],nav'),
    outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, boxShadow: cs.boxShadow };
})()`);

const fmt = (i: Info | null) => (i ? `${i.role} "${i.name}"${i.ariaChecked != null ? ` aria-checked=${i.ariaChecked}` : ''}${i.ariaExpanded != null ? ` aria-expanded=${i.ariaExpanded}` : ''}${i.inTabBar ? ' [tab bar]' : ''}` : '(body)');

test('FA-P1 keyboard and semantics check', async ({ page }) => {
  test.setTimeout(600000);
  page.setDefaultTimeout(15000);
  const R: Record<string, unknown> = {};
  const BASE = '/library/dev-flow-a';
  await login(page);
  await page.goto(`${BASE}?s=populated&phase=daylight`);
  await expect(page.getByTestId('FA_P1_PROTOTYPE_MARKER').first()).toBeAttached({ timeout: 60000 });
  await page.waitForTimeout(1500);

  R.radioDom = await page.locator('[role="radio"]').evaluateAll((els: Element[]) => els.map(e => e.outerHTML.slice(0, 400)));

  // K1 Tab order from page start until "Add note"
  {
    const seq: string[] = []; const infos: Info[] = [];
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
    await page.evaluate(() => window.scrollTo(0, 0));
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      const inf = await focusInfo(page);
      if (!inf) { seq.push('(none)'); continue; }
      infos.push(inf); seq.push(fmt(inf));
      if (/^Add note/i.test(inf.name)) break;
    }
    R.K1 = { sequence: seq, count: seq.length, infos };
  }

  // K2 Radio group arrow-key behaviour
  {
    const radios = page.locator('[role="radio"]');
    const radioStates = async () => radios.evaluateAll((els: Element[]) => els.map(e => ({ name: (e as HTMLElement).innerText.trim() || e.getAttribute('aria-label'), checked: e.getAttribute('aria-checked'), tabindex: e.getAttribute('tabindex'), focused: e === document.activeElement })));
    const initial = await radioStates();
    const checkedIdxAttr = initial.findIndex(r => r.checked === 'true');
    const checkedIdx = checkedIdxAttr >= 0 ? checkedIdxAttr : initial.findIndex(r => r.name === 'Reading');
    await radios.nth(checkedIdx).focus();
    const steps: Record<string, unknown>[] = [{ action: 'start', focused: fmt(await focusInfo(page)), states: await radioStates() }];
    await page.keyboard.press('ArrowRight');
    steps.push({ action: 'ArrowRight', focused: fmt(await focusInfo(page)), states: await radioStates() });
    await page.keyboard.press('ArrowLeft');
    steps.push({ action: 'ArrowLeft', focused: fmt(await focusInfo(page)), states: await radioStates() });
    R.K2 = { radioCount: initial.length, checkedIndex: checkedIdx, initial, steps };
  }

  // K3 Focus visibility screenshots
  {
    const back = page.getByRole('button', { name: /Back to Library/i }).first();
    const radio = page.getByRole('radio', { name: 'Reading' }).first();
    const add = page.getByRole('button', { name: /^Add note/i }).first();
    const k3: Record<string, unknown> = {};
    for (const [key, loc] of [['back', back], ['radio', radio], ['addnote', add]] as const) {
      const blurStyle = await loc.evaluate((el: HTMLElement) => { el.blur(); const c = getComputedStyle(el); return c.outlineStyle + ' ' + c.outlineWidth + '|' + c.boxShadow; });
      await loc.focus();
      const focusStyle = await loc.evaluate((el: HTMLElement) => { const c = getComputedStyle(el); return c.outlineStyle + ' ' + c.outlineWidth + ' ' + c.outlineColor + '|' + c.boxShadow; });
      const file = `kb-k3-focus-${key}.png`;
      await loc.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(OUT, file) });
      k3[key] = { blurred: blurStyle, focused: focusStyle, screenshot: file, focusedIsActive: await loc.evaluate((el: Element) => el === document.activeElement) };
    }
    R.K3 = k3;
  }

  // K4 Rows after the primary button
  {
    const seq: string[] = []; const infos: Info[] = [];
    await page.getByRole('button', { name: /^Add note/i }).first().focus();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const inf = await focusInfo(page);
      seq.push(fmt(inf)); if (inf) infos.push(inf);
    }
    const row = page.locator('[data-testid^="fa-row-"]', { hasText: 'My review' }).first();
    const rowExists = await row.count();
    let before: string | null = null, after: string | null = null;
    if (rowExists) {
      await row.focus();
      before = await row.getAttribute('aria-expanded');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      after = await row.getAttribute('aria-expanded');
    }
    R.K4 = { next6: seq, myReviewRowFound: rowExists > 0, ariaExpandedBefore: before, ariaExpandedAfter: after };
  }

  // K5 Remove dialog
  {
    await page.goto(`${BASE}?s=populated&phase=daylight&open=remove`);
    await expect(page.getByTestId('fa-dialog').first()).toBeAttached({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const atOpen = fmt(await focusInfo(page));
    const tabs: string[] = [];
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); tabs.push(fmt(await focusInfo(page))); }
    const hidden = await page.evaluate(() => {
      const pg = document.querySelector('[data-testid="fa-page"]') as HTMLElement | null;
      const dlg = document.querySelector('[data-testid="fa-dialog"]') as HTMLElement | null;
      return {
        pageAriaHidden: pg?.getAttribute('aria-hidden') ?? null,
        pageInert: pg ? pg.hasAttribute('inert') : null,
        pageImportantForAccessibility: pg?.getAttribute('importantForAccessibility') ?? null,
        dialogAriaModal: dlg?.getAttribute('aria-modal') ?? null,
        dialogRole: dlg?.getAttribute('role') ?? null,
        dialogPresent: !!dlg,
      };
    });
    await page.screenshot({ path: path.join(OUT, 'kb-k5-remove-open.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    const afterEsc = await page.evaluate(() => ({ dialogPresent: !!document.querySelector('[data-testid="fa-dialog"]') }));
    const focusAfter = fmt(await focusInfo(page));
    R.K5 = { focusAtOpen: atOpen, tabSixTimes: tabs, ...hidden, escapeClosesDialog: !afterEsc.dialogPresent, focusAfterEscape: focusAfter };
  }

  // K6 Accessible names of buttons, radios and links (excluding tab bar)
  {
    await page.goto(`${BASE}?s=populated&phase=daylight`);
    await expect(page.getByTestId('FA_P1_PROTOTYPE_MARKER').first()).toBeAttached({ timeout: 60000 });
    await page.waitForTimeout(1000);
    const items = await page.evaluate(`(() => {
      const accName = ${ACC_NAME};
      const sel = '[role="button"],[role="radio"],[role="link"],a[href],button';
      return Array.from(document.querySelectorAll(sel)).filter(el => !el.closest('[role="tablist"],[role="tab"],nav')).map(el => ({
        role: el.getAttribute('role') || el.tagName.toLowerCase(), name: accName(el), testid: el.getAttribute('data-testid'), hiddenAncestor: !!el.closest('[aria-hidden="true"]') }));
    })()`) as { role: string; name: string; testid: string | null; hiddenAncestor: boolean }[];
    R.K6 = { total: items.length, emptyNames: items.filter(i => !i.name), items };
  }

  // K7 Headings
  {
    const headings = await page.evaluate(() => Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')).map(el => ({
      tag: el.tagName, ariaLevel: el.getAttribute('aria-level'), text: (el as HTMLElement).innerText.trim().slice(0, 80) })));
    const landmarks = await page.evaluate(() => Array.from(document.querySelectorAll('[role="main"],main,[role="navigation"],nav,[role="banner"],header,[role="contentinfo"],[role="region"]')).map(el => el.getAttribute('role') || el.tagName.toLowerCase()));
    R.K7 = { headings, landmarks };
  }

  // K8 200% text approximation at 390x844
  {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}?s=populated&phase=daylight`);
    await expect(page.getByTestId('FA_P1_PROTOTYPE_MARKER').first()).toBeAttached({ timeout: 60000 });
    await page.waitForTimeout(1000);
    const overflowCheck = `(() => {
      const vw = window.innerWidth;
      const clipped = Array.from(document.querySelectorAll('body *')).filter(el => {
        const r = el.getBoundingClientRect();
        const hasText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
        return hasText && r.width > 0 && (r.right > vw + 1 || el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible');
      }).slice(0, 15).map(el => ({ tag: el.tagName, text: el.innerText.trim().slice(0, 60), right: Math.round(el.getBoundingClientRect().right), scrollW: el.scrollWidth, clientW: el.clientWidth }));
      return { innerWidth: vw, docScrollWidth: document.documentElement.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > vw + 1, clipped };
    })()`;
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await page.waitForTimeout(500);
    const fontCheck = await page.evaluate(overflowCheck);
    await page.screenshot({ path: path.join(OUT, 'kb-k8-font200-390.png') });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await page.waitForTimeout(500);
    const zoomCheck = await page.evaluate(overflowCheck);
    await page.screenshot({ path: path.join(OUT, 'kb-k8-font200-zoom2-390.png') });
    R.K8 = { fontSize200: fontCheck, fontSize200PlusZoom2: zoomCheck };
  }

  fs.writeFileSync(path.join(OUT, 'keyboard-results.json'), JSON.stringify({ results: R, writesBlocked, nonGet }, null, 2));
});
