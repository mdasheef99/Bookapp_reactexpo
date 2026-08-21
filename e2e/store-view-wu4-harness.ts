import type { Page } from '@playwright/test';

export const userId = '00000000-0000-4000-8000-000000000010';
export const storeId = '00000000-0000-4000-8000-000000000020';
export const inventoryId = '00000000-0000-4000-8000-000000000030';
export const linkA = '00000000-0000-4000-8000-000000000031';
export const linkB = '00000000-0000-4000-8000-000000000032';
export const linkC = '00000000-0000-4000-8000-000000000033';
export const capabilityReplace = '00000000-0000-4000-8000-000000000051';
export const capabilityAdd = '00000000-0000-4000-8000-000000000061';
export const mediaAssetA = '00000000-0000-4000-8000-000000000041';
export const mediaAssetB = '00000000-0000-4000-8000-000000000042';
export const mediaAssetUpload = '00000000-0000-4000-8000-000000000053';
export const createdAt = '2026-08-15T04:00:00.000+05:30';

export type MediaRecord = {
  linkId: string; mediaAssetId: string; role: 'damage' | 'actual_copy' | 'primary_fallback';
  publicOrder: number; approvalStatus: 'approved'; approvedAt: string; url: string;
  width: number; height: number;
};

export type PendingMedia = {
  capabilityId: string; role: MediaRecord['role']; order: number;
  state: 'upload_pending' | 'processing' | 'failed' | 'approved';
  operationKind: 'add' | 'replace'; targetLinkId: string | null;
  sourceMediaAssetId: string | null; mediaAssetId: string | null; safeErrorCode: string | null;
};

export type HistoryFixture = {
  activity: Array<Record<string, unknown>>;
  publicRevisions: Array<Record<string, unknown>>;
};

export type HarnessState = {
  detail: Record<string, any>;
  media: MediaRecord[];
  pending: PendingMedia[];
  history: HistoryFixture;
  mediaRead: 'ok' | 'error' | 'loading';
  historyRead: 'ok' | 'error' | 'loading';
  failedCommands: Record<string, string>;
  statusSequence: Array<'processing' | 'approved' | 'failed'>;
  calls: Array<{ action: string; body: Record<string, unknown> }>;
  lastAuthorize: Record<string, unknown> | null;
};

export function makeDetail(overrides: {
  effectiveState?: string; visibilityStatus?: string; stockState?: string;
  quantityAvailable?: number; capabilities?: string[]; attentionReasons?: string[];
} = {}): Record<string, any> {
  const quantityAvailable = overrides.quantityAvailable ?? 1;
  const effectiveState = overrides.effectiveState ?? 'live';
  return {
    identity: { inventoryId },
    presentation: {
      title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
      publicDescription: 'A browser-smoke description.', condition: 'good',
      publicConditionNote: null, hasDamage: false, damageTypes: [], damageNote: null,
      isSellable: true, sellingPriceMinor: 35000,
    },
    stockSummary: { quantityAvailable, stockState: overrides.stockState ?? 'low_stock' },
    lifecycle: {
      publicationState: effectiveState === 'private' ? 'private' : 'published',
      effectiveState, visibilityStatus: overrides.visibilityStatus ?? 'published',
    },
    attention: {
      attentionState: overrides.attentionReasons?.length ? 'action_required' : 'none',
      attentionReasons: overrides.attentionReasons ?? [],
    },
    capabilities: overrides.capabilities ?? [
      'edit_details', 'adjust_stock', 'manage_photos', 'pause', 'make_private',
    ],
    versions: { inventoryVersion: 3, publicationIntentVersion: 2 },
    mediaSummary: { approvedCount: 2 }, publicState: null,
    privateOperations: { shelfLocation: 'A3', internalNotes: 'Owner only smoke note.' },
    stock: {
      quantityTotal: quantityAvailable, quantityAvailable, quantityReserved: 0,
      quantitySold: 0, quantityRemoved: 0,
    },
    historySummary: { publicRevisionCount: 2, latestPublicRevision: null },
  };
}

