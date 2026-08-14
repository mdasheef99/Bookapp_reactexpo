import { supabase } from '@/lib/supabase';
import { timestampSchema } from '../contracts/ownerUxCommonSchemas';

export const OWNER_INVENTORY_RPC_NAME = 'phase9_owner_inventory_page_v2';
export const OWNER_INVENTORY_CONTRACT_VERSION = 'phase9-owner-inventory-v2';
export const OWNER_INVENTORY_DEFAULT_PAGE_SIZE = 25;
export const OWNER_INVENTORY_MAX_PAGE_SIZE = 50;

const CONDITIONS = ['new', 'like_new', 'very_good', 'good', 'acceptable'] as const;
const VISIBILITY_STATUSES = [
    'draft',
    'needs_review',
    'published',
    'paused',
    'out_of_stock',
    'blocked',
] as const;
const QUANTITY_STATES = ['available', 'low_stock', 'out_of_stock'] as const;
const ENTRY_METHODS = ['manual', 'image_extraction', 'metadata_import'] as const;
const DATE_ADDED_FILTERS = ['last_7_days', 'last_30_days'] as const;
const PUBLICATION_STATUSES = ['private', 'published', 'paused', 'publication_failed'] as const;
const LISTING_QUALITY_STATUSES = [
    'ready',
    'missing_price',
    'missing_condition',
    'missing_metadata',
    'low_confidence_match',
    'needs_photo',
    'blocked',
] as const;

export type OwnerInventoryCondition = typeof CONDITIONS[number];
export type OwnerInventoryVisibilityStatus = typeof VISIBILITY_STATUSES[number];
export type OwnerInventoryQuantityState = typeof QUANTITY_STATES[number];
export type OwnerInventoryEntryMethod = typeof ENTRY_METHODS[number];
export type OwnerInventoryDateAdded = typeof DATE_ADDED_FILTERS[number];
export type OwnerInventoryPublicationStatus = typeof PUBLICATION_STATUSES[number];
export type OwnerInventoryListingQualityStatus = typeof LISTING_QUALITY_STATUSES[number];

export type OwnerInventoryFilters = Readonly<{
    query?: string;
    condition?: OwnerInventoryCondition | 'all';
    visibilityStatus?: OwnerInventoryVisibilityStatus | 'all';
    quantityState?: OwnerInventoryQuantityState | 'all';
    entryMethod?: OwnerInventoryEntryMethod | 'all';
    dateAdded?: OwnerInventoryDateAdded | 'all';
    publicationStatus?: OwnerInventoryPublicationStatus | 'all';
}>;

export type OwnerInventoryPageRequest = Readonly<{
    pageSize?: number;
    cursor?: string | null;
    filters?: OwnerInventoryFilters;
}>;

export type OwnerInventoryListItem = Readonly<{
    id: string;
    title: string;
    authors: string[] | null;
    isbn10: string | null;
    isbn13: string | null;
    condition: OwnerInventoryCondition;
    quantityAvailable: number;
    sellingPriceMinor: number;
    visibilityStatus: OwnerInventoryVisibilityStatus;
    listingQualityStatus: OwnerInventoryListingQualityStatus;
    publicNotes: string | null;
    shelfLocation: string | null;
    entryMethod: OwnerInventoryEntryMethod;
    createdAt: string;
    updatedAt: string;
    version: number;
    publicationStatus: 'private' | 'publication_pending' | 'published' | 'publication_failed';
    publicationIntentVersion: number;
    publicationRetryable: boolean;
    publicationFailureReason: 'projection_temporarily_unavailable' | null;
    publicListingStatus: 'active' | 'paused' | 'out_of_stock' | 'blocked' | null;
}>;

export type OwnerInventoryPage = Readonly<{
    contractVersion: typeof OWNER_INVENTORY_CONTRACT_VERSION;
    items: OwnerInventoryListItem[];
    pageInfo: Readonly<{
        nextCursor: string | null;
        hasMore: boolean;
    }>;
}>;

