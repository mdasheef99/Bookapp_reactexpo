import { expect, type Page, test } from '@playwright/test';

const userId = '00000000-0000-4000-8000-000000000010';
const storeId = '00000000-0000-4000-8000-000000000020';
const inventoryId = '00000000-0000-4000-8000-000000000030';
const linkA = '00000000-0000-4000-8000-000000000031';
const linkB = '00000000-0000-4000-8000-000000000032';
const createdAt = '2026-08-15T04:00:00.000+05:30';

const detail = {
  identity: { inventoryId },
  presentation: {
    title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
    publicDescription: 'A browser-smoke description.', condition: 'good',
    publicConditionNote: null, hasDamage: false, damageTypes: [], damageNote: null,
    isSellable: true, sellingPriceMinor: 35000,
  },
  stockSummary: { quantityAvailable: 1, stockState: 'low_stock' },
  lifecycle: { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' },
  attention: { attentionState: 'none', attentionReasons: [] },
  capabilities: ['edit_details', 'adjust_stock', 'manage_photos', 'pause', 'make_private'],
  versions: { inventoryVersion: 3, publicationIntentVersion: 2 },
  mediaSummary: { approvedCount: 2 },
  publicState: null,
  privateOperations: { shelfLocation: 'A3', internalNotes: null },
  stock: { quantityTotal: 1, quantityAvailable: 1, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
  historySummary: { publicRevisionCount: 2, latestPublicRevision: null },
};

const mediaRecord = (linkId: string, role: string, publicOrder: number) => ({
  linkId,
  mediaAssetId: linkId === linkA ? '00000000-0000-4000-8000-000000000041' : '00000000-0000-4000-8000-000000000042',
  role, publicOrder, approvalStatus: 'approved', approvedAt: createdAt,
  url: `/storage/v1/object/public/inventory-photos/${linkId}.webp`,
  width: 1200, height: 900,
});

async function mockSupabase(page: Page) {
  let media = [
    mediaRecord(linkA, 'primary_fallback', 1),
    mediaRecord(linkB, 'actual_copy', 2),
  ];
  let pending = [{
    capabilityId: '00000000-0000-4000-8000-000000000051',
    role: 'actual_copy', order: 2, state: 'approved',
    operationKind: 'replace', targetLinkId: linkB,
    sourceMediaAssetId: '00000000-0000-4000-8000-000000000052',
    mediaAssetId: '00000000-0000-4000-8000-000000000053',
    safeErrorCode: null,
  }];

  await page.route('https://ahntbtktjjmvfosgkmgn.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/auth/v1/otp') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    if (url.pathname === '/auth/v1/verify') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        access_token: 'store-view-media-token', refresh_token: 'store-view-media-refresh',
        expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
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
      const body = request.postDataJSON() as Record<string, unknown>;
      if (body.action === 'read_store_view_media') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          contractVersion: 'phase9-store-view-media-v1',
          data: { inventoryId, media, pendingReplacements: pending },
        }) });
      }
      if (body.action === 'reorder_store_view_media') {
        const ordered = body.orderedLinkIds as string[];
        media = ordered.map((linkId) => (
          media.find((record) => record.linkId === linkId) as typeof media[number]
        )).map((record, index) => ({ ...record, publicOrder: index + 1 }));
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          contractVersion: 'phase9-store-view-media-v1',
          data: {
            inventoryId, inventoryVersion: 4, publicationIntentVersion: 2,
            mediaLinkIds: body.orderedLinkIds, publicRevisionNumber: null,
            outcome: 'media_reordered',
          },
        }) });
      }
      if (body.action === 'remove_store_view_media') {
        media = media.filter((record) => record.linkId !== body.linkId);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          contractVersion: 'phase9-store-view-media-v1',
          data: {
            inventoryId, inventoryVersion: 4, publicationIntentVersion: 2,
            removedMediaAssetId: '00000000-0000-4000-8000-000000000042',
            publicRevisionNumber: 3, outcome: 'media_removed',
          },
        }) });
      }
      if (body.action === 'replace_store_view_media') {
        const target = media.find((record) => record.linkId === body.targetLinkId);
        if (target) {
          target.mediaAssetId = body.mediaAssetId as string;
          target.mediaAssetId = target.mediaAssetId.replace('0041', '0053');
          target.url = `/storage/v1/object/public/inventory-photos/${target.linkId}-replacement.webp`;
        }
        pending = [];
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          contractVersion: 'phase9-store-view-media-v1',
          data: {
            inventoryId, inventoryVersion: 4, publicationIntentVersion: 2,
            mediaLinkId: body.targetLinkId, mediaAssetId: body.mediaAssetId,
            removedMediaAssetId: '00000000-0000-4000-8000-000000000042',
            publicRevisionNumber: 3, outcome: 'media_replaced',
          },
        }) });
      }
      if (body.action === 'read_store_view_history') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          contractVersion: 'phase9-store-view-history-v1',
          data: {
            inventoryId,
            activity: [
              { kind: 'audit', action: 'phase9.publication.publish', createdAt, details: {} },
              { kind: 'audit', action: 'phase9.inventory.media_reordered', createdAt, details: {} },
              { kind: 'publication_retry', status: 'dead_letter', attemptCount: 5, maxAttempts: 5,
                safeErrorCode: 'P9_PROJECTION_TRANSIENT', createdAt, updatedAt: createdAt, completedAt: createdAt },
            ],
            publicRevisions: [
              { revisionNumber: 2, sourceAction: 'media_change', createdAt, listingId: null, publicSnapshot: {} },
              { revisionNumber: 1, sourceAction: 'initial_publish', createdAt, listingId: null, publicSnapshot: {} },
            ],
          },
        }) });
      }
      if (body.action === 'read_store_view_detail') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          contractVersion: 'phase9-store-view-read-v1', data: detail,
        }) });
      }
      if (body.action === 'read_store_view_page') {
        const { privateOperations: _privateOperations, stock: _stock, historySummary: _historySummary, ...pageItem } = detail;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          contractVersion: 'phase9-store-view-read-v1',
          data: { items: [pageItem], pageInfo: { hasNextPage: false, nextCursor: null } },
        }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        contractVersion: 'phase9-store-view-media-v1',
        data: { inventoryId, media: [], pendingReplacements: [] },
      }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test('runs intercepted Store View Manage Photos and Activity/history flows', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/login');
  await page.getByTestId('login-phone-input').fill('1234567890');
  await page.getByTestId('login-continue-button').click();
  await page.getByTestId('verify-otp-input').fill('123456');
  await page.getByTestId('verify-otp-button').click();
  await expect(page).toHaveURL(/\/library$/u);

  await page.goto(`/store-view/${inventoryId}`);
  await expect(page.getByTestId('store-view-manage-photos')).toBeVisible();
  await expect(page.getByText('Public revisions', { exact: true })).toBeVisible();
  await expect(page.getByText('Revision 2 · Photo change went live')).toBeVisible();
  await expect(page.getByText('Published')).toBeVisible();
  await expect(page.getByText('Publication retry failed after 5 attempts')).toBeVisible();

  await page.getByTestId('store-view-manage-photos').click();
  await expect(page.getByText('Cover photo')).toBeVisible();
  await expect(page.getByTestId('store-view-media-up-0')).toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId('store-view-media-down-0').click();
  await expect(page.getByText('Photo order updated.')).toBeVisible();
  await expect(page.getByText('Position 2 · 1200×900').first()).toBeVisible();

  await page.getByTestId('store-view-media-remove-1').click();
  await page.getByTestId('store-view-media-confirm-remove').click();
  await expect(page.getByText('Photo removed.')).toBeVisible();

  await page.getByTestId('store-view-media-install-00000000-0000-4000-8000-000000000051').click();
  await expect(page.getByText('Replacement photo installed.')).toBeVisible();

  await page.getByTestId('close-store-view-manage-photos').click();
  await expect(page.getByTestId('store-view-detail-state')).toHaveText('Live');
});
