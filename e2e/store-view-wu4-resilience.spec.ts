import { expect, test } from '@playwright/test';
import {
  createdAt, inventoryId, linkA, makeDetail, makeHistory, makeMediaRecord,
  installHarness, loginAsOwner,
} from './store-view-wu4-harness';

async function openDetail(page: Parameters<typeof installHarness>[0]) {
  await loginAsOwner(page);
  await expect(page).toHaveURL(/\/library$/u);
  await page.goto(`/store-view/${inventoryId}`);
  await expect(page.getByTestId('store-view-manage-photos')).toBeVisible();
}

test('renders the 50-entry activity cap with action/event/retry labels and revisions', async ({ page }) => {
  const activity = [
    { kind: 'audit', action: 'phase9.inventory.details_updated', createdAt, details: {} },
    { kind: 'audit', action: 'phase9.inventory.stock_adjusted', createdAt, details: {} },
    { kind: 'audit', action: 'phase9.inventory.media_reordered', createdAt, details: {} },
    { kind: 'audit', action: 'phase9.inventory.media_removed', createdAt, details: {} },
    { kind: 'audit', action: 'phase9.inventory.media_replaced', createdAt, details: {} },
    { kind: 'audit', action: 'phase9.publication.publish', createdAt, details: {} },
    { kind: 'audit', action: 'phase9.publication.pause', createdAt, details: {} },
    { kind: 'audit', action: 'phase9.publication.private', createdAt, details: {} },
    { kind: 'audit', action: 'phase9.publication.retry', createdAt, details: {} },
    { kind: 'event', eventType: 'inventory.publication.failed', source: 'worker', severity: 'error', createdAt, payload: {} },
    { kind: 'publication_retry', status: 'dead_letter', attemptCount: 5, maxAttempts: 5, safeErrorCode: 'P9_PROJECTION_TRANSIENT', createdAt, updatedAt: createdAt, completedAt: createdAt },
  ];
  while (activity.length < 50) activity.push({ kind: 'audit', action: 'phase9.inventory.media_reordered', createdAt, details: {} });
  await installHarness(page, { history: makeHistory(activity) });
  await openDetail(page);
  await expect(page.getByTestId('store-view-activity-entry')).toHaveCount(50);
  const entries = page.getByTestId('store-view-activity-entry');
  await expect(entries.nth(0)).toContainText('Details changed');
  await expect(entries.nth(1)).toContainText('Stock changed');
  await expect(page.getByText('Details changed', { exact: true })).toBeVisible();
  await expect(page.getByText('Stock changed', { exact: true })).toBeVisible();
  await expect(page.getByText('Photos reordered', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Photo removed', { exact: true })).toBeVisible();
  await expect(page.getByText('Photo replaced', { exact: true })).toBeVisible();
  await expect(page.getByText('Published', { exact: true })).toBeVisible();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();
  await expect(page.getByText('Made private', { exact: true })).toBeVisible();
  await expect(page.getByText('Publication retried', { exact: true })).toBeVisible();
  await expect(page.getByText('Publication failed', { exact: true })).toBeVisible();
  await expect(page.getByText('Publication retry failed after 5 attempts', { exact: true })).toBeVisible();
  await expect(page.getByTestId('store-view-revision-2')).toContainText('Photo change went live');
  await expect(page.getByTestId('store-view-revision-1')).toContainText('Went live');
  await expect(page.getByText('History is read-only.')).toBeVisible();
  await expect(page.getByText(/Undo|Restore/iu)).toHaveCount(0);
});

test('exercises history loading, empty, and read-failure states', async ({ page }) => {
  const state = await installHarness(page, { historyRead: 'loading' });
  await openDetail(page);
  await expect(page.getByText('Loading activity…')).toBeVisible();
  await expect.poll(() => state.calls.filter((call) => call.action === 'read_store_view_history').length).toBe(1);

  state.historyRead = 'ok';
  state.history = { activity: [], publicRevisions: [] };
  await page.reload();
  await expect(page.getByText('No activity recorded yet.')).toBeVisible();
  await expect(page.getByText('Nothing has gone live yet.')).toBeVisible();

  state.historyRead = 'error';
  await page.reload();
  await expect(page.getByText('Activity history is unavailable.')).toBeVisible();
});

test('exercises media loading, read error, empty state, pending distinction, and failed pending state', async ({ page }) => {
  const state = await installHarness(page, { mediaRead: 'loading' });
  await openDetail(page);
  await page.getByTestId('store-view-manage-photos').click();
  await expect(page.getByRole('heading', { name: 'Manage Photos', exact: true })).toBeVisible();
  await expect(page.getByText('Primary photo').first()).toBeVisible();

  await page.getByTestId('close-store-view-manage-photos').click();
  state.mediaRead = 'error';
  await page.reload();
  await expect(page.getByTestId('store-view-manage-photos')).toBeVisible();
  await page.getByTestId('store-view-manage-photos').click();
  await expect(page.getByText('The current photos could not be loaded.')).toBeVisible();

  await page.getByTestId('close-store-view-manage-photos').click();
  state.mediaRead = 'ok';
  state.media = [];
  state.pending = [];
  await page.reload();
  await page.getByTestId('store-view-manage-photos').click();
  await expect(page.getByText('No approved public photos yet. Add the first photo below.')).toBeVisible();
  await expect(page.getByTestId('store-view-media-add-photo')).toBeEnabled();

  await page.getByTestId('close-store-view-manage-photos').click();
  state.media = [makeMediaRecord(linkA, 'primary_fallback', 1)];
  state.pending = [{ capabilityId: '00000000-0000-4000-8000-000000000051', role: 'primary_fallback', order: 1, state: 'processing', operationKind: 'replace', targetLinkId: linkA, sourceMediaAssetId: '00000000-0000-4000-8000-000000000052', mediaAssetId: '00000000-0000-4000-8000-000000000053', safeErrorCode: null }];
  await page.reload();
  await expect(page.getByTestId('store-view-manage-photos')).toBeVisible();
  await page.getByTestId('store-view-manage-photos').click();
  await expect(page.getByText('Safety processing…')).toBeVisible();
  await expect(page.getByTestId('store-view-media-install-00000000-0000-4000-8000-000000000051')).toHaveCount(0);
  await page.getByTestId('close-store-view-manage-photos').click();
  state.pending = state.pending.map((pending) => ({ ...pending, state: 'failed', safeErrorCode: 'P9_MEDIA_NOT_APPROVED' }));
  await page.reload();
  await expect(page.getByTestId('store-view-manage-photos')).toBeVisible();
  await page.getByTestId('store-view-manage-photos').click();
  await expect(page.getByText('Failed safety validation (P9_MEDIA_NOT_APPROVED).')).toBeVisible();
});

test('keeps out-of-stock status and publication lifecycle controls usable with media/history loaded', async ({ page }) => {
  const state = await installHarness(page, {
    detail: makeDetail({ effectiveState: 'out_of_stock', visibilityStatus: 'out_of_stock', stockState: 'out_of_stock', quantityAvailable: 0 }),
  });
  await openDetail(page);
  await expect(page.getByTestId('store-view-detail-state')).toHaveText('Out of Stock');
  await expect(page.getByTestId('store-view-detail-attention')).toHaveText('None');
  await page.getByTestId('store-view-manage-photos').click();
  await expect(page.getByText('Primary photo').first()).toBeVisible();
  await page.getByTestId('close-store-view-manage-photos').click();
  expect(state.calls.some((call) => call.action === 'read_store_view_history')).toBe(true);

  await page.getByTestId('store-view-pause').click();
  await expect(page.getByTestId('store-view-detail-state')).toHaveText('Paused');
  await page.getByTestId('store-view-republish').click();
  await expect(page.getByTestId('store-view-detail-state')).toHaveText('Live');
  await page.getByTestId('store-view-make-private').click();
  await expect(page.getByTestId('store-view-detail-state')).toHaveText('Private');
  await page.getByTestId('store-view-publish').click();
  await expect(page.getByTestId('store-view-detail-state')).toHaveText('Live');
});

test('keeps Store View media controls readable at a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installHarness(page);
  await openDetail(page);
  await expect(page.getByText('Public revisions', { exact: true })).toBeVisible();
  await expect(page.getByText('Activity and history')).toBeVisible();
  await page.getByTestId('store-view-manage-photos').click();
  await expect(page.getByRole('heading', { name: 'Manage Photos', exact: true })).toBeVisible();
  const remove = page.getByTestId('store-view-media-remove-0');
  await expect(remove).toBeVisible();
  const box = await remove.boundingBox();
  expect(box).not.toBeNull();
  if (box) expect(box.x + box.width).toBeLessThanOrEqual(390);
  await remove.click();
  await expect(page.getByTestId('store-view-media-confirm-remove')).toBeVisible();
  await expect(page.getByText('Required damage evidence cannot be removed from a live listing.')).toBeVisible();
});
