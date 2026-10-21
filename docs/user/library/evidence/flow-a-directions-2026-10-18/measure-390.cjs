// Read-only: renders each Stitch HTML export at 390x844 and reports
// focusable controls above the fold, text sizes, target sizes, and saves
// fold + full-page phone captures next to the export.
const path = require('path');
const { chromium } = require(path.join('C:/Users/LEGION/Desktop/Bookconnect4_library/node_modules/playwright'));

(async () => {
  const dir = process.argv[2];
  const files = process.argv.slice(3);
  const browser = await chromium.launch({ channel: 'msedge' });
  const results = {};
  for (const f of files) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await page.goto('file:///' + path.join(dir, f + '.html').replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const visible = (el) => {
        const s = getComputedStyle(el); const b = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0;
      };
      const sel = 'button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [role="radio"], [role="tab"], [tabindex]:not([tabindex="-1"])';
      const seenGroups = new Set();
      const controls = [];
      for (const el of document.querySelectorAll(sel)) {
        if (!visible(el)) continue;
        if (el.parentElement && el.parentElement.closest(sel) && el.parentElement.closest(sel) !== el) continue; // nested
        const group = el.closest('[role="radiogroup"], [role="tablist"]');
        if (group) { if (seenGroups.has(group)) continue; seenGroups.add(group); }
        const b = (group || el).getBoundingClientRect();
        const name = (el.getAttribute('aria-label') || (group && group.getAttribute('aria-label')) || el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 50);
        controls.push({ name: group ? 'GROUP: ' + name : name, top: Math.round(b.top + scrollY), h: Math.round(el.getBoundingClientRect().height), w: Math.round(el.getBoundingClientRect().width) });
      }
      const sizes = {}; const small = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = n.textContent.trim();
        if (!t || !n.parentElement || !visible(n.parentElement)) continue;
        const s = getComputedStyle(n.parentElement);
        const px = parseFloat(s.fontSize);
        sizes[px] = (sizes[px] || 0) + 1;
        if (px < 16 && /[A-Za-z0-9]/.test(t)) small.push(px + 'px ' + t.slice(0, 40) + (s.textTransform === 'uppercase' ? ' [UPPER]' : ''));
      }
      const bodyText = document.body.innerText;
      return { controls, sizes, small, docH: document.documentElement.scrollHeight,
        banned: (bodyText.match(/★|rating|reviews \(|lend|borrow|badge/gi) || []) };
    });
    r.aboveFold = r.controls.filter((c) => c.top < 844);
    r.smallTargets = r.controls.filter((c) => c.h < 48 && c.top < 9999);
    await page.screenshot({ path: path.join(dir, f + '-390-fold.png') });
    await page.screenshot({ path: path.join(dir, f + '-390-full.png'), fullPage: true });
    results[f] = r;
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
})();
