import { expect, test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Round 2 keyboard and screen-reader-semantics check for the FA-P1 prototype (/library/dev-flow-a).
// Fake-auth harness copied from round2/capture.pw.ts. Every https request is intercepted: Supabase GET
// reads answered from fixtures, every other method aborted. Nothing is saved, edited or deleted.
// Output: round2/keyboard-results.json (raw data plus a PASS/FAIL verdict per check K1-K9).

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
const EXPECTED_TITLE = 'Walden';

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

type Info = {
  tag: string; role: string; name: string; ariaChecked: string | null; ariaExpanded: string | null;
  ariaDisabled: string | null; disabled: boolean; tabindex: string | null; inTabBar: boolean;
  outlineStyle: string; outlineWidth: string; outlineColor: string; boxShadow: string;
};

const focusInfo = (page: Page): Promise<Info | null> => page.evaluate(`(() => {
  const accName = ${ACC_NAME};
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const role = el.getAttribute('role') || (el.tagName === 'A' ? 'link' : el.tagName === 'BUTTON' ? 'button' : el.tagName.toLowerCase());
  const cs = getComputedStyle(el);
  return { tag: el.tagName, role, name: accName(el), ariaChecked: el.getAttribute('aria-checked'), ariaExpanded: el.getAttribute('aria-expanded'),
    ariaDisabled: el.getAttribute('aria-disabled'), disabled: !!el.disabled, tabindex: el.getAttribute('tabindex'),
    inTabBar: !!el.closest('[role="tablist"],[role="tab"],nav'),
    outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor, boxShadow: cs.boxShadow };
})()`);

const fmt = (i: Info | null) => (i ? `${i.role} "${i.name}"${i.ariaChecked != null ? ` aria-checked=${i.ariaChecked}` : ''}${i.ariaExpanded != null ? ` aria-expanded=${i.ariaExpanded}` : ''}${i.inTabBar ? ' [tab bar]' : ''}` : '(body)');

const V: Record<string, { verdict: 'PASS' | 'FAIL'; detail: unknown }> = {};
async function check(id: string, fn: () => Promise<{ pass: boolean; detail: unknown }>) {
  try {
    const r = await fn();
    V[id] = { verdict: r.pass ? 'PASS' : 'FAIL', detail: r.detail };
  } catch (e) {
    V[id] = { verdict: 'FAIL', detail: { error: String(e).slice(0, 400) } };
  }
  console.log(`${id}: ${V[id].verdict}`);
}

test('FA-P1 round 2 keyboard and semantics check', async ({ page }) => {
  test.setTimeout(600000);
  page.setDefaultTimeout(15000);
  const BASE = '/library/dev-flow-a';
  const goto = async (query: string) => {
    await page.goto(`${BASE}?${query}`);
    await expect(page.getByTestId('FA_P1_PROTOTYPE_MARKER').first()).toBeAttached({ timeout: 60000 });
    await page.waitForTimeout(1200);
  };
  await login(page);
  await goto('s=populated&phase=daylight');

  // K1 + K3: Tab from page start until "Add note"; record focus style at each stop and screenshot the first three.
  const stops: Info[] = [];
  const k3: Record<string, unknown> = {};
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur?.(); window.scrollTo(0, 0); });
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const inf = await focusInfo(page);
    if (!inf) continue;
    stops.push(inf);
    const key = /Back to Library/i.test(inf.name) ? 'back' : inf.role === 'radio' && inf.ariaChecked === 'true' ? 'radio' : /^Add note/i.test(inf.name) ? 'addnote' : null;
    if (key) {
      const file = `kb-k3-focus-${key}.png`;
      await page.screenshot({ path: path.join(OUT, file) });
      k3[key] = { name: inf.name, outlineStyle: inf.outlineStyle, outlineWidth: inf.outlineWidth, outlineColor: inf.outlineColor, boxShadow: inf.boxShadow, screenshot: file };
    }
    if (/^Add note/i.test(inf.name)) break;
  }
  const primaryIdx = stops.findIndex(s => /^Add note/i.test(s.name));

  await check('K1', async () => {
    const first3 = stops.slice(0, 3);
    const pass = primaryIdx === 2 && first3.length === 3
      && first3[0].role === 'button' && /Back to Library/i.test(first3[0].name)
      && first3[1].role === 'radio' && first3[1].ariaChecked === 'true'
      && /^Add note/i.test(first3[2].name);
    return { pass, detail: { stopsBeforeAndIncludingPrimary: stops.map(fmt) } };
  });

  await check('K3', async () => {
    const ringed = (s: { outlineStyle: string; outlineWidth: string; boxShadow: string } | undefined) =>
      !!s && ((s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow !== 'none' && s.boxShadow !== ''));
    const back = k3.back as any, radio = k3.radio as any, addnote = k3.addnote as any;
    const pass = ringed(back) && ringed(radio) && ringed(addnote);
    return { pass, detail: { back, radio, addnote } };
  });

  // K2: radio group semantics and arrow keys (on the populated page).
  await check('K2', async () => {
    const radios = page.locator('[role="radio"]');
    const rs = () => radios.evaluateAll((els: Element[]) => els.map(e => ({
      name: ((e as HTMLElement).innerText || '').trim() || e.getAttribute('aria-label'),
      checked: e.getAttribute('aria-checked'), tabindex: e.getAttribute('tabindex'), focused: e === document.activeElement,
    })));
    const initial = await rs();
    const n = initial.length;
    const checkedIdx = initial.findIndex(r => r.checked === 'true');
    const allExplicit = initial.every(r => r.checked === 'true' || r.checked === 'false');
    const exactlyOne = initial.filter(r => r.checked === 'true').length === 1;
    if (checkedIdx < 0) return { pass: false, detail: { reason: 'no radio has aria-checked=true', initial } };
    await radios.nth(checkedIdx).focus();
    const focusedIdx = (s: Awaited<ReturnType<typeof rs>>) => s.findIndex(r => r.focused);
    await page.keyboard.press('ArrowRight');
    const afterRight = await rs();
    const rightIdx = focusedIdx(afterRight);
    await page.keyboard.press('ArrowLeft');
    const afterLeft = await rs();
    const leftIdx = focusedIdx(afterLeft);
    const onlyChecked = (s: typeof afterRight, idx: number) => s.every((r, i) => r.checked === (i === idx ? 'true' : 'false'));
    const pass = n === 3 && allExplicit && exactlyOne
      && rightIdx === (checkedIdx + 1) % n && onlyChecked(afterRight, rightIdx)
      && leftIdx === checkedIdx && onlyChecked(afterLeft, leftIdx);
    return { pass, detail: { radioCount: n, initial, afterRight, afterLeft, expectedRightIdx: (checkedIdx + 1) % n } };
  });

  // K4: rows after the primary button.
  const after: Info[] = [];
  let reviewBefore: string | null = null, reviewAfter: string | null = null, reviewName: string | null = null;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const inf = await focusInfo(page);
    if (!inf) { after.push(null as unknown as Info); continue; }
    after.push(inf);
    if (/^(Your|My) review/i.test(inf.name) && reviewName === null) {
      reviewName = inf.name;
      reviewBefore = inf.ariaExpanded;
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      reviewAfter = await page.evaluate(() => document.activeElement?.getAttribute('aria-expanded') ?? null);
    }
  }
  const allNotes = after.find(s => s && /^All notes/i.test(s.name));
  const communityStop = after.find(s => s && /Community reviews/i.test(s.name));
  const communityDirect = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button,a,[role="button"],[role="link"]')).find(e => /Community reviews/i.test((e as HTMLElement).innerText || '')) as HTMLElement | undefined;
    if (!el) return { present: false };
    return { present: true, tabIndex: el.tabIndex, tag: el.tagName, role: el.getAttribute('role'), ariaDisabled: el.getAttribute('aria-disabled') };
  });
  await check('K4', async () => {
    const pass = !!allNotes && allNotes.role === 'link' && allNotes.ariaExpanded === null
      && reviewName !== null && reviewBefore === 'false' && reviewAfter === 'true'
      && !communityStop && (!(communityDirect as any).present || (communityDirect as any).tabIndex < 0);
    return { pass, detail: { stopsAfterPrimary: after.map(s => (s ? fmt(s) : '(body)')), allNotes: allNotes ? fmt(allNotes) : null, reviewName, reviewBefore, reviewAfter, communityFocusStop: communityStop ? fmt(communityStop) : null, communityDirect } };
  });

  // K5: remove dialog.
  await page.goto(`${BASE}?s=populated&phase=daylight&open=remove`);
  await expect(page.getByTestId('FA_P1_PROTOTYPE_MARKER').first()).toBeAttached({ timeout: 60000 });
  await page.waitForTimeout(1200);
  await check('K5', async () => {
    const dlgInfo = () => page.evaluate(() => {
      const dlg = (document.querySelector('[role="dialog"]') ?? document.querySelector('[data-testid="fa-dialog"]')) as HTMLElement | null;
      if (!dlg) return null;
      const ids = (dlg.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
      const describedText = ids.map(id => document.getElementById(id)?.innerText ?? '').join(' ').replace(/\s+/g, ' ').trim();
      const pg = document.querySelector('[data-testid="fa-page"]') as HTMLElement | null;
      return {
        role: dlg.getAttribute('role'), ariaModal: dlg.getAttribute('aria-modal'),
        describedBy: ids, describedText: describedText.slice(0, 200),
        describedOk: /will be deleted/i.test(describedText),
        pageAriaHidden: pg?.getAttribute('aria-hidden') ?? null, pageInert: pg ? pg.hasAttribute('inert') : null,
        backgroundHidden: !!pg && (pg.getAttribute('aria-hidden') === 'true' || pg.hasAttribute('inert')),
      };
    });
    const atOpen = await focusInfo(page);
    const insideFlags: boolean[] = [];
    const tabs: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const dlg = (document.querySelector('[role="dialog"]') ?? document.querySelector('[data-testid="fa-dialog"]')) as HTMLElement | null;
        return !!dlg && dlg.contains(document.activeElement);
      });
      insideFlags.push(inside);
      tabs.push(fmt(await focusInfo(page)));
    }
    const dlg = await dlgInfo();
    await page.screenshot({ path: path.join(OUT, 'kb-k5-remove-open.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    const closed = await page.evaluate(() => !(document.querySelector('[role="dialog"]') ?? document.querySelector('[data-testid="fa-dialog"]')));
    const focusAfter = await focusInfo(page);
    const pass = !!atOpen && /^Cancel/i.test(atOpen.name)
      && insideFlags.every(Boolean)
      && !!dlg && dlg.describedOk && dlg.backgroundHidden
      && closed && !!focusAfter && /Remove from library/i.test(focusAfter.name);
    return { pass, detail: { focusAtOpen: fmt(atOpen), tabSixTimes: tabs, insideFlags, dialog: dlg, escapeClosesDialog: closed, focusAfterEscape: fmt(focusAfter) } };
  });

  // K6: accessible names of buttons, radios and links (tab bar excluded; reported separately).
  await goto('s=populated&phase=daylight');
  await check('K6', async () => {
    const items = await page.evaluate(`(() => {
      const accName = ${ACC_NAME};
      const sel = '[role="button"],[role="radio"],[role="link"],a[href],button';
      const all = Array.from(document.querySelectorAll(sel));
      const tabBar = all.filter(el => el.closest('[role="tablist"],[role="tab"],nav'));
      const content = all.filter(el => !el.closest('[role="tablist"],[role="tab"],nav')).map(el => ({
        role: el.getAttribute('role') || el.tagName.toLowerCase(), name: accName(el) }));
      return { content, tabBarCount: tabBar.length };
    })()`) as { content: { role: string; name: string }[]; tabBarCount: number };
    const empty = items.content.filter(i => !i.name);
    return { pass: items.content.length > 0 && empty.length === 0, detail: { total: items.content.length, tabBarExcludedCount: items.tabBarCount, emptyNames: empty, items: items.content } };
  });

  // K7: heading structure.
  await check('K7', async () => {
    const headings = await page.evaluate(() => Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')).map(el => {
      const tagLevel = /^H[1-6]$/.test(el.tagName) ? Number(el.tagName.slice(1)) : null;
      const attr = el.getAttribute('aria-level');
      return { tag: el.tagName, role: el.getAttribute('role'), level: attr ? Number(attr) : tagLevel, text: (el as HTMLElement).innerText.trim().slice(0, 80) };
    }));
    const landmarks = await page.evaluate(() => Array.from(document.querySelectorAll('[role="main"],main,[role="navigation"],nav,[role="banner"],header,[role="contentinfo"],[role="region"]')).map(el => el.getAttribute('role') || el.tagName.toLowerCase()));
    const h1 = headings.find(h => h.level === 1);
    const notes = headings.find(h => h.level === 2 && /^Your notes/i.test(h.text));
    const pass = !!h1 && h1.text.includes(EXPECTED_TITLE) && !!notes;
    return { pass, detail: { expectedTitle: EXPECTED_TITLE, h1: h1 ?? null, yourNotesLevel2: notes ?? null, headings, landmarks } };
  });

  // K8: zoom 2 at 390 width (CSS zoom approximation, same method as round 1).
  await check('K8', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goto('s=populated&phase=daylight');
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const vw = window.innerWidth;
      const radios = Array.from(document.querySelectorAll('[role="radio"]')) as HTMLElement[];
      const clippedLabels = radios.filter(r => r.scrollWidth > r.clientWidth + 1 || r.getBoundingClientRect().right > vw + 1)
        .map(r => ({ text: r.innerText.trim(), scrollW: r.scrollWidth, clientW: r.clientWidth, right: Math.round(r.getBoundingClientRect().right) }));
      return { innerWidth: vw, docScrollWidth: document.documentElement.scrollWidth, clippedLabels };
    });
    await page.screenshot({ path: path.join(OUT, 'kb-k8-zoom2-390.png') });
    const pass = m.docScrollWidth <= m.innerWidth && m.clippedLabels.length === 0;
    return { pass, detail: m };
  });
  await page.evaluate(() => { document.documentElement.style.zoom = ''; }).catch(() => {});

  // K9: offline preset.
  await check('K9', async () => {
    await page.goto(`${BASE}?s=offline&phase=daylight`);
    await expect(page.getByTestId('FA_P1_PROTOTYPE_MARKER').first()).toBeAttached({ timeout: 60000 });
    await page.waitForTimeout(1200);
    const radios = await page.locator('[role="radio"]').evaluateAll((els: Element[]) => els.map(e => ({
      name: ((e as HTMLElement).innerText || '').trim(),
      disabled: (e as HTMLButtonElement).disabled === true || e.getAttribute('aria-disabled') === 'true',
    })));
    const addNote = page.getByRole('button', { name: /Add note/i }).first();
    const addNoteCount = await addNote.count();
    const addNoteDisabled = addNoteCount > 0 ? await addNote.evaluate((el: Element) => (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true') : null;
    const bodyText = await page.locator('body').innerText();
    const textPresent = bodyText.includes('Changes need a connection.');
    await page.screenshot({ path: path.join(OUT, 'kb-k9-offline.png') });
    const pass = radios.length === 3 && radios.every(r => r.disabled) && addNoteDisabled === true && textPresent;
    return { pass, detail: { radios, addNoteCount, addNoteDisabled, changesNeedConnectionText: textPresent } };
  });

  fs.writeFileSync(path.join(OUT, 'keyboard-results.json'), JSON.stringify({ verdicts: V, k3Styles: k3, writesBlocked, nonGet }, null, 2));
  console.log('VERDICTS: ' + Object.entries(V).map(([k, v]) => `${k}=${v.verdict}`).join(' '));
});
