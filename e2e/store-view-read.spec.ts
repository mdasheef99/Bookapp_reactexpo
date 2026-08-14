import { expect, type Page, test } from '@playwright/test';

const userId = '00000000-0000-4000-8000-000000000010';
const storeId = '00000000-0000-4000-8000-000000000020';
const inventoryId = '00000000-0000-4000-8000-000000000030';

const item = {
  identity: { inventoryId },
  presentation: {
    title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
    publicDescription: 'A browser-smoke description.', condition: 'good',
    publicConditionNote: 'Light shelf wear.', hasDamage: false,
    damageTypes: [], damageNote: null, isSellable: true, sellingPriceMinor: 35000,
  },
  stockSummary: { quantityAvailable: 2, stockState: 'available' },
  lifecycle: { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' },
  attention: { attentionState: 'none', attentionReasons: [] },
  capabilities: ['edit_details', 'adjust_stock', 'manage_photos', 'pause', 'make_private'],
  versions: { inventoryVersion: 3, publicationIntentVersion: 2 },
  mediaSummary: { approvedCount: 1 },
  publicState: null,
};

async function mockSupabase(page: Page) {
  await page.route('https://ahntbtktjjmvfosgkmgn.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/auth/v1/otp') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    if (url.pathname === '/auth/v1/verify') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        access_token: 'store-view-smoke-token', refresh_token: 'store-view-smoke-refresh',
        expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: {
          id: userId, email: 'owner@example.test', phone: '+911234567890',
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {},
        },
      }) });
    }
    if (url.pathname === '/auth/v1/user') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: userId, email: 'owner@example.test', phone: '+911234567890',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {},
      }) });
    }
    if (url.pathname.startsWith('/rest/v1/user_profiles')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'profile-1', user_id: userId, display_name: 'Owner', username: 'owner',
        avatar_url: null, city: 'Bangalore', email: 'owner@example.test',
        referral_code: 'OWNER1', account_type: 'user', is_verified_author: false,
        membership_tier: 'free', trust_score: 10,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }) });
    }
    if (url.pathname.startsWith('/rest/v1/store_administrators')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        store_id: storeId,
        stores: { id: storeId, display_name: 'Smoke Books', status: 'active', setup_status: 'complete', suspension_reason: null, restriction_reason: null },
      }) });
    }
    if (url.pathname.startsWith('/rest/v1/store_verification_requests')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: '00000000-0000-4000-8000-000000000040', status: 'approved',
        rejection_reason: null, required_follow_up: null,
      }) });
    }
    if (url.pathname === '/functions/v1/phase9-owner-ingestion') {
      const body = request.postDataJSON() as { action?: string };
      const data = body.action === 'read_store_view_detail'
        ? {
          ...item,
          privateOperations: { shelfLocation: 'A3', internalNotes: 'Owner only smoke note.' },
          stock: { quantityTotal: 2, quantityAvailable: 2, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
          historySummary: { publicRevisionCount: 1, latestPublicRevision: null },
        }
        : { items: [item], pageInfo: { hasNextPage: false, nextCursor: null } };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        contractVersion: 'phase9-store-view-read-v1', data,
      }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test('opens the controlled Store View list and inventoryId detail route', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/login');
  await page.getByTestId('login-phone-input').fill('1234567890');
  await page.getByTestId('login-continue-button').click();
  await page.getByTestId('verify-otp-input').fill('123456');
  await page.getByTestId('verify-otp-button').click();
  await expect(page).toHaveURL(/\/library$/u);

  await page.goto('/store-view');
  await expect(page.getByText('The Bookshop')).toBeVisible();
  await expect(page.getByTestId('store-view-filter-needs_attention')).toBeVisible();
  await page.getByTestId(`store-view-card-${inventoryId}`).click();
  await expect(page).toHaveURL(new RegExp(`/store-view/${inventoryId}$`, 'u'));
  await expect(page.getByText('Stock and operations · Owner only')).toBeVisible();
  await expect(page.getByText('Owner only smoke note.')).toBeVisible();
});
