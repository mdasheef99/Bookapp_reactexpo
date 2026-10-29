import type { ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import type { StoreViewDetail } from '../contracts/storeViewContracts';
import {
    STORE_VIEW_DAMAGE_GROUP,
    STORE_VIEW_EDIT_FIELDS,
    draftFieldFromDetail,
    normalizeEditField,
    readDetailField,
    type StoreViewEditDraft,
    type StoreViewEditField,
} from '../forms/storeViewEditForm';

/** A refresh counts only when the refetch result itself has no error. */
export type EditRefreshResult =
    | { ok: true; detail: StoreViewDetail }
    | { ok: false; offline: boolean; code?: string | null; httpStatus?: number | null };

export const EDIT_REFRESH_TIMEOUT_MS = 15_000;

function storedEquals(field: StoreViewEditField, left: StoreViewDetail, right: StoreViewDetail): boolean {
    return JSON.stringify(readDetailField(left, field))
        === JSON.stringify(readDetailField(right, field));
}

function draftMatchesDetail(field: StoreViewEditField, draft: StoreViewEditDraft, detail: StoreViewDetail): boolean {
    return JSON.stringify(normalizeEditField(field, draft))
        === JSON.stringify(readDetailField(detail, field));
}

export type EditRebase = {
    draft: StoreViewEditDraft;
    /** Fields the owner edited that someone else also changed. */
    conflicts: StoreViewEditField[];
    /** Every edited field already equals the refreshed book. */
    alreadySaved: boolean;
};

/**
 * Rebase after a version conflict (§3.2). Untouched fields take the refreshed
 * values; edited-but-remotely-unchanged fields keep the owner's values;
 * edited-and-remotely-changed fields are marked (damage group: any member
 * changed remotely marks the whole group). The baseline becomes the
 * refreshed book; the edited set is unchanged.
 */
export function rebaseEditDraft(args: {
    draft: StoreViewEditDraft;
    editedSet: ReadonlySet<StoreViewEditField>;
    refreshed: StoreViewDetail;
    baseline: StoreViewDetail;
}): EditRebase {
    const { draft, editedSet, refreshed, baseline } = args;
    const groupEdited = STORE_VIEW_DAMAGE_GROUP.some((field) => editedSet.has(field));
    const groupRemoteChanged = STORE_VIEW_DAMAGE_GROUP.some(
        (field) => !storedEquals(field, baseline, refreshed),
    );
    const next: StoreViewEditDraft = { ...draft };
    const conflicts: StoreViewEditField[] = [];
    for (const field of STORE_VIEW_EDIT_FIELDS) {
        const inGroup = (STORE_VIEW_DAMAGE_GROUP as readonly string[]).includes(field);
        const edited = inGroup ? groupEdited : editedSet.has(field);
        if (!edited) {
            Object.assign(next, { [field]: draftFieldFromDetail(refreshed, field) });
            continue;
        }
        const remoteChanged = inGroup ? groupRemoteChanged : !storedEquals(field, baseline, refreshed);
        if (remoteChanged) conflicts.push(field);
    }
    const alreadySaved = [...editedSet].every((field) => draftMatchesDetail(field, draft, refreshed))
        && (groupEdited
            ? STORE_VIEW_DAMAGE_GROUP.every((field) => draftMatchesDetail(field, draft, refreshed))
            : true);
    return { draft: next, conflicts, alreadySaved };
}

/** Owner picks keep-mine or use-theirs for one conflicted field. */
export function resolveEditConflict(args: {
    draft: StoreViewEditDraft;
    refreshed: StoreViewDetail;
    field: StoreViewEditField;
    choice: 'mine' | 'theirs';
}): StoreViewEditDraft {
    const { draft, refreshed, field, choice } = args;
    if (choice === 'mine') return draft;
    if ((STORE_VIEW_DAMAGE_GROUP as readonly string[]).includes(field)) {
        return {
            ...draft,
            hasDamage: refreshed.presentation.hasDamage,
            damageTypes: [...refreshed.presentation.damageTypes] as StoreViewEditDraft['damageTypes'],
            damageNote: refreshed.presentation.damageNote ?? '',
        };
    }
    return { ...draft, [field]: draftFieldFromDetail(refreshed, field) };
}

/** Human-readable remote value shown next to a conflicted field. */
export function remoteFieldLabel(field: StoreViewEditField, refreshed: StoreViewDetail): string {
    const value = readDetailField(refreshed, field);
    if (value === null) return 'empty';
    if (Array.isArray(value)) return value.length ? value.join(', ') : 'empty';
    if (typeof value === 'boolean') return value ? 'yes' : 'no';
    return String(value);
}

export const ACCESS_LOST_ERROR_CODES = [
    'P9_AUTH_REQUIRED',
    'P9_OWNER_NOT_AUTHORIZED',
    'P9_NOT_FOUND',
] as const;

/** Access is lost on those codes, on HTTP 401/403, or on identity change. */
export function isEditAccessLost(args: {
    code?: string | null;
    httpStatus?: number | null;
    identityChanged?: boolean;
}): boolean {
    if (args.identityChanged) return true;
    if (args.httpStatus === 401 || args.httpStatus === 403) return true;
    return !!args.code && (ACCESS_LOST_ERROR_CODES as readonly string[]).includes(args.code);
}

/** Identity changed when the signed-in user or store differs from open time. */
export function editIdentityChanged(
    baseline: ImageInventoryIdentity,
    current: ImageInventoryIdentity,
): boolean {
    return baseline.userId !== current.userId || baseline.storeId !== current.storeId;
}

/**
 * Runs a detail refresh for conflict recovery (§3.2): offline or a refresh
 * that hasn't finished within 15 seconds is a temporary failure. A refresh
 * that completes later is still accepted through `onLate`.
 */
/** Picks the error code / HTTP status off a thrown refresh failure, if any. */
export function editRefreshFailureFields(error: unknown): {
    code?: string | null;
    httpStatus?: number | null;
} {
    if (!error || typeof error !== 'object') return {};
    const code = (error as { code?: unknown }).code;
    const httpStatus = (error as { httpStatus?: unknown }).httpStatus;
    const out: { code?: string | null; httpStatus?: number | null } = {};
    if (typeof code === 'string') out.code = code;
    if (typeof httpStatus === 'number' && Number.isInteger(httpStatus)) out.httpStatus = httpStatus;
    return out;
}

export async function refreshEditBaseline(args: {
    isOnline: boolean;
    refresh: () => Promise<StoreViewDetail>;
    onLate?: (detail: StoreViewDetail) => void;
    /** R9: a failure that lands after the timeout is reported here instead of being swallowed. */
    onLateFailure?: (failure: { ok: false; offline: boolean; code?: string | null; httpStatus?: number | null }) => void;
    timeoutMs?: number;
}): Promise<EditRefreshResult> {
    if (!args.isOnline) return { ok: false, offline: true };
    const timeoutMs = args.timeoutMs ?? EDIT_REFRESH_TIMEOUT_MS;
    let late = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    const timer = new Promise<EditRefreshResult>((resolve) => {
        timerId = setTimeout(() => {
            late = true;
            // R17: a 15s stall shows "You're offline. Your edits are kept."
            resolve({ ok: false, offline: true });
        }, timeoutMs);
    });
    const attempt = (async (): Promise<EditRefreshResult> => {
        try {
            const detail = await args.refresh();
            if (late) args.onLate?.(detail);
            return { ok: true, detail };
        } catch (error) {
            const failure: EditRefreshResult = { ok: false, offline: false, ...editRefreshFailureFields(error) };
            if (late) args.onLateFailure?.(failure);
            return failure;
        }
    })();
    try {
        return await Promise.race([attempt, timer]);
    } finally {
        if (timerId !== undefined) clearTimeout(timerId);
    }
}
