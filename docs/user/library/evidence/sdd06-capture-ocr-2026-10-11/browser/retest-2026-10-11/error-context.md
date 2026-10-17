# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: library-manual-note-browser-history.luna.spec.ts >> corrected B04 state, keyboard activation, and 1280 by 900 viewport
- Location: .tmp\sdd06-capture-browser-qa-luna-20261011\library-manual-note-browser-history.luna.spec.ts:179:5

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByRole('radio', { name: 'Thought', exact: true })
Expected: "true"
Received: "false"
Timeout:  10000ms

Call log:
  - Expect "toHaveAttribute" with timeout 10000ms
  - waiting for getByRole('radio', { name: 'Thought', exact: true })
    13 × locator resolved to <div role="radio" tabindex="0" aria-checked="false" aria-label="Thought" class="css-g5y9jx r-1loqt21 r-1otgn73 r-1fuqb1j r-rs99b7 r-1777fci r-1pl7oy7 r-1mmae3n r-gu64tb">…</div>
       - unexpected value "false"

```

# Page snapshot

```yaml
- generic [ref=e9]:
  - generic [ref=e18]:
    - generic [ref=e19]:
      - button "Back" [ref=e20] [cursor=pointer]:
        - generic [ref=e21]: ‹ Back
      - heading "Add note" [level=1] [ref=e22]
      - generic [ref=e23]: Browser history fixture book
    - generic [ref=e26]:
      - generic [ref=e27]: Category (optional)
      - generic "Category, optional" [ref=e28]:
        - radio "Quote" [checked] [ref=e29] [cursor=pointer]:
          - generic [ref=e30]: ✓ Quote
        - radio "Thought" [active] [ref=e31] [cursor=pointer]:
          - generic [ref=e32]: Thought
        - radio "Takeaway" [ref=e33] [cursor=pointer]:
          - generic [ref=e34]: Takeaway
        - radio "Action" [ref=e35] [cursor=pointer]:
          - generic [ref=e36]: Action
        - radio "Question" [ref=e37] [cursor=pointer]:
          - generic [ref=e38]: Question
      - button "Skip category" [ref=e39] [cursor=pointer]:
        - generic [ref=e40]: Skip category
      - button "Write note" [ref=e41] [cursor=pointer]:
        - generic [ref=e42]: Write note
      - button "Scan text" [ref=e43] [cursor=pointer]:
        - generic [ref=e44]: Scan text
  - tablist [ref=e46]:
    - tab "⏷ ⏷ My Library" [selected] [ref=e48] [cursor=pointer]:
      - generic [ref=e49]:
        - generic [ref=e51]: ⏷
        - generic [ref=e53]: ⏷
      - generic [ref=e54]: My Library
    - tab "⏷ ⏷ Exchange" [ref=e56] [cursor=pointer]:
      - generic [ref=e57]:
        - generic [ref=e59]: ⏷
        - generic [ref=e61]: ⏷
      - generic [ref=e62]: Exchange
    - tab "⏷ ⏷ Marketplace" [ref=e64] [cursor=pointer]:
      - generic [ref=e65]:
        - generic [ref=e67]: ⏷
        - generic [ref=e69]: ⏷
      - generic [ref=e70]: Marketplace
    - tab "⏷ ⏷ Clubs" [ref=e72] [cursor=pointer]:
      - generic [ref=e73]:
        - generic [ref=e75]: ⏷
        - generic [ref=e77]: ⏷
      - generic [ref=e78]: Clubs
    - tab "⏷ ⏷ Profile" [ref=e80] [cursor=pointer]:
      - generic [ref=e81]:
        - generic [ref=e83]: ⏷
        - generic [ref=e85]: ⏷
      - generic [ref=e86]: Profile
    - tab "⏷ ⏷ marketplace/cart" [ref=e88] [cursor=pointer]:
      - generic [ref=e89]:
        - generic [ref=e91]: ⏷
        - generic [ref=e93]: ⏷
      - generic [ref=e94]: marketplace/cart
    - tab "⏷ ⏷ marketplace/requests/index" [ref=e96] [cursor=pointer]:
      - generic [ref=e97]:
        - generic [ref=e99]: ⏷
        - generic [ref=e101]: ⏷
      - generic [ref=e102]: marketplace/requests/index
    - tab "⏷ ⏷ marketplace/book/[listingId]" [ref=e104] [cursor=pointer]:
      - generic [ref=e105]:
        - generic [ref=e107]: ⏷
        - generic [ref=e109]: ⏷
      - generic [ref=e110]: marketplace/book/[listingId]
    - tab "⏷ ⏷ marketplace/requests/[requestId]" [ref=e112] [cursor=pointer]:
      - generic [ref=e113]:
        - generic [ref=e115]: ⏷
        - generic [ref=e117]: ⏷
      - generic [ref=e118]: marketplace/requests/[requestId]
