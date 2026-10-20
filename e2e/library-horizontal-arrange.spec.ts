import { expect, test, type Locator, type Page } from '@playwright/test';

const TEST_USER_ID = '22222222-2222-4222-8222-222222222222';
const testSession = {
  access_token: 'library-arrange-e2e-access-token',
  refresh_token: 'library-arrange-e2e-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: { id: TEST_USER_ID, email: 'shelf-arrange@booktalks.test', phone: '+911234567890', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
};

const books = [
  { id: 'e1000000-0000-4000-8000-000000000001', title: 'Arrange Fixture Alpha', page_count: 280 },
  { id: 'e1000000-0000-4000-8000-000000000002', title: 'Arrange Fixture Beta', page_count: 340 },
  { id: 'e1000000-0000-4000-8000-000000000003', title: 'Arrange Fixture Gamma', page_count: 210 },
  { id: 'e1000000-0000-4000-8000-000000000004', title: 'Arrange Fixture Delta', page_count: 420 },
].map((book, index) => ({
  id: `e2000000-0000-4000-8000-00000000000${index + 1}`,
  user_id: TEST_USER_ID,
  book_id: book.id,
  reading_status: 'reading',
  ownership: 'owned',
  condition: 'good',
  rating: null,
  review: null,
  available_for_lending: false,
  created_at: new Date(Date.now() - index * 1000).toISOString(),
  updated_at: new Date().toISOString(),
  book: { ...book, authors: [`Fixture Author ${index + 1}`], cover_url: null, publisher: 'Test fixture', published_date: '2025', categories: null },
}));

async function mockLibrarySupabase(page: Page) {
  await page.route('https://ahntbtktjjmvfosgkmgn.supabase.co/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();

    if (pathname === '/auth/v1/otp' && method === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (pathname === '/auth/v1/verify' && method === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(testSession) });
    if (pathname === '/auth/v1/user' && method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(testSession.user) });
    if (pathname === '/auth/v1/token' && method === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(testSession) });
    if (pathname.startsWith('/rest/v1/user_profiles')) {
      const profile = { id: 'e3000000-0000-4000-8000-000000000001', user_id: TEST_USER_ID, display_name: 'Shelf Arrange Fixture', username: 'shelf-arrange-fixture', avatar_url: null, city: 'Bangalore', email: 'shelf-arrange@booktalks.test', referral_code: 'SHELF-E2E', account_type: 'user', is_verified_author: false, membership_tier: 'free', trust_score: 10, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const isObject = route.request().headers()['accept']?.includes('application/vnd.pgrst.object+json');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isObject ? profile : [profile]) });
    }
    if (pathname.startsWith('/rest/v1/user_books')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(books) });
    if (pathname.startsWith('/rest/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

async function loginThroughOtp(page: Page) {
  await page.goto('/login');
  await page.getByTestId('login-phone-input').fill('1234567890');
  await page.getByTestId('login-continue-button').click();
  await expect(page).toHaveURL(/\/verify-otp/);
  await page.getByTestId('verify-otp-input').fill('123456');
  await page.getByTestId('verify-otp-button').click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByTestId('library-view-shelf')).toBeVisible();
}

async function dragBookToTopHalfOf(page: Page, dragged: Locator, destination: Locator) {
  const sourceBox = await dragged.boundingBox();
  const destinationBox = await destination.boundingBox();
  expect(sourceBox, 'dragged book should be rendered').not.toBeNull();
  expect(destinationBox, 'destination book should be rendered').not.toBeNull();
  const source = sourceBox!;
  const target = destinationBox!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 8, source.y + source.height / 2 + 8, { steps: 2 });
  await page.mouse.move(target.x + target.width / 2, target.y + Math.max(4, target.height * 0.25), { steps: 12 });
  await page.mouse.up();
}