export function makeMediaRecord(
  linkId: string, role: MediaRecord['role'], publicOrder: number,
): MediaRecord {
  return {
    linkId,
    mediaAssetId: linkId === linkA ? mediaAssetA : mediaAssetB,
    role, publicOrder, approvalStatus: 'approved', approvedAt: createdAt,
    url: `https://cdn.example.test/inventory/${linkId}.webp`, width: 1200, height: 900,
  };
}

export function makeHistory(activity: Array<Record<string, unknown>> = [
  { kind: 'audit', action: 'phase9.publication.publish', createdAt, details: {} },
  { kind: 'audit', action: 'phase9.inventory.media_reordered', createdAt, details: {} },
  { kind: 'publication_retry', status: 'dead_letter', attemptCount: 5, maxAttempts: 5,
    safeErrorCode: 'P9_PROJECTION_TRANSIENT', createdAt, updatedAt: createdAt, completedAt: createdAt },
]): HistoryFixture {
  return {
    activity,
    publicRevisions: [
      { revisionNumber: 2, sourceAction: 'media_change', createdAt, listingId: null, publicSnapshot: {} },
      { revisionNumber: 1, sourceAction: 'initial_publish', createdAt, listingId: null, publicSnapshot: {} },
    ],
  };
}

type HarnessOptions = Partial<Pick<HarnessState, 'detail' | 'media' | 'pending' | 'history'
  | 'mediaRead' | 'historyRead' | 'failedCommands' | 'statusSequence'>>;

function json(route: any, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
}

function mediaResult(data: Record<string, unknown>) {
  return { contractVersion: 'phase9-store-view-media-v1', data };
}

function publicationResult(state: HarnessState, outcome: string) {
  return {
    inventoryId, inventoryVersion: state.detail.versions.inventoryVersion,
    publicationIntentVersion: state.detail.versions.publicationIntentVersion,
    publicationStatus: state.detail.lifecycle.publicationState,
    visibilityStatus: state.detail.lifecycle.visibilityStatus,
    publicationRetryable: false, publicationFailureReason: null, outcome,
    listingId: null,
  };
}

