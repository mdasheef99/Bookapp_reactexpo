import { expect, type Page, test } from '@playwright/test';

const TEST_USER_ID = 'dev-user-00000000-0000-0000-0000-000000000000';
const TEST_PHONE = '1234567890';

const testSession = {
  access_token: 'dev-access-token',
  refresh_token: 'dev-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: TEST_USER_ID,
    email: 'dev@booktalks.test',
    phone: `+91${TEST_PHONE}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: { name: 'Dev User' },
  },
};

async function mockSupabase(page: Page) {
  await page.route('https://ahntbtktjjmvfosgkmgn.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname, searchParams } = url;
    const method = request.method();

    if (pathname === '/auth/v1/otp' && method === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }

    if (pathname === '/auth/v1/verify' && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testSession),
      });
    }

    if (pathname === '/auth/v1/user' && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testSession.user),
      });
    }

    if (pathname.startsWith('/rest/v1/user_profiles')) {
      const profile = {
        id: 'profile-1',
        user_id: TEST_USER_ID,
        display_name: 'Dev User',
        username: 'dev-user',
        avatar_url: null,
        city: 'Bangalore',
        email: 'dev@booktalks.test',
        referral_code: 'DEV1234',
        account_type: 'user',
        is_verified_author: false,
        membership_tier: 'free',
        trust_score: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const prefersObject = request.headers()['accept']?.includes('application/vnd.pgrst.object+json');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(prefersObject ? profile : [profile]),
      });
    }

    if (pathname.startsWith('/rest/v1/user_books')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    if (pathname.startsWith('/rest/v1/club_public_details')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    if (pathname.startsWith('/rest/v1/club_members')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    if (pathname.startsWith('/rest/v1/listings')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    if (pathname.startsWith('/rest/v1/user_credit_balances')) {
      const balance = {
        user_id: TEST_USER_ID,
        available: 3,
        held: 1,
        lifetime_earned: 5,
        lifetime_spent: 2,
        updated_at: new Date().toISOString(),
      };
      const prefersObject = request.headers()['accept']?.includes('application/vnd.pgrst.object+json');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(prefersObject ? balance : [balance]),
      });
    }

    if (pathname.startsWith('/rest/v1/credit_events')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    if (pathname.startsWith('/storage/v1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

async function loginThroughOtp(page: Page) {
  await page.goto('/login');
  await page.getByTestId('login-phone-input').fill(TEST_PHONE);
  await page.getByTestId('login-continue-button').click();
  await expect(page).toHaveURL(/\/verify-otp/);
  await page.getByTestId('verify-otp-input').fill('123456');
  await page.getByTestId('verify-otp-button').click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByText('My Library')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
  });

  await page.route('https://www.googleapis.com/books/v1/volumes**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
        totalItems: 0,
      }),
    });
  });

  await mockSupabase(page);
});

test.describe('BookTalks web smoke flows', () => {
  test('renders auth entry screens', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('BookTalks')).toBeVisible();
    await expect(page.getByTestId('login-phone-input')).toBeVisible();
    await expect(page.getByTestId('login-continue-button')).toBeVisible();

    await page.goto('/verify-otp?phone=1234567890');
    await expect(page.getByText('Enter OTP')).toBeVisible();
    await expect(page.getByTestId('verify-otp-input')).toBeVisible();
    await expect(page.getByTestId('dev-otp-helper')).toContainText('123456');

    await page.goto('/setup-profile');
    await expect(page.getByText('Welcome!')).toBeVisible();
    await expect(page.getByText(/Display Name/i)).toBeVisible();
    await expect(page.getByText(/^Get Started/).last()).toBeVisible();
  });

  test('logs in and opens the manual add library flow', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);

    await loginThroughOtp(page);
    await page.goto('/library/search');
    await expect(page.getByText('Search Books')).toBeVisible();
    await page.getByLabel('Search books').fill('missing smoke title');
    await page.getByLabel('Search books').press('Enter');
    await expect(page.getByTestId('library-manual-entry-open')).toBeVisible();
    await page.getByTestId('library-manual-entry-open').click();
    await expect(page.getByText('Add book manually')).toBeVisible();
    await page.getByTestId('library-manual-entry-title').fill('Smoke Test Book');
    await page.getByTestId('library-manual-entry-author').fill('Codex');
    await page.getByTestId('library-manual-entry-cancel').click();
    await expect(page.getByText('Add book manually')).toBeHidden();
  });

  test('renders clubs browse filters after login', async ({ page }) => {
    await loginThroughOtp(page);
    await page.goto('/clubs');
    await expect(page.getByText('Book clubs')).toBeVisible();
    await expect(page.getByTestId('clubs-search-input')).toBeVisible();
    await page.getByTestId('clubs-filter-scope-mine').click();
    await expect(page.getByText(/You have not joined any clubs yet/i)).toBeVisible();
    await page.getByTestId('clubs-filter-type-public').click();
    await page.getByTestId('clubs-filter-access-pro').click();
  });

  test('renders exchange and profile entry screens after login', async ({ page }) => {
    await loginThroughOtp(page);

    await page.goto('/exchange');
    await expect(page.getByText('Exchange').first()).toBeVisible();
    await expect(page.getByText(/No listings yet/i)).toBeVisible();

    await page.goto('/exchange/create');
    await expect(page.getByText('List a Book')).toBeVisible();
    await expect(page.getByText(/No books in your library/i)).toBeVisible();

    await page.goto('/profile');
    await expect(page.getByText('My Profile')).toBeVisible();
    await expect(page.getByText('Sign Out')).toBeVisible();
  });
});