test.describe('horizontal shelf arrangement in an isolated browser fixture', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
    });
    await page.route('https://www.googleapis.com/books/v1/volumes**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[],"totalItems":0}' }));
    await mockLibrarySupabase(page);
  });

  test('transfers one book between tiers, undoes it, saves, and restores the tier on reload', async ({ page }) => {
    await loginThroughOtp(page);
    await page.getByTestId('library-view-shelf').click();
    await page.getByTestId('library-shelf-style-horizontal').click();
    await expect(page.getByTestId('library-horizontal-tier-top')).toBeVisible();
    await expect(page.getByTestId('library-horizontal-tier-bottom')).toBeVisible();

    const alpha = 'e2000000-0000-4000-8000-000000000001';
    const beta = 'e2000000-0000-4000-8000-000000000002';
    const gamma = 'e2000000-0000-4000-8000-000000000003';
    const delta = 'e2000000-0000-4000-8000-000000000004';
    const top = page.getByTestId('library-horizontal-tier-top');
    const bottom = page.getByTestId('library-horizontal-tier-bottom');
    await expect(top.getByTestId(`library-horizontal-book-${alpha}`)).toBeVisible();
    await expect(top.getByTestId(`library-horizontal-book-${beta}`)).toBeVisible();
    await expect(bottom.getByTestId(`library-horizontal-book-${gamma}`)).toBeVisible();
    await expect(bottom.getByTestId(`library-horizontal-book-${delta}`)).toBeVisible();

    await page.getByTestId('library-arrange-arrange-shelf').click();
    await top.getByTestId(`library-horizontal-book-${alpha}`).click();
    await expect(page.getByText('Selected: Arrange Fixture Alpha')).toBeVisible();

    await dragBookToTopHalfOf(page, top.getByTestId(`library-horizontal-book-${alpha}`), bottom.getByTestId(`library-horizontal-book-${gamma}`));
    await expect(bottom.getByTestId(`library-horizontal-book-${alpha}`)).toBeVisible();
    await expect(top.getByTestId(`library-horizontal-book-${alpha}`)).toHaveCount(0);
    await expect(top.getByTestId(`library-horizontal-book-${beta}`)).toBeVisible();
    await expect(bottom.getByTestId(`library-horizontal-book-${gamma}`)).toBeVisible();
    await expect(bottom.getByTestId(`library-horizontal-book-${delta}`)).toBeVisible();

    await page.getByTestId('library-arrange-undo').click();
    await expect(top.getByTestId(`library-horizontal-book-${alpha}`)).toBeVisible();
    await expect(bottom.getByTestId(`library-horizontal-book-${alpha}`)).toHaveCount(0);

    await dragBookToTopHalfOf(page, top.getByTestId(`library-horizontal-book-${alpha}`), bottom.getByTestId(`library-horizontal-book-${gamma}`));
    await expect(bottom.getByTestId(`library-horizontal-book-${alpha}`)).toBeVisible();
    await page.getByTestId('library-arrange-save').click();
    await expect(page.getByTestId('library-arrange-message')).toHaveText('Arrangement saved on this device.');

    await page.reload();
    await expect(page.getByTestId('library-view-shelf')).toBeVisible();
    await page.getByTestId('library-view-shelf').click();
    await page.getByTestId('library-shelf-style-horizontal').click();
    await expect(page.getByTestId('library-horizontal-tier-top').getByTestId(`library-horizontal-book-${alpha}`)).toHaveCount(0);
    await expect(page.getByTestId('library-horizontal-tier-bottom').getByTestId(`library-horizontal-book-${alpha}`)).toBeVisible();
    await expect(page.getByTestId('library-horizontal-tier-top').getByTestId(`library-horizontal-book-${beta}`)).toBeVisible();
    await expect(page.getByTestId('library-horizontal-tier-bottom').getByTestId(`library-horizontal-book-${gamma}`)).toBeVisible();
    await expect(page.getByTestId('library-horizontal-tier-bottom').getByTestId(`library-horizontal-book-${delta}`)).toBeVisible();
  });
});
