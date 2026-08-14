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
  stockSummary: { quantityAvailable: 1, stockState: 'low_stock' },
  lifecycle: { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' },
  attention: { attentionState: 'none', attentionReasons: [] },
  capabilities: ['edit_details', 'adjust_stock', 'manage_photos', 'pause', 'make_private'],
  versions: { inventoryVersion: 3, publicationIntentVersion: 2 },
  mediaSummary: { approvedCount: 1 },
  publicState: null,
};

async function mockSupabase(page: Page) {
  let publishCount = 0;
  let current: any = {
    ...structuredClone(item),
    privateOperations: { shelfLocation: 'A3', internalNotes: 'Owner only smoke note.' },
    stock: { quantityTotal: 1, quantityAvailable: 1, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
    historySummary: { publicRevisionCount: 1, latestPublicRevision: null },
  };
  const capabilities = (state: string) => state === 'private'
    ? ['edit_details', 'adjust_stock', 'publish']
    : state === 'paused'
      ? ['edit_details', 'adjust_stock', 'republish', 'make_private']
      : state === 'publication_failed'
        ? ['edit_details', 'adjust_stock', 'retry_publication', 'make_private']
        : ['edit_details', 'adjust_stock', 'pause', 'make_private'];
  const publicationResult = (outcome: string) => ({
    inventoryId, inventoryVersion: current.versions.inventoryVersion,
    publicationIntentVersion: current.versions.publicationIntentVersion,
    publicationStatus: current.lifecycle.publicationState,
    visibilityStatus: current.lifecycle.visibilityStatus,
    publicationRetryable: current.lifecycle.effectiveState === 'publication_failed',
    publicationFailureReason: current.lifecycle.effectiveState === 'publication_failed'
      ? 'projection_temporarily_unavailable' : null,
    outcome, listingId: current.publicState?.listingId ?? null,
  });
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
      const body = request.postDataJSON() as { action?: string; changes?: Record<string, unknown>; delta?: number; intent?: string };
      if (body.action === 'update_store_inventory_details') {
        current.presentation = { ...current.presentation, ...body.changes };
        if (body.changes?.shelfLocation !== undefined || body.changes?.internalNotes !== undefined) {
          current.privateOperations = {
            ...current.privateOperations,
            ...(body.changes?.shelfLocation !== undefined ? { shelfLocation: body.changes.shelfLocation } : {}),
            ...(body.changes?.internalNotes !== undefined ? { internalNotes: body.changes.internalNotes } : {}),
          };
        }
        current.versions.inventoryVersion += 1;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          contractVersion: 'phase9-store-view-management-v1',
          data: { inventoryId, inventoryVersion: current.versions.inventoryVersion, publicationIntentVersion: current.versions.publicationIntentVersion, publicRevisionNumber: 2, outcome: 'details_updated' },
        }) });
      }
      if (body.action === 'adjust_inventory_stock') {
        const delta = body.delta ?? 0;
        current.stock.quantityAvailable += delta;
        current.stock.quantityTotal += delta;
        current.stockSummary.quantityAvailable = current.stock.quantityAvailable;
        current.stockSummary.stockState = current.stock.quantityAvailable === 0 ? 'out_of_stock' : current.stock.quantityAvailable === 1 ? 'low_stock' : 'available';
        current.versions.inventoryVersion += 1;
        if (current.stock.quantityAvailable === 0) {
          current.lifecycle = { publicationState: 'published', effectiveState: 'out_of_stock', visibilityStatus: 'out_of_stock' };
        } else if (current.lifecycle.effectiveState === 'out_of_stock') {
          current.lifecycle = { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' };
        }
        current.capabilities = capabilities(current.lifecycle.effectiveState);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          contractVersion: 'phase9-store-view-management-v1',
          data: { inventoryId, inventoryVersion: current.versions.inventoryVersion, publicationIntentVersion: current.versions.publicationIntentVersion, publicRevisionNumber: 3, stockState: current.stockSummary.stockState, outcome: 'stock_adjusted' },
        }) });
      }
      if (body.action === 'set_publication_state') {
        current.versions.inventoryVersion += 1;
        current.versions.publicationIntentVersion += 1;
        if (body.intent === 'pause') {
          current.lifecycle = { publicationState: 'published', effectiveState: 'paused', visibilityStatus: 'paused' };
        } else if (body.intent === 'private') {
          current.lifecycle = { publicationState: 'private', effectiveState: 'private', visibilityStatus: 'draft' };
        } else {
          publishCount += 1;
          current.lifecycle = publishCount === 3
            ? { publicationState: 'publication_failed', effectiveState: 'publication_failed', visibilityStatus: 'draft' }
            : { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' };
        }
        current.attention = current.lifecycle.effectiveState === 'publication_failed'
          ? { attentionState: 'action_required', attentionReasons: ['publication_failed'] }
          : { attentionState: 'none', attentionReasons: [] };
        current.capabilities = capabilities(current.lifecycle.effectiveState);
        const outcome = current.lifecycle.effectiveState === 'publication_failed'
          ? 'committed_publication_failed'
          : body.intent === 'pause' ? 'paused' : body.intent === 'private' ? 'private' : 'published';
        return route.fulfill({ status: outcome === 'committed_publication_failed' ? 202 : 200, contentType: 'application/json', body: JSON.stringify({
          contractVersion: 'phase9-publication-v1', data: publicationResult(outcome),
        }) });
      }
      if (body.action === 'retry_publication') {
        current.versions.inventoryVersion += 1;
        current.lifecycle = { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' };
        current.attention = { attentionState: 'none', attentionReasons: [] };
        current.capabilities = capabilities('live');
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          contractVersion: 'phase9-publication-v1', data: publicationResult('published'),
        }) });
      }
      const { privateOperations: _privateOperations, stock: _stock, historySummary: _historySummary, ...pageItem } = current;
      const data = body.action === 'read_store_view_detail'
        ? current
        : { items: [pageItem], pageInfo: { hasNextPage: false, nextCursor: null } };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        contractVersion: 'phase9-store-view-read-v1', data,
      }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test('runs intercepted Store View read, Save, stock, lifecycle, and retry flows', async ({ page }) => {
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

  await page.getByTestId('store-view-edit').click();
  await page.getByTestId('store-view-edit-price-minor').fill('42500');
  await page.getByTestId('store-view-save-changes').click();
  await expect(page.getByText('₹425.00')).toBeVisible();

  await page.getByTestId('store-view-adjust-stock').click();
  await page.getByTestId('store-view-stock-delta').fill('-1');
  await page.getByTestId('store-view-apply-stock').click();
  await expect(page.getByTestId('store-view-detail-state')).toHaveText('Out of Stock');
  await expect(page.getByTestId('store-view-detail-attention')).toHaveText('None');
  await page.getByTestId('store-view-adjust-stock').click();
  await page.getByTestId('store-view-stock-delta').fill('1');
  await page.getByTestId('store-view-apply-stock').click();
  await expect(page.getByTestId('store-view-detail-state')).toHaveText('Live');

  await page.getByTestId('store-view-pause').click();
  await expect(page.getByTestId('store-view-detail-state')).toHaveText('Paused');
  await page.getByTestId('store-view-republish').click();
  await expect(page.getByTestId('store-view-detail-state')).toHaveText('Live');
  await page.getByTestId('store-view-make-private').click();
  await expect(page.getByTestId('store-view-detail-state')).toHaveText('Private');
  await page.getByTestId('store-view-publish').click();
  await expect(page.getByTestId('store-view-detail-state')).toHaveText('Live');
  await page.getByTestId('store-view-make-private').click();
  await page.getByTestId('store-view-publish').click();
  await expect(page.getByTestId('store-view-detail-state')).toHaveText('Publication Failed');
  await page.getByTestId('store-view-retry-publication').click();
  await expect(page.getByTestId('store-view-detail-state')).toHaveText('Live');
});