export type OwnerInventoryReadErrorCategory =
    | 'unauthorized'
    | 'invalid_request'
    | 'invalid_cursor'
    | 'unavailable'
    | 'internal';

export type OwnerInventoryReadErrorCode =
    | 'P9_AUTH_REQUIRED'
    | 'P9_OWNER_NOT_AUTHORIZED'
    | 'P9_REQUEST_INVALID'
    | 'P9_CURSOR_INVALID'
    | 'P9_INTERNAL_ERROR'
    | 'P9_RESPONSE_INVALID'
    | 'P9_UNAVAILABLE';

const SAFE_MESSAGES: Record<OwnerInventoryReadErrorCategory, string> = {
    unauthorized: 'Active Store Owner access is required.',
    invalid_request: 'The inventory request is invalid.',
    invalid_cursor: 'The inventory page cursor is no longer valid.',
    unavailable: 'Inventory is temporarily unavailable.',
    internal: 'Inventory could not be loaded.',
};

export class OwnerInventoryReadError extends Error {
    readonly category: OwnerInventoryReadErrorCategory;
    readonly code: OwnerInventoryReadErrorCode;
    readonly retryable: boolean;

    constructor(input: {
        category: OwnerInventoryReadErrorCategory;
        code: OwnerInventoryReadErrorCode;
        retryable: boolean;
    }) {
        super(SAFE_MESSAGES[input.category]);
        this.name = 'OwnerInventoryReadError';
        this.category = input.category;
        this.code = input.code;
        this.retryable = input.retryable;
    }
}

type RpcArguments = {
    p_page_size: number;
    p_cursor: string | null;
    p_query: string | null;
    p_condition: OwnerInventoryCondition | null;
    p_visibility_status: OwnerInventoryVisibilityStatus | null;
    p_quantity_state: OwnerInventoryQuantityState | null;
    p_entry_method: OwnerInventoryEntryMethod | null;
    p_date_added: OwnerInventoryDateAdded | null;
    p_publication_status: OwnerInventoryPublicationStatus | null;
};

const ITEM_KEYS = [
    'id', 'title', 'authors', 'isbn10', 'isbn13', 'condition',
    'quantityAvailable', 'sellingPriceMinor', 'visibilityStatus',
    'listingQualityStatus', 'publicNotes', 'entryMethod', 'createdAt', 'updatedAt',
    'inventoryVersion', 'publicationStatus', 'publicationIntentVersion',
    'publicationRetryable', 'publicationFailureReason', 'publicListingStatus',
] as const;

function invalidRequest(): never {
    throw new OwnerInventoryReadError({
        category: 'invalid_request',
        code: 'P9_REQUEST_INVALID',
        retryable: false,
    });
}

