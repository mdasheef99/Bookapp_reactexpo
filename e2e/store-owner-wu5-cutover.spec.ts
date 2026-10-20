import { expect, type Page, test } from '@playwright/test';
import {
  installHarness,
  loginAsOwner,
} from './store-view-wu4-harness';

function json(route: any, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
}

function ownerEnvelope(data: unknown) {
  return { contractVersion: 'phase9-owner-ux-v1', data };
}

async function installWu5OwnerRoutes(page: Page) {
  await page.route('https://ahntbtktjjmvfosgkmgn.supabase.co/**', async (route: any) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/functions/v1/phase9-owner-ingestion') {
      const body = request.postDataJSON() as { action?: string };
      if (body.action === 'discover_scan_session') {
        return json(route, ownerEnvelope({
          activeSession: null, needsReviewCount: 0, reviewScopeVersion: 1,
        }));
      }
      return route.fallback();
    }
    return route.fallback();
  });
}

test('cuts over primary Owner navigation and preserves the Inventory handoff boundary', async ({ page }) => {
  await installHarness(page);
  await installWu5OwnerRoutes(page);
  await loginAsOwner(page);
  await page.goto('/dashboard');

  for (const label of ['Dashboard', 'Inventory', 'Store View', 'Orders', 'Subscription']) {
    await expect(page.getByRole('tab', { name: new RegExp(label, 'u') })).toBeVisible();
  }

  await page.getByRole('tab', { name: /Inventory/u }).click();

  await page.getByRole('tab', { name: /Store View/u }).click();
  await expect(page.getByText('Manage committed books. Filters are applied by the server before pagination.')).toBeVisible();
});
