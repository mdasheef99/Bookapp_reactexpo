import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  capabilityAdd, capabilityReplace, inventoryId, linkA, linkB, mediaAssetA, mediaAssetUpload,
  installHarness, loginAsOwner,
} from './store-view-wu4-harness';

const mediaFixturePath = path.resolve('assets/icon.png');

async function openDetail(page: Parameters<typeof installHarness>[0]) {
  await loginAsOwner(page);
  await expect(page).toHaveURL(/\/library$/u);
  await page.goto(`/store-view/${inventoryId}`);
  await expect(page.getByTestId('store-view-manage-photos')).toBeVisible();
}

async function chooseImage(page: Parameters<typeof installHarness>[0], testId: string) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId(testId).click();
  await (await chooser).setFiles(mediaFixturePath);
}

test('covers media read, approved roles/order, safe remove, unsafe rejection, and stale refresh', async ({ page }) => {
  const state = await installHarness(page);
  await openDetail(page);
  await expect(page.getByText('Public revisions', { exact: true })).toBeVisible();
  await page.getByTestId('store-view-manage-photos').click();
  await expect(page.getByText('Primary photo').first()).toBeVisible();
  await expect(page.getByText('Actual copy').first()).toBeVisible();
  await expect(page.getByText('Cover photo')).toBeVisible();
  await expect(page.getByText('Position 1 · 1200×900')).toBeVisible();
  await expect(page.getByText('Position 2 · 1200×900')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/storage\/v1|staging|signed-upload|access_token/iu);

  await page.getByTestId('store-view-media-down-0').click();
  await expect(page.getByText('Photo order updated.')).toBeVisible();
  await expect.poll(() => state.calls.filter((call) => call.action === 'reorder_store_view_media').length).toBe(1);
  await expect(page.getByTestId('store-view-media-up-1')).not.toHaveAttribute('aria-disabled', 'true');
  expect(state.media.map((record) => record.linkId)).toEqual([linkB, linkA]);

  state.failedCommands.reorder_store_view_media = 'P9_VERSION_CONFLICT';
  await page.getByTestId('store-view-media-up-1').click();
  await expect.poll(() => state.calls.filter((call) => call.action === 'reorder_store_view_media').length).toBe(2);
  await expect(page.getByText('This book changed. The latest photos were refreshed.')).toBeVisible();
  expect(state.media.map((record) => record.linkId)).toEqual([linkB, linkA]);

  state.failedCommands.reorder_store_view_media = '';
  state.failedCommands.remove_store_view_media = 'P9_MEDIA_CHANGE_UNSAFE';
  await expect(page.getByTestId('store-view-media-remove-1')).not.toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId('store-view-media-remove-1').click();
  await expect(page.getByText('Required damage evidence cannot be removed from a live listing.')).toBeVisible();
  await page.getByTestId('store-view-media-confirm-remove').click();
  await expect.poll(() => state.calls.filter((call) => call.action === 'remove_store_view_media').length).toBe(1);
  await expect(page.getByText('That photo cannot be changed because the live listing needs it.')).toBeVisible();
  expect(state.media).toHaveLength(2);

  state.failedCommands.remove_store_view_media = '';
  await expect(page.getByTestId('store-view-media-remove-1')).not.toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId('store-view-media-remove-1').click();
  await page.getByTestId('store-view-media-confirm-remove').click();
  await expect.poll(() => state.calls.filter((call) => call.action === 'remove_store_view_media').length).toBe(2);
  await expect(page.getByText('Photo removed.')).toBeVisible();
  expect(state.media).toHaveLength(1);
});

