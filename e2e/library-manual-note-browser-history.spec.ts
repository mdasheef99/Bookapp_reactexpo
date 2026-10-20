import { expect, test, type Page } from '@playwright/test';

// Transport fixtures only: every external request is intercepted. No real notes
// are created, edited or deleted, and no production auth/storage bypass is added.
const actorId = '11111111-1111-4111-8111-111111111111';
const bookId = '375d1a2e-e9da-485b-89ac-b23c40791535';
const noteId = 'ffe33fb0-0ab9-4d35-a322-9662320ecb45';
const savedBody = 'Persisted fixture body stays unchanged';
const session = {
  access_token: 'fixture-access-token', refresh_token: 'fixture-refresh-token',
  expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
  user: { id: actorId, email: 'fixture@booktalks.test', phone: '+911234567890', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
};
const book = { id: 'b600783f-be22-4814-bd60-b4109b697af2', title: 'Browser history fixture book', authors: ['Fixture Author'], cover_url: null, page_count: 300 };
const userBook = { id: bookId, user_id: actorId, book_id: book.id, reading_status: 'reading', ownership: 'owned', condition: 'good', rating: null, review: null, review_is_public: false, available_for_lending: false, book };
const savedNote = { id: noteId, user_id: actorId, user_book_id: bookId, content: savedBody, tag: 'reflect', page_number: 12, version: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
let writes: string[];

test.beforeEach(async ({ page }) => {
  writes = [];
  await page.route('https://**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.hostname !== 'ahntbtktjjmvfosgkmgn.supabase.co') return route.abort();
    const reply = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/auth/v1/otp') return reply({});
    if (url.pathname === '/auth/v1/verify' || url.pathname === '/auth/v1/token') return reply(session);
    if (url.pathname === '/auth/v1/user') return reply(session.user);
    if (request.method() !== 'GET') { writes.push(`${request.method()} ${url.pathname}`); return route.abort(); }
    const single = request.headers().accept?.includes('application/vnd.pgrst.object+json');
    if (url.pathname === '/rest/v1/user_profiles') {
      const profile = { id: 'profile-fixture', user_id: actorId, display_name: 'Fixture', username: 'fixture', account_type: 'user', membership_tier: 'free', trust_score: 10 };
      return reply(single ? profile : [profile]);
    }
    if (url.pathname === '/rest/v1/user_books') return reply(single ? userBook : [userBook]);
    if (url.pathname === '/rest/v1/books') return reply(single ? book : [book]);
    if (url.pathname === '/rest/v1/reading_notes') return reply(single ? savedNote : [savedNote]);
    return reply([]);
  });
  await page.goto('/login');
  await page.getByTestId('login-phone-input').fill('1234567890');
  await page.getByTestId('login-continue-button').click();
  await page.getByTestId('verify-otp-input').fill('123456');
  await page.getByTestId('verify-otp-button').click();
  await expect(page).toHaveURL(/\/library$/);
  await page.goto(`/library/notes?userBookId=${bookId}`);
  await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible();
  await expect(page.getByText('1 saved note', { exact: true })).toBeVisible();
});
test.afterEach(() => expect(writes).toEqual([]));

async function newDraft(page: Page, body = 'Synthetic unsaved body') {
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.getByRole('radio', { name: 'Thought', exact: true }).click();
  await page.getByRole('button', { name: 'Write note', exact: true }).click();
  await page.getByRole('textbox', { name: 'Note text', exact: true }).fill(body);
  await page.getByRole('textbox', { name: 'Page, optional', exact: true }).fill('8');
}
async function fields(page: Page, body: string, category = 'Thought', pageNumber = '8') {
  await expect(page.getByRole('textbox', { name: 'Note text', exact: true })).toHaveValue(body);
  await expect(page.getByRole('textbox', { name: 'Page, optional', exact: true })).toHaveValue(pageNumber);
  await expect(page.getByText(`Category: ${category}`, { exact: true })).toBeVisible();
}
async function back(page: Page) { await page.goBack({ waitUntil: 'commit' }); }
async function forward(page: Page) { await page.goForward({ waitUntil: 'commit' }); }

test('dirty create: genuine Back and Keep editing retain the same editor and fields', async ({ page }) => {
  await newDraft(page); const composerUrl = page.url();
  await fields(page, 'Synthetic unsaved body');
  await back(page);
  await expect(page.getByRole('heading', { name: 'Discard this note?', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page).toHaveURL(composerUrl); await fields(page, 'Synthetic unsaved body');
  await expect(page.getByRole('textbox', { name: 'Note text', exact: true })).toBeFocused();
});

test('dirty create: discard exits once and Forward reinitializes without reviving the draft', async ({ page }) => {
  const notesUrl = page.url(); await newDraft(page);
  await back(page); await page.getByRole('button', { name: 'Discard note', exact: true }).click();
  await expect(page).toHaveURL(notesUrl); await expect(page.getByText('1 saved note', { exact: true })).toBeVisible();
  await forward(page); await expect(page.getByRole('button', { name: 'Write note', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Write note', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Note text', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Page, optional', exact: true })).toHaveValue('');
  await back(page); await expect(page).toHaveURL(notesUrl);
});

test('edit: Keep editing retains identity and changes; discard returns to the original saved reader', async ({ page }) => {
  await page.getByRole('button', { name: 'Read note, Thought, page 12', exact: true }).click();
  await expect(page.getByText(savedBody, { exact: true }).filter({ visible: true })).toBeVisible(); const readerUrl = page.url();
  await page.getByRole('button', { name: 'Edit note', exact: true }).click(); const editorUrl = page.url();
  await page.getByRole('textbox', { name: 'Note text', exact: true }).fill('Changed locally');
  await page.getByRole('textbox', { name: 'Page, optional', exact: true }).fill('42');
  await page.getByRole('button', { name: 'Change category', exact: true }).click();
  await page.getByRole('radio', { name: 'Question', exact: true }).click();
  await back(page); await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page).toHaveURL(editorUrl); await fields(page, 'Changed locally', 'Question', '42');
  await expect(page.getByRole('heading', { name: 'Edit note', exact: true })).toBeVisible();
  await back(page); await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page).toHaveURL(readerUrl); await expect(page.getByText(savedBody, { exact: true }).filter({ visible: true })).toBeVisible();
  await forward(page); await fields(page, savedBody, 'Thought', '12');
});

test('repeated Back has one prompt, Keep remains editable, and later discard/Forward remain coherent', async ({ page }) => {
  const notesUrl = page.url(); await newDraft(page); const composerUrl = page.url();
  await back(page); await expect(page.getByRole('button', { name: 'Keep editing', exact: true })).toBeVisible();
  await back(page); await expect(page.getByRole('heading', { name: 'Discard this note?', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page).toHaveURL(composerUrl); await fields(page, 'Synthetic unsaved body');
  await back(page); await page.getByRole('button', { name: 'Discard note', exact: true }).click();
  await expect(page).toHaveURL(notesUrl); await forward(page);
  await expect(page.getByRole('button', { name: 'Write note', exact: true })).toBeVisible();
});

test('app controls preserve fields across options/category and retain the existing Cancel protection', async ({ page }) => {
  const notesUrl = page.url(); await newDraft(page);
  await page.getByRole('button', { name: 'Back to options', exact: true }).click();
  await page.getByRole('radio', { name: 'Action', exact: true }).click();
  await page.getByRole('button', { name: 'Write note', exact: true }).click(); await fields(page, 'Synthetic unsaved body', 'Action');
  await page.getByRole('button', { name: 'Change category', exact: true }).click();
  await page.getByRole('radio', { name: 'Question', exact: true }).click(); await fields(page, 'Synthetic unsaved body', 'Question');
  await page.getByRole('button', { name: 'Cancel note', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click(); await fields(page, 'Synthetic unsaved body', 'Question');
  await page.getByRole('button', { name: 'Cancel note', exact: true }).click();
  await page.getByRole('button', { name: 'Discard note', exact: true }).click(); await expect(page).toHaveURL(notesUrl);
});

test('blank and category-only browser exits need no discard prompt', async ({ page }) => {
  const notesUrl = page.url();
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.getByRole('radio', { name: 'Thought', exact: true }).click();
  await back(page); await expect(page).toHaveURL(notesUrl);
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.getByRole('button', { name: 'Write note', exact: true }).click();
  await back(page); await expect(page).toHaveURL(notesUrl);
  await expect(page.getByRole('button', { name: 'Keep editing', exact: true })).toHaveCount(0);
});

test('enlarged CSS zoom: composer and discard actions remain reachable with keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 511, height: 668 });
  // Test-document presentation only; no production setting or draft storage.
  await page.evaluate(() => { document.documentElement.style.zoom = '1.5'; });
  await newDraft(page);
  const text = page.getByRole('textbox', { name: 'Note text', exact: true });
  await text.scrollIntoViewIfNeeded();
  await expect(text).toBeVisible();
  await back(page);
  const dialogHeading = page.getByRole('heading', { name: 'Discard this note?', exact: true });
  await dialogHeading.scrollIntoViewIfNeeded(); await expect(dialogHeading).toBeInViewport();
  const keep = page.getByRole('button', { name: 'Keep editing', exact: true });
  const discard = page.getByRole('button', { name: 'Discard note', exact: true });
  await expect(keep).toBeInViewport(); await expect(discard).toBeInViewport();
  await page.screenshot({ path: 'docs/user/library/evidence/sdd06-manual-local-2026-10-10/browser-history-zoom-dialog.png' });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await keep.scrollIntoViewIfNeeded(); await expect(keep).toBeInViewport();
  await keep.press('Tab'); await expect(discard).toBeFocused();
  await discard.scrollIntoViewIfNeeded(); await expect(discard).toBeInViewport();
  await discard.press('Shift+Tab'); await expect(keep).toBeFocused();
  await keep.press('Enter'); await expect(text).toBeFocused();
  await fields(page, 'Synthetic unsaved body');
});