```

# Test source

```ts
  92  | 
  93  | test('dirty create: discard exits once and Forward reinitializes without reviving the draft', async ({ page }) => {
  94  |   const notesUrl = page.url(); await newDraft(page);
  95  |   await back(page); await page.getByRole('button', { name: 'Discard note', exact: true }).click();
  96  |   await expect(page).toHaveURL(notesUrl); await expect(page.getByText('1 saved note', { exact: true })).toBeVisible();
  97  |   await forward(page); await expect(page.getByRole('button', { name: 'Write note', exact: true })).toBeVisible();
  98  |   await page.getByRole('button', { name: 'Write note', exact: true }).click();
  99  |   await expect(page.getByRole('textbox', { name: 'Note text', exact: true })).toHaveValue('');
  100 |   await expect(page.getByRole('textbox', { name: 'Page, optional', exact: true })).toHaveValue('');
  101 |   await back(page); await expect(page).toHaveURL(notesUrl);
  102 | });
  103 | 
  104 | test('edit: Keep editing retains identity and changes; discard returns to the original saved reader', async ({ page }) => {
  105 |   await page.getByRole('button', { name: 'Read note, Thought, page 12', exact: true }).click();
  106 |   await expect(page.getByText(savedBody, { exact: true }).filter({ visible: true })).toBeVisible(); const readerUrl = page.url();
  107 |   await page.getByRole('button', { name: 'Edit note', exact: true }).click(); const editorUrl = page.url();
  108 |   await page.getByRole('textbox', { name: 'Note text', exact: true }).fill('Changed locally');
  109 |   await page.getByRole('textbox', { name: 'Page, optional', exact: true }).fill('42');
  110 |   await page.getByRole('button', { name: 'Change category', exact: true }).click();
  111 |   await page.getByRole('radio', { name: 'Question', exact: true }).click();
  112 |   await back(page); await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  113 |   await expect(page).toHaveURL(editorUrl); await fields(page, 'Changed locally', 'Question', '42');
  114 |   await expect(page.getByRole('heading', { name: 'Edit note', exact: true })).toBeVisible();
  115 |   await back(page); await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  116 |   await expect(page).toHaveURL(readerUrl); await expect(page.getByText(savedBody, { exact: true }).filter({ visible: true })).toBeVisible();
  117 |   await forward(page); await fields(page, savedBody, 'Thought', '12');
  118 | });
  119 | 
  120 | test('repeated Back has one prompt, Keep remains editable, and later discard/Forward remain coherent', async ({ page }) => {
  121 |   const notesUrl = page.url(); await newDraft(page); const composerUrl = page.url();
  122 |   await back(page); await expect(page.getByRole('button', { name: 'Keep editing', exact: true })).toBeVisible();
  123 |   await back(page); await expect(page.getByRole('heading', { name: 'Discard this note?', exact: true })).toHaveCount(1);
  124 |   await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  125 |   await expect(page).toHaveURL(composerUrl); await fields(page, 'Synthetic unsaved body');
  126 |   await back(page); await page.getByRole('button', { name: 'Discard note', exact: true }).click();
  127 |   await expect(page).toHaveURL(notesUrl); await forward(page);
  128 |   await expect(page.getByRole('button', { name: 'Write note', exact: true })).toBeVisible();
  129 | });
  130 | 
  131 | test('app controls preserve fields across options/category and retain the existing Cancel protection', async ({ page }) => {
  132 |   const notesUrl = page.url(); await newDraft(page);
  133 |   await page.getByRole('button', { name: 'Back to options', exact: true }).click();
  134 |   await page.getByRole('radio', { name: 'Action', exact: true }).click();
  135 |   await page.getByRole('button', { name: 'Write note', exact: true }).click(); await fields(page, 'Synthetic unsaved body', 'Action');
  136 |   await page.getByRole('button', { name: 'Change category', exact: true }).click();
  137 |   await page.getByRole('radio', { name: 'Question', exact: true }).click(); await fields(page, 'Synthetic unsaved body', 'Question');
  138 |   await page.getByRole('button', { name: 'Cancel note', exact: true }).click();
  139 |   await page.getByRole('button', { name: 'Keep editing', exact: true }).click(); await fields(page, 'Synthetic unsaved body', 'Question');
  140 |   await page.getByRole('button', { name: 'Cancel note', exact: true }).click();
  141 |   await page.getByRole('button', { name: 'Discard note', exact: true }).click(); await expect(page).toHaveURL(notesUrl);
  142 | });
  143 | 
  144 | test('blank and category-only browser exits need no discard prompt', async ({ page }) => {
  145 |   const notesUrl = page.url();
  146 |   await page.getByRole('button', { name: 'Add note', exact: true }).click();
  147 |   await page.getByRole('radio', { name: 'Thought', exact: true }).click();
  148 |   await back(page); await expect(page).toHaveURL(notesUrl);
  149 |   await page.getByRole('button', { name: 'Add note', exact: true }).click();
  150 |   await page.getByRole('button', { name: 'Write note', exact: true }).click();
  151 |   await back(page); await expect(page).toHaveURL(notesUrl);
  152 |   await expect(page.getByRole('button', { name: 'Keep editing', exact: true })).toHaveCount(0);
  153 | });
  154 | 
  155 | test('enlarged CSS zoom: composer and discard actions remain reachable with keyboard focus', async ({ page }) => {
  156 |   await page.setViewportSize({ width: 511, height: 668 });
  157 |   // Test-document presentation only; no production setting or draft storage.
  158 |   await page.evaluate(() => { document.documentElement.style.zoom = '1.5'; });
  159 |   await newDraft(page);
  160 |   const text = page.getByRole('textbox', { name: 'Note text', exact: true });
  161 |   await text.scrollIntoViewIfNeeded();
  162 |   await expect(text).toBeVisible();
  163 |   await back(page);
  164 |   const dialogHeading = page.getByRole('heading', { name: 'Discard this note?', exact: true });
  165 |   await dialogHeading.scrollIntoViewIfNeeded(); await expect(dialogHeading).toBeInViewport();
  166 |   const keep = page.getByRole('button', { name: 'Keep editing', exact: true });
  167 |   const discard = page.getByRole('button', { name: 'Discard note', exact: true });
  168 |   await expect(keep).toBeInViewport(); await expect(discard).toBeInViewport();
  169 |   await page.screenshot({ path: '.tmp/sdd06-capture-browser-qa-luna-20261011/browser-history-zoom-dialog.png' });
  170 |   await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  171 |   await keep.scrollIntoViewIfNeeded(); await expect(keep).toBeInViewport();
  172 |   await keep.press('Tab'); await expect(discard).toBeFocused();
  173 |   await discard.scrollIntoViewIfNeeded(); await expect(discard).toBeInViewport();
  174 |   await discard.press('Shift+Tab'); await expect(keep).toBeFocused();
  175 |   await keep.press('Enter'); await expect(text).toBeFocused();
  176 |   await fields(page, 'Synthetic unsaved body');
  177 | });
  178 | 
  179 | test('corrected B04 state, keyboard activation, and 1280 by 900 viewport', async ({ page }) => {
  180 |   await page.setViewportSize({ width: 1280, height: 900 });
  181 |   await page.getByRole('button', { name: 'Add note', exact: true }).click();
  182 |   const quote = page.getByRole('radio', { name: 'Quote', exact: true });
  183 |   const thought = page.getByRole('radio', { name: 'Thought', exact: true });
  184 |   const categories = ['Quote', 'Thought', 'Takeaway', 'Action', 'Question'];
  185 |   for (const category of categories) await expect(page.getByRole('radio', { name: category, exact: true })).toHaveAttribute('aria-checked', 'false');
  186 |   await quote.click();
  187 |   await expect(quote).toHaveAttribute('aria-checked', 'true');
  188 |   await expect(thought).toHaveAttribute('aria-checked', 'false');
  189 |   await quote.focus();
  190 |   await thought.focus();
  191 |   await thought.press('Space');
> 192 |   await expect(thought).toHaveAttribute('aria-checked', 'true');
      |                         ^ Error: expect(locator).toHaveAttribute(expected) failed
  193 |   await expect(quote).toHaveAttribute('aria-checked', 'false');
  194 |   await expect(thought).toBeFocused();
  195 |   expect(await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))).toEqual({ width: 1280, height: 900 });
  196 |   for (const category of ['Takeaway', 'Action', 'Question']) {
  197 |     await page.getByRole('radio', { name: category, exact: true }).click();
  198 |     await expect(page.getByRole('radio', { name: category, exact: true })).toHaveAttribute('aria-checked', 'true');
  199 |     for (const other of categories.filter(name => name !== category)) await expect(page.getByRole('radio', { name: other, exact: true })).toHaveAttribute('aria-checked', 'false');
  200 |   }
  201 |   await page.getByRole('button', { name: 'Skip category', exact: true }).click();
  202 |   for (const category of categories) await expect(page.getByRole('radio', { name: category, exact: true })).toHaveAttribute('aria-checked', 'false');
  203 |   const box = await page.getByRole('button', { name: 'Back', exact: true }).boundingBox();
  204 |   expect(box && box.width).toBeGreaterThanOrEqual(48);
  205 |   expect(box && box.height).toBeGreaterThanOrEqual(48);
  206 |   await page.setViewportSize({ width: 390, height: 844 });
  207 |   await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeInViewport();
  208 |   const narrowBox = await page.getByRole('button', { name: 'Back', exact: true }).boundingBox();
  209 |   expect(narrowBox && narrowBox.width).toBeGreaterThanOrEqual(48);
  210 |   expect(narrowBox && narrowBox.height).toBeGreaterThanOrEqual(48);
  211 | });
  212 | 
  213 | test('dark phase and reduced-motion media preference in isolated browser context', async ({ page }) => {
  214 |   await page.setViewportSize({ width: 1280, height: 900 });
  215 |   await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  216 |   await page.clock.install({ time: new Date('2026-10-11T21:00:00+05:30') });
  217 |   await page.reload();
  218 |   await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible();
  219 |   const media = await page.evaluate(() => ({
  220 |     width: innerWidth, height: innerHeight,
  221 |     darkPreference: matchMedia('(prefers-color-scheme: dark)').matches,
  222 |     reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  223 |     zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  224 |   }));
  225 |   expect(media).toMatchObject({ width: 1280, height: 900, darkPreference: true, reducedMotion: true });
  226 |   await page.getByRole('button', { name: 'Add note', exact: true }).click();
  227 |   const darkBacks = await page.locator('*').evaluateAll(elements => elements
  228 |     .map(element => getComputedStyle(element).backgroundColor)
  229 |     .filter(color => color === 'rgb(19, 34, 28)').length);
  230 |   expect(darkBacks).toBeGreaterThan(0);
  231 |   await page.getByRole('radio', { name: 'Thought', exact: true }).click();
  232 |   await page.getByRole('button', { name: 'Write note', exact: true }).click();
  233 |   await page.getByRole('textbox', { name: 'Note text', exact: true }).fill('Synthetic dark and reduced-motion focus probe');
  234 |   await page.goBack({ waitUntil: 'commit' });
  235 |   await expect(page.getByRole('heading', { name: 'Discard this note?', exact: true })).toBeVisible();
  236 |   await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  237 |   await expect(page.getByRole('textbox', { name: 'Note text', exact: true })).toBeFocused();
  238 | });
  239 | 
```