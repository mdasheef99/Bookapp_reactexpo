import { expect, type Page, test } from '@playwright/test';
import {
  installHarness,
  inventoryId,
  loginAsOwner,
} from './store-view-wu4-harness';

const sessionId = '00000000-0000-4000-8000-000000000035';
const candidateId = '00000000-0000-4000-8000-000000000036';
const inputId = '00000000-0000-4000-8000-000000000037';
const timestamp = '2026-08-15T04:00:00.000+05:30';

function json(route: any, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
}

function ownerEnvelope(data: unknown) {
  return { contractVersion: 'phase9-owner-ux-v1', data };
}

function ownerInventoryPage() {
  return {
    contractVersion: 'phase9-owner-inventory-v2',
    items: [{
      id: inventoryId, title: 'The Bookshop', authors: ['Penelope Fitzgerald'],
      isbn10: null, isbn13: '9780006543541', condition: 'good', quantityAvailable: 1,
      sellingPriceMinor: 35000, visibilityStatus: 'published', listingQualityStatus: 'ready',
      publicNotes: null, entryMethod: 'image_extraction', createdAt: timestamp,
      updatedAt: timestamp, inventoryVersion: 3, publicationStatus: 'published',
      publicationIntentVersion: 2, publicationRetryable: false,
      publicationFailureReason: null, publicListingStatus: 'active',
    }],
    pageInfo: { hasMore: false, nextCursor: null },
  };
}

function reviewedCandidate() {
  return {
    sessionId, candidateId, inputId, ordinal: 1, candidateState: 'ready', candidateVersion: 4,
    observed: { title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en', script: null },
    metadata: {
      state: 'manual', revision: 7, selectionVersion: null, selectionId: null,
      canonicalEditionId: null, snapshot: null,
    },
    review: {
      value: {
        originalTitle: 'The Bookshop', authors: ['Penelope Fitzgerald'], originalLanguage: 'en',
        script: null, metadataChoice: { mode: 'manual', selectionId: null }, quantity: 1,
        priceMinor: 35000, baseCondition: 'good',
        damageDisclosure: {
          hasDamage: false, damageTypes: [], damageNote: null,
          isSellable: true, completeReadableSafe: true,
        },
        shelfLocation: 'A3', notes: { publicNote: null, internalNote: null },
        publicationIntent: 'private', duplicateIntent: null,
        originalFieldConfirmation: { title: true, authors: [true] }, candidateDisposition: 'reviewed',
      },
      reviewVersion: 3,
    },
    duplicateAdvice: {
      state: 'none', version: null, targetInventoryId: null, matchReason: null,
      compatibility: null, display: null, allowedIntents: [],
    },
    variantSummary: { unresolvedCount: 0, proposalVersions: [] }, attentionCodes: [],
    readiness: {
      reviewReady: true, blockers: [], derivedFromCandidateVersion: 4,
      derivedFromMetadataRevision: 7, derivedFromDuplicateAdviceVersion: null,
    },
    allowedActions: ['save_review', 'add_to_inventory'], updatedAt: timestamp,
  };
}

function reviewedSession() {
  return {
    sessionId, status: 'active', sessionVersion: 2, startedAt: timestamp, updatedAt: timestamp,
    closedAt: null, expiresAt: '2026-09-15T04:00:00.000+05:30',
    defaults: {
      language: 'en', script: null, condition: 'good', location: 'A3', quantity: 1, publication: 'private',
    },
    closeSummary: {
      imagesSubmitted: 1, imagesProcessed: 1, imagesFailed: 0, imagesSkipped: 0,
      candidatesDetected: 1, candidatesReviewReady: 1, candidatesNeedsReview: 0, candidatesFailed: 0,
      falseDetections: 0, manualMissedCandidates: 0, committedInventoryItems: 0,
      quantitiesAddedToExisting: 0, privateItems: 0, publishedItems: 0, languageSkips: 0,
      candidateCapSkips: 0, qualitySkips: 0,
    },
    allInputsTerminal: true, closeState: 'closeable', presentationRevision: 3,
  };
}

async function installWu5OwnerRoutes(page: Page) {
  await page.route('https://ahntbtktjjmvfosgkmgn.supabase.co/**', async (route: any) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/rest/v1/rpc/phase9_owner_inventory_page_v2') {
      return json(route, ownerInventoryPage());
    }
    if (url.pathname === '/functions/v1/phase9-owner-ingestion') {
      const body = request.postDataJSON() as { action?: string };
      switch (body.action) {
        case 'discover_scan_session':
          return json(route, ownerEnvelope({ activeSession: null, needsReviewCount: 1, reviewScopeVersion: 1 }));
        case 'read_scan_session':
          return json(route, ownerEnvelope(reviewedSession()));
        case 'list_scan_candidates':
          return json(route, ownerEnvelope({
            items: [{
              sessionId, sessionStartedAt: timestamp, sessionExpiresAt: '2026-09-15T04:00:00.000+05:30',
              sessionStatus: 'active', candidateId, inputId, ordinal: 1, title: 'The Bookshop',
              authors: ['Penelope Fitzgerald'], language: 'en', candidateState: 'ready',
              candidateVersion: 4, metadataState: 'manual', reviewDisposition: 'reviewed',
              attentionCodes: [], reviewReady: true, updatedAt: timestamp,
            }],
            pageInfo: { nextCursor: null, hasMore: false }, scopeVersion: 1, sessionVersion: null,
          }));
        case 'read_scan_candidate':
        case 'update_candidate_review':
          return json(route, ownerEnvelope(reviewedCandidate()));
        case 'add_candidate_to_inventory':
          return json(route, ownerEnvelope({
            sessionId, candidateId, candidateVersion: 5, inventoryId,
            inventoryVersion: 1, outcome: 'committed_private',
          }));
        default:
          return route.fallback();
      }
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
  await expect(page.getByText('Scan, review, and recovery stay here. Committed items are managed in Store View.')).toBeVisible();
  await expect(page.getByText('The Bookshop')).toBeVisible();
  await expect(page.getByText(/Publication controls use/u)).toHaveCount(0);
  await expect(page.getByText('Open in Store View')).toBeVisible();

  await page.getByRole('tab', { name: /Store View/u }).click();
  await expect(page.getByText('Manage committed books. Filters are applied by the server before pagination.')).toBeVisible();
});

test('hands a successful Add result to Store View using the returned inventoryId', async ({ page }) => {
  await installHarness(page);
  await installWu5OwnerRoutes(page);
  await loginAsOwner(page);
  await page.goto(`/inventory/scan/${sessionId}/candidate/${candidateId}`);

  await expect(page.getByText('The Bookshop')).toBeVisible();
  await page.getByRole('button', { name: 'Add to inventory', exact: true }).click();
  await expect(page.getByTestId('add-to-inventory-success')).toBeVisible();
  await expect(page.getByText('✓ Added to Inventory')).toBeVisible();
  await page.getByTestId('view-in-store-view').click();
  await expect(page).toHaveURL(new RegExp(`/store-view/${inventoryId}$`, 'u'));
});