test('runs actual picker upload, processing, approval, replacement, and approved add journeys', async ({ page }) => {
  const state = await installHarness(page, { statusSequence: ['processing', 'approved'] });
  await openDetail(page);
  await page.getByTestId('store-view-manage-photos').click();

  await chooseImage(page, 'store-view-media-replace-0');
  await expect(page.getByText('Photo uploaded. Safety processing is running; check again shortly.')).toBeVisible();
  await expect(page.getByText('Safety processing…')).toBeVisible();
  await expect(page.getByTestId('store-view-save-changes')).toHaveCount(0);
  await page.getByTestId('store-view-media-check-status').click();
  await expect(page.getByText('Replacement photo installed.')).toBeVisible();
  const replacement = state.calls.find((call) => call.action === 'replace_store_view_media');
  expect(replacement?.body.targetLinkId).toBe(linkA);
  expect(state.media.find((record) => record.linkId === linkA)?.mediaAssetId).toBe(mediaAssetUpload);
  expect(state.media.find((record) => record.linkId === linkB)?.mediaAssetId).toBe('00000000-0000-4000-8000-000000000042');

  state.statusSequence.push('processing', 'approved');
  await page.getByTestId('store-view-media-add-role-actual_copy').click();
  await chooseImage(page, 'store-view-media-add-photo');
  await expect(page.getByText('Photo uploaded. Safety processing is running; check again shortly.')).toBeVisible();
  await page.getByTestId('store-view-media-check-status').click();
  await expect(page.getByText('Approved sanitized public-copy photo linked.')).toBeVisible();
  const add = state.calls.find((call) => call.action === 'submit_public_copy_media');
  expect(add?.body.targetLinkId).toBeUndefined();
  expect(state.media).toHaveLength(3);
  expect(state.calls.filter((call) => call.action === 'authorize_public_copy')).toHaveLength(2);
});

test('preserves replacement target identity across reorder and reload', async ({ page }) => {
  const state = await installHarness(page, { statusSequence: ['processing'] });
  await openDetail(page);
  await page.getByTestId('store-view-manage-photos').click();
  await chooseImage(page, 'store-view-media-replace-0');
  await expect(page.getByText('Safety processing…')).toBeVisible();
  await page.getByTestId('store-view-media-down-0').click();
  await expect(page.getByText('Photo order updated.')).toBeVisible();
  expect(state.pending[0].targetLinkId).toBe(linkA);

  await page.reload();
  await expect(page.getByTestId('store-view-manage-photos')).toBeVisible();
  state.pending = state.pending.map((pending) => ({ ...pending, state: 'approved' }));
  await page.getByTestId('store-view-manage-photos').click();
  await expect(page.getByText('Approved and ready to install.')).toBeVisible();
  await page.getByTestId(`store-view-media-install-${capabilityReplace}`).click();
  await expect(page.getByText('Replacement photo installed.')).toBeVisible();
  const replacement = state.calls.filter((call) => call.action === 'replace_store_view_media').at(-1);
  expect(replacement?.body.targetLinkId).toBe(linkA);
  expect(state.media[0].linkId).toBe(linkB);
});

test('preserves add operation across reload and distinguishes failed replacement', async ({ page }) => {
  const state = await installHarness(page, { statusSequence: ['processing'] });
  await openDetail(page);
  await page.getByTestId('store-view-manage-photos').click();
  await chooseImage(page, 'store-view-media-add-photo');
  await expect(page.getByText('Safety processing…')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('store-view-manage-photos')).toBeVisible();
  state.pending = state.pending.map((pending) => ({ ...pending, state: 'approved' }));
  await page.getByTestId('store-view-manage-photos').click();
  await expect(page.getByText('Approved and ready to add.')).toBeVisible();
  await page.getByTestId(`store-view-media-install-${capabilityAdd}`).click();
  await expect(page.getByText('Approved sanitized public-copy photo linked.')).toBeVisible();
  const add = state.calls.filter((call) => call.action === 'submit_public_copy_media').at(-1);
  expect(add?.body.targetLinkId).toBeUndefined();

  await page.getByTestId('close-store-view-manage-photos').click();
  state.statusSequence.push('processing', 'failed');
  await page.getByTestId('store-view-manage-photos').click();
  await chooseImage(page, 'store-view-media-replace-0');
  await expect(page.getByText('Safety processing…')).toBeVisible();
  await page.getByTestId('store-view-media-check-status').click();
  await expect(page.getByText('The photo failed safety validation. Choose another image.')).toBeVisible();
  await expect(page.getByTestId(`store-view-media-install-${capabilityReplace}`)).toHaveCount(0);
  expect(state.calls.filter((call) => call.action === 'replace_store_view_media')).toHaveLength(0);
  expect(state.media.some((record) => record.mediaAssetId === mediaAssetA)).toBe(true);
});