export async function installHarness(page: Page, options: HarnessOptions = {}): Promise<HarnessState> {
  const state: HarnessState = {
    detail: options.detail ?? makeDetail(),
    media: options.media ?? [
      makeMediaRecord(linkA, 'primary_fallback', 1), makeMediaRecord(linkB, 'actual_copy', 2),
    ],
    pending: options.pending ?? [], history: options.history ?? makeHistory(),
    mediaRead: options.mediaRead ?? 'ok', historyRead: options.historyRead ?? 'ok',
    failedCommands: options.failedCommands ?? {}, statusSequence: options.statusSequence ?? [],
    calls: [], lastAuthorize: null,
  };

  const respondRead = async (route: any, kind: 'media' | 'history') => {
    const mode = kind === 'media' ? state.mediaRead : state.historyRead;
    if (mode === 'loading') await new Promise((resolve) => setTimeout(resolve, 700));
    if (mode === 'error') {
      return json(route, { error: 'P9_INTERNAL_ERROR', retryable: false, message: `${kind} read failed` }, 500);
    }
    if (kind === 'media') {
      return json(route, mediaResult({ inventoryId, media: state.media, pendingReplacements: state.pending }));
    }
    return json(route, {
      contractVersion: 'phase9-store-view-history-v1',
      data: { inventoryId, ...state.history },
    });
  };

  await page.route('https://upload.example.test/**', (route) => json(route, {}));
  await page.route('https://ahntbtktjjmvfosgkmgn.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/auth/v1/otp') return json(route, {});
    if (url.pathname === '/auth/v1/verify' || url.pathname === '/auth/v1/token') {
      return json(route, {
        access_token: 'store-view-wu4-token', refresh_token: 'store-view-wu4-refresh',
        expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer', user: {
          id: userId, email: 'owner@example.test', phone: '+911234567890',
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {},
        },
      });
    }
    if (url.pathname === '/auth/v1/user') return json(route, { id: userId, email: 'owner@example.test', phone: '+911234567890', created_at: createdAt, updated_at: createdAt, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} });
    if (url.pathname.startsWith('/rest/v1/user_profiles')) return json(route, { id: 'profile-1', user_id: userId, display_name: 'Owner', username: 'owner', avatar_url: null, city: 'Bangalore', email: 'owner@example.test', referral_code: 'OWNER1', account_type: 'user', is_verified_author: false, membership_tier: 'free', trust_score: 10, created_at: createdAt, updated_at: createdAt });
    if (url.pathname.startsWith('/rest/v1/store_administrators')) return json(route, { store_id: storeId, stores: { id: storeId, display_name: 'Smoke Books', status: 'active', setup_status: 'complete', suspension_reason: null, restriction_reason: null } });
    if (url.pathname.startsWith('/rest/v1/store_verification_requests')) return json(route, { id: '00000000-0000-4000-8000-000000000040', status: 'approved', rejection_reason: null, required_follow_up: null });
    if (url.pathname !== '/functions/v1/phase9-owner-ingestion') return json(route, []);

    const body = request.postDataJSON() as Record<string, unknown>;
    const action = String(body.action ?? '');
    state.calls.push({ action, body });
    if (action === 'read_store_view_media') return respondRead(route, 'media');
    if (action === 'read_store_view_history') return respondRead(route, 'history');
    if (action === 'read_store_view_detail') return json(route, { contractVersion: 'phase9-store-view-read-v1', data: state.detail });
    if (action === 'read_store_view_page') {
      const { privateOperations: _p, stock: _s, historySummary: _h, ...pageItem } = state.detail;
      return json(route, { contractVersion: 'phase9-store-view-read-v1', data: { items: [pageItem], pageInfo: { hasNextPage: false, nextCursor: null } } });
    }
    if (state.failedCommands[action]) {
      const code = state.failedCommands[action];
      return json(route, { error: code, retryable: false, message: code === 'P9_VERSION_CONFLICT' ? 'version conflict' : 'unsafe change' }, code === 'P9_VERSION_CONFLICT' ? 409 : 422);
    }
    if (action === 'reorder_store_view_media') {
      const ordered = body.orderedLinkIds as string[];
      state.media = ordered.map((id) => state.media.find((record) => record.linkId === id)).filter(Boolean).map((record, index) => ({ ...record!, publicOrder: index + 1 }));
      return json(route, mediaResult({ inventoryId, inventoryVersion: 4, publicationIntentVersion: 2, mediaLinkIds: ordered, publicRevisionNumber: null, outcome: 'media_reordered' }));
    }
    if (action === 'remove_store_view_media') {
      state.media = state.media.filter((record) => record.linkId !== body.linkId);
      return json(route, mediaResult({ inventoryId, inventoryVersion: 4, publicationIntentVersion: 2, removedMediaAssetId: mediaAssetB, publicRevisionNumber: 3, outcome: 'media_removed' }));
    }
    if (action === 'replace_store_view_media') {
      state.media = state.media.map((record) => record.linkId === body.targetLinkId
        ? { ...record, mediaAssetId: String(body.mediaAssetId), url: `https://cdn.example.test/inventory/${record.linkId}-replacement.webp` }
        : record);
      state.pending = [];
      return json(route, mediaResult({ inventoryId, inventoryVersion: 4, publicationIntentVersion: 2, mediaLinkId: body.targetLinkId, mediaAssetId: body.mediaAssetId, removedMediaAssetId: mediaAssetB, publicRevisionNumber: 3, outcome: 'media_replaced' }));
    }
    if (action === 'authorize_public_copy') {
      state.lastAuthorize = body;
      return json(route, { contractVersion: 'phase9-publication-v1', data: { capabilityId: body.operationKind === 'add' ? capabilityAdd : capabilityReplace, signedUploadUrl: 'https://upload.example.test/signed/local', uploadToken: 'local-upload-token', expiresAt: '2026-08-15T05:00:00.000+05:30' } });
    }
    if (action === 'complete_public_copy_upload') {
      const operationKind = state.lastAuthorize?.operationKind === 'add' ? 'add' : 'replace';
      const targetLinkId = operationKind === 'replace' ? String(state.lastAuthorize?.targetLinkId) : null;
      state.pending = [{ capabilityId: String(body.capabilityId), role: (state.lastAuthorize?.role ?? 'actual_copy') as MediaRecord['role'], order: Number(state.lastAuthorize?.ordinal ?? 1), state: 'processing', operationKind, targetLinkId, sourceMediaAssetId: mediaAssetUpload, mediaAssetId: mediaAssetUpload, safeErrorCode: null }];
      return json(route, { contractVersion: 'phase9-publication-v1', data: { mediaAssetId: mediaAssetUpload, state: 'processing' } });
    }
    if (action === 'read_public_copy_status') {
      const next = state.statusSequence.length ? state.statusSequence.shift()! : 'processing';
      if (next === 'failed') state.pending = state.pending.map((item) => ({ ...item, state: 'failed', safeErrorCode: 'P9_MEDIA_NOT_APPROVED' }));
      if (next === 'approved') state.pending = state.pending.map((item) => ({ ...item, state: 'approved' }));
      return json(route, { contractVersion: 'phase9-publication-v1', data: { mediaAssetId: mediaAssetUpload, state: next } });
    }
    if (action === 'submit_public_copy_media') {
      const order = Number(body.publicOrder);
      state.media = [...state.media, { ...makeMediaRecord(linkC, body.role as MediaRecord['role'], order), mediaAssetId: String(body.mediaAssetId) }];
      state.pending = [];
      return json(route, { contractVersion: 'phase9-publication-v1', data: { mediaLinkId: linkC } });
    }
    if (action === 'set_publication_state' || action === 'retry_publication') {
      const intent = action === 'retry_publication' ? 'publish' : body.intent;
      const next = intent === 'pause' ? 'paused' : intent === 'private' ? 'private' : 'live';
      state.detail.lifecycle = { publicationState: next === 'private' ? 'private' : 'published', effectiveState: next, visibilityStatus: next === 'live' ? 'published' : next === 'private' ? 'draft' : 'paused' };
      state.detail.capabilities = next === 'live' ? ['edit_details', 'adjust_stock', 'manage_photos', 'pause', 'make_private'] : next === 'paused' ? ['edit_details', 'adjust_stock', 'manage_photos', 'republish', 'make_private'] : ['edit_details', 'adjust_stock', 'manage_photos', 'publish'];
      return json(route, { contractVersion: 'phase9-publication-v1', data: publicationResult(state, next === 'paused' ? 'paused' : next === 'private' ? 'private' : 'published') });
    }
    if (action === 'update_store_inventory_details' || action === 'adjust_inventory_stock') {
      return json(route, { contractVersion: 'phase9-store-view-management-v1', data: { inventoryId, inventoryVersion: 4, publicationIntentVersion: 2, publicRevisionNumber: null, outcome: action === 'adjust_inventory_stock' ? 'stock_adjusted' : 'details_updated' } });
    }
    return json(route, []);
  });
  return state;
}

export async function loginAsOwner(page: Page) {
  await page.goto('/login');
  await page.getByTestId('login-phone-input').fill('1234567890');
  await page.getByTestId('login-continue-button').click();
  await page.getByTestId('verify-otp-input').fill('123456');
  await page.getByTestId('verify-otp-button').click();
}