function invalidResponse(): never {
    throw new OwnerInventoryReadError({
        category: 'internal',
        code: 'P9_RESPONSE_INVALID',
        retryable: false,
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
    const actual = Object.keys(value).sort();
    return actual.length === expected.length
        && actual.every((key, index) => key === [...expected].sort()[index]);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
    return typeof value === 'string' && allowed.includes(value as T);
}

function isNullableString(value: unknown): value is string | null {
    return value === null || typeof value === 'string';
}

function isTimestamp(value: unknown): value is string {
    return timestampSchema.safeParse(value).success;
}

function isUuid(value: unknown): value is string {
    return typeof value === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function decodeItem(value: unknown): OwnerInventoryListItem {
    if (!isRecord(value) || !hasExactKeys(value, ITEM_KEYS)) invalidResponse();
    if (!isUuid(value.id) || typeof value.title !== 'string') invalidResponse();
    if (!(value.authors === null || (Array.isArray(value.authors) && value.authors.every((author) => typeof author === 'string')))) invalidResponse();
    if (!isNullableString(value.isbn10) || !isNullableString(value.isbn13)) invalidResponse();
    if (!isOneOf(value.condition, CONDITIONS)) invalidResponse();
    if (!Number.isInteger(value.quantityAvailable) || (value.quantityAvailable as number) < 0) invalidResponse();
    if (!Number.isInteger(value.sellingPriceMinor) || (value.sellingPriceMinor as number) < 0) invalidResponse();
    if (!isOneOf(value.visibilityStatus, VISIBILITY_STATUSES)) invalidResponse();
    if (!isOneOf(value.listingQualityStatus, LISTING_QUALITY_STATUSES)) invalidResponse();
    if (!isNullableString(value.publicNotes) || !isOneOf(value.entryMethod, ENTRY_METHODS)) invalidResponse();
    if (!isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)) invalidResponse();
    if (!Number.isInteger(value.inventoryVersion) || (value.inventoryVersion as number) <= 0) invalidResponse();
    if (!isOneOf(value.publicationStatus, ['private','publication_pending','published','publication_failed'] as const)) invalidResponse();
    if (!Number.isInteger(value.publicationIntentVersion) || (value.publicationIntentVersion as number) <= 0) invalidResponse();
    if (typeof value.publicationRetryable !== 'boolean') invalidResponse();
    if (!(value.publicationFailureReason === null || value.publicationFailureReason === 'projection_temporarily_unavailable')) invalidResponse();
    if (!(value.publicListingStatus === null || isOneOf(value.publicListingStatus, ['active','paused','out_of_stock','blocked'] as const))) invalidResponse();

    return {
        id: value.id,
        title: value.title,
        authors: value.authors as string[] | null,
        isbn10: value.isbn10,
        isbn13: value.isbn13,
        condition: value.condition,
        quantityAvailable: value.quantityAvailable as number,
        sellingPriceMinor: value.sellingPriceMinor as number,
        visibilityStatus: value.visibilityStatus,
        listingQualityStatus: value.listingQualityStatus,
        publicNotes: value.publicNotes,
        shelfLocation: null,
        entryMethod: value.entryMethod,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
        version: value.inventoryVersion as number,
        publicationStatus: value.publicationStatus,
        publicationIntentVersion: value.publicationIntentVersion as number,
        publicationRetryable: value.publicationRetryable,
        publicationFailureReason: value.publicationFailureReason,
        publicListingStatus: value.publicListingStatus,
    };
}

function decodePage(value: unknown): OwnerInventoryPage {
    if (!isRecord(value) || !hasExactKeys(value, ['contractVersion', 'items', 'pageInfo'])) invalidResponse();
    if (value.contractVersion !== OWNER_INVENTORY_CONTRACT_VERSION || !Array.isArray(value.items)) invalidResponse();
    if (!isRecord(value.pageInfo) || !hasExactKeys(value.pageInfo, ['nextCursor', 'hasMore'])) invalidResponse();
    const { hasMore, nextCursor } = value.pageInfo;
    if (typeof hasMore !== 'boolean') invalidResponse();
    if (hasMore ? typeof nextCursor !== 'string' || nextCursor.length === 0 : nextCursor !== null) invalidResponse();
    return {
        contractVersion: OWNER_INVENTORY_CONTRACT_VERSION,
        items: value.items.map(decodeItem),
        pageInfo: { hasMore, nextCursor: nextCursor as string | null },
    };
}

function normalizeCategory<T extends string>(value: unknown, allowed: readonly T[]): T | null {
    if (value === undefined || value === null || value === '' || value === 'all') return null;
    if (typeof value !== 'string') return invalidRequest();
    const normalized = value.trim();
    if (!isOneOf(normalized, allowed)) return invalidRequest();
    return normalized;
}

function toRpcArguments(request: OwnerInventoryPageRequest): RpcArguments {
    const pageSize = request.pageSize === undefined
        ? OWNER_INVENTORY_DEFAULT_PAGE_SIZE
        : request.pageSize;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > OWNER_INVENTORY_MAX_PAGE_SIZE) invalidRequest();
    if (!(request.cursor === undefined || request.cursor === null || (typeof request.cursor === 'string' && request.cursor.length > 0))) invalidRequest();
    const filters = request.filters ?? {};
    if (!isRecord(filters)) invalidRequest();
    if (!(filters.query === undefined || filters.query === null || typeof filters.query === 'string')) invalidRequest();
    const query = typeof filters.query === 'string' ? filters.query.trim() : '';
    if (query.length > 100) invalidRequest();

    return {
        p_page_size: pageSize,
        p_cursor: request.cursor ?? null,
        p_query: query || null,
        p_condition: normalizeCategory(filters.condition, CONDITIONS),
        p_visibility_status: normalizeCategory(filters.visibilityStatus, VISIBILITY_STATUSES),
        p_quantity_state: normalizeCategory(filters.quantityState, QUANTITY_STATES),
        p_entry_method: normalizeCategory(filters.entryMethod, ENTRY_METHODS),
        p_date_added: normalizeCategory(filters.dateAdded, DATE_ADDED_FILTERS),
        p_publication_status: normalizeCategory(filters.publicationStatus, PUBLICATION_STATUSES),
    };
}

const KNOWN_CODES = [
    'P9_AUTH_REQUIRED',
    'P9_OWNER_NOT_AUTHORIZED',
    'P9_REQUEST_INVALID',
    'P9_CURSOR_INVALID',
    'P9_INTERNAL_ERROR',
] as const;

function errorText(error: unknown): string {
    if (error instanceof Error) return `${error.name} ${error.message}`;
    if (!isRecord(error)) return String(error ?? '');
    return ['code', 'message', 'details', 'hint']
        .map((key) => error[key])
        .filter((value): value is string => typeof value === 'string')
        .join(' ');
}

function translateError(error: unknown): OwnerInventoryReadError {
    const text = errorText(error);
    const code = KNOWN_CODES.find((candidate) => text.includes(candidate));
    if (code === 'P9_AUTH_REQUIRED' || code === 'P9_OWNER_NOT_AUTHORIZED') {
        return new OwnerInventoryReadError({ category: 'unauthorized', code, retryable: false });
    }
    if (code === 'P9_REQUEST_INVALID') {
        return new OwnerInventoryReadError({ category: 'invalid_request', code, retryable: false });
    }
    if (code === 'P9_CURSOR_INVALID') {
        return new OwnerInventoryReadError({ category: 'invalid_cursor', code, retryable: false });
    }
    if (code === 'P9_INTERNAL_ERROR') {
        return new OwnerInventoryReadError({ category: 'internal', code, retryable: true });
    }
    if (error instanceof TypeError || /network|fetch|offline|timeout|connection/iu.test(text)) {
        return new OwnerInventoryReadError({ category: 'unavailable', code: 'P9_UNAVAILABLE', retryable: true });
    }
    return new OwnerInventoryReadError({ category: 'internal', code: 'P9_INTERNAL_ERROR', retryable: true });
}

function throwAbort(): never {
    const error = new Error('Request aborted.');
    error.name = 'AbortError';
    throw error;
}

export const ownerInventoryReadService = {
    async listPage(
        request: OwnerInventoryPageRequest = {},
        signal?: AbortSignal,
    ): Promise<OwnerInventoryPage> {
        if (signal?.aborted) throwAbort();
        const rpcRequest = supabase.rpc(OWNER_INVENTORY_RPC_NAME, toRpcArguments(request));
        const cancellable = rpcRequest as unknown as { abortSignal?: (nextSignal: AbortSignal) => unknown };
        if (signal && typeof cancellable.abortSignal === 'function') cancellable.abortSignal(signal);
        try {
            const { data, error } = await rpcRequest;
            if (signal?.aborted) throwAbort();
            if (error) throw translateError(error);
            return decodePage(data);
        } catch (error) {
            if (error instanceof OwnerInventoryReadError || (error instanceof Error && error.name === 'AbortError')) {
                throw error;
            }
            throw translateError(error);
        }
    },
};
