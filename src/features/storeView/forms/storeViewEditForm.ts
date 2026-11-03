import type { StoreViewDetail } from '../contracts/storeViewContracts';
import type { StoreViewChanges } from '../contracts/storeViewManagementContracts';
import { rupeesToPriceMinor } from '@/features/imageInventory/scanSetup/scanSetupForm';

type DamageType = NonNullable<StoreViewChanges['damageTypes']>[number];
type Condition = NonNullable<StoreViewChanges['condition']>;

export type StoreViewEditDraft = {
    title: string;
    authors: string;
    language: string;
    publicDescription: string;
    /** Rupee entry text; the API field retains its paise name. */
    sellingPriceMinor: string;
    condition: Condition;
    publicConditionNote: string;
    hasDamage: boolean;
    damageTypes: DamageType[];
    damageNote: string;
    isSellable: boolean;
    shelfLocation: string;
    internalNotes: string;
};

const languagePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;
const integerPattern = /^(?:0|[1-9]\d*)$/u;

export function priceMinorToRupees(price: number): string {
    const rupees = Math.floor(price / 100);
    const paise = price % 100;
    return paise ? `${rupees}.${String(paise).padStart(2, '0')}` : String(rupees);
}

function nullable(value: string): string | null {
    return value.trim() || null;
}

function authors(value: string): string[] {
    return value.split(',').map((author) => author.trim()).filter(Boolean);
}

export function createStoreViewEditDraft(detail: StoreViewDetail): StoreViewEditDraft {
    return {
        title: detail.presentation.title,
        authors: detail.presentation.authors.join(', '),
        language: detail.presentation.language ?? '',
        publicDescription: detail.presentation.publicDescription ?? '',
        sellingPriceMinor: priceMinorToRupees(detail.presentation.sellingPriceMinor),
        condition: detail.presentation.condition,
        publicConditionNote: detail.presentation.publicConditionNote ?? '',
        hasDamage: detail.presentation.hasDamage,
        damageTypes: [...detail.presentation.damageTypes] as DamageType[],
        damageNote: detail.presentation.damageNote ?? '',
        isSellable: detail.presentation.isSellable,
        shelfLocation: detail.privateOperations.shelfLocation ?? '',
        internalNotes: detail.privateOperations.internalNotes ?? '',
    };
}

export function validateStoreViewEditDraft(
    draft: StoreViewEditDraft,
    editedSet?: ReadonlySet<StoreViewEditField>,
): string | null {
    const parsedAuthors = authors(draft.authors);
    if (!draft.title.trim() || draft.title.trim().length > 512) return 'Enter a title up to 512 characters.';
    if (parsedAuthors.length > 20 || parsedAuthors.some((author) => author.length > 256)) {
        return 'Enter at most 20 authors, separated by commas.';
    }
    // Checked even when language was not edited: the save RPC validates the
    // whole proposed row, so a book with no language cannot be saved at all
    // until one is entered (migration 20260816000046, `language IS NULL`).
    if (!languagePattern.test(draft.language.trim().replaceAll('_', '-'))) {
        return 'Enter a valid language code, such as en or hi-Latn.';
    }
    if ((!editedSet || editedSet.has('sellingPriceMinor'))
        && (!integerPattern.test(draft.sellingPriceMinor)
            || rupeesToPriceMinor(Number(draft.sellingPriceMinor)) === null)) {
        return 'Enter the price in whole rupees, for example 250.';
    }
    if (draft.publicDescription.trim().length > 5_000) return 'Public description is too long.';
    if (draft.publicConditionNote.trim().length > 1_000) return 'Public condition note is too long.';
    if (draft.shelfLocation.trim().length > 120) return 'Shelf / location is too long.';
    if (draft.internalNotes.trim().length > 1_000) return 'Internal notes are too long.';
    if (draft.hasDamage && draft.damageTypes.length === 0) return 'Choose at least one damage type.';
    if (draft.hasDamage && !draft.damageNote.trim()) return 'Describe the damage.';
    if (draft.damageNote.trim().length > 1_000) return 'Damage note is too long.';
    return null;
}

/**
 * Server normalization mirrored from the save RPC
 * (`supabase/migrations/20260816000046...`, roughly lines 40-120).
 * "Equals" always compares these normalized values, so whitespace-only
 * differences are already saved and never sent:
 * - title: `btrim` (spaces only)
 * - authors: per-element `btrim`, order preserved; the client drops empty
 *   entries before sending, so the server never receives them
 * - language: `btrim`, then every `_` becomes `-`
 * - publicDescription: `nullif(btrim(v), '')`
 * - sellingPriceMinor: whole rupees convert to integer paise before sending
 * - condition: sent as-is
 * - publicConditionNote: `nullif(btrim(v), '')`
 * - hasDamage: boolean; when false the server clears damageTypes to `[]`
 *   and damageNote to NULL
 * - damageTypes: order preserved, no trimming
 * - damageNote: `nullif(btrim(v), '')`
 * - isSellable: sent as-is
 * - shelfLocation: `nullif(btrim(v), '')`
 * - internalNotes: `nullif(btrim(v), '')`
 */
function btrimLike(value: string): string {
    return value.replace(/^ +| +$/g, '');
}

function nullableNormalized(value: string): string | null {
    const trimmed = btrimLike(value);
    return trimmed === '' ? null : trimmed;
}

function normalizedAuthors(value: string): string[] {
    return value.split(',').map((author) => btrimLike(author)).filter(Boolean);
}

/**
 * R1: authors containing commas. The draft is plain text but the stored
 * value is an array, so a naive parse-and-compare treats `["Doe, Jane"]`
 * as edited on open. The original author array is kept in the baseline;
 * authors count as edited only when the owner changes this field's text.
 * Until then nothing is sent for authors and the comparison is against
 * the original array (trivially equal).
 */
export function baselineAuthorsText(baseline: StoreViewDetail): string {
    return baseline.presentation.authors.join(', ');
}

export function isAuthorsTextEdited(baseline: StoreViewDetail, draft: StoreViewEditDraft): boolean {
    return draft.authors !== baselineAuthorsText(baseline);
}

export const STORE_VIEW_EDIT_FIELDS = [
    'title', 'authors', 'language', 'publicDescription', 'sellingPriceMinor',
    'condition', 'publicConditionNote', 'hasDamage', 'damageTypes',
    'damageNote', 'isSellable', 'shelfLocation', 'internalNotes',
] as const;

export type StoreViewEditField = (typeof STORE_VIEW_EDIT_FIELDS)[number];

/** The damage fields are one group: editing any of them sends all three. */
export const STORE_VIEW_DAMAGE_GROUP: ReadonlyArray<StoreViewEditField> = [
    'hasDamage', 'damageTypes', 'damageNote',
];

/** Normalized draft value for one field, matching what the save RPC stores. */
export function normalizeEditField(field: StoreViewEditField, draft: StoreViewEditDraft): unknown {
    switch (field) {
        case 'title': return btrimLike(draft.title);
        case 'authors': return normalizedAuthors(draft.authors);
        case 'language': return btrimLike(draft.language).replaceAll('_', '-');
        case 'publicDescription': return nullableNormalized(draft.publicDescription);
        case 'sellingPriceMinor': {
            // Exact prefilled paise comparison, without floating-point multiplication.
            const match = /^(0|[1-9][0-9]*)(?:\.([0-9]{2}))?$/.exec(draft.sellingPriceMinor);
            if (!match) return null;
            return match[2] === undefined
                ? rupeesToPriceMinor(Number(match[1]))
                : Number(match[1]) * 100 + Number(match[2]);
        }
        case 'condition': return draft.condition;
        case 'publicConditionNote': return nullableNormalized(draft.publicConditionNote);
        case 'hasDamage': return draft.hasDamage;
        case 'damageTypes': return draft.hasDamage ? [...draft.damageTypes] : [];
        case 'damageNote': return draft.hasDamage ? nullableNormalized(draft.damageNote) : null;
        case 'isSellable': return draft.isSellable;
        case 'shelfLocation': return nullableNormalized(draft.shelfLocation);
        case 'internalNotes': return nullableNormalized(draft.internalNotes);
    }
}

/** Raw stored value for one field, read from a detail response. */
export function readDetailField(detail: StoreViewDetail, field: StoreViewEditField): unknown {
    switch (field) {
        case 'title': return detail.presentation.title;
        case 'authors': return detail.presentation.authors;
        case 'language': return detail.presentation.language;
        case 'publicDescription': return detail.presentation.publicDescription;
        case 'sellingPriceMinor': return detail.presentation.sellingPriceMinor;
        case 'condition': return detail.presentation.condition;
        case 'publicConditionNote': return detail.presentation.publicConditionNote;
        case 'hasDamage': return detail.presentation.hasDamage;
        case 'damageTypes': return detail.presentation.damageTypes;
        case 'damageNote': return detail.presentation.damageNote;
        case 'isSellable': return detail.presentation.isSellable;
        case 'shelfLocation': return detail.privateOperations.shelfLocation;
        case 'internalNotes': return detail.privateOperations.internalNotes;
    }
}

/** Server-normalized equality between a stored value and a draft value. */
export function editFieldEquals(field: StoreViewEditField, detail: StoreViewDetail, draft: StoreViewEditDraft): boolean {
    // R1: authors compare by field text against the original array's text.
    if (field === 'authors') return !isAuthorsTextEdited(detail, draft);
    if (field === 'sellingPriceMinor') return draft.sellingPriceMinor === priceMinorToRupees(detail.presentation.sellingPriceMinor);
    return JSON.stringify(readDetailField(detail, field))
        === JSON.stringify(normalizeEditField(field, draft));
}

/**
 * The edited set: a field joins when the owner changes it away from the
 * baseline and leaves only if put back to the baseline value. Damage fields
 * expand to the whole group when any member is edited.
 */
export function computeEditedSet(
    baseline: StoreViewDetail,
    draft: StoreViewEditDraft,
): Set<StoreViewEditField> {
    const edited = new Set<StoreViewEditField>();
    for (const field of STORE_VIEW_EDIT_FIELDS) {
        if (!editFieldEquals(field, baseline, draft)) edited.add(field);
    }
    // Group rule: editing any damage member marks the whole group.
    if (STORE_VIEW_DAMAGE_GROUP.some((field) => edited.has(field))) {
        for (const field of STORE_VIEW_DAMAGE_GROUP) edited.add(field);
    }
    return edited;
}

/** Display string for one field, rebuilt from a refreshed detail. */
export function draftFieldFromDetail(detail: StoreViewDetail, field: StoreViewEditField): string | boolean | string[] {
    switch (field) {
        case 'authors': return detail.presentation.authors.join(', ');
        case 'sellingPriceMinor': return priceMinorToRupees(detail.presentation.sellingPriceMinor);
        case 'language': return detail.presentation.language ?? '';
        case 'publicDescription': return detail.presentation.publicDescription ?? '';
        case 'publicConditionNote': return detail.presentation.publicConditionNote ?? '';
        case 'damageNote': return detail.presentation.damageNote ?? '';
        case 'shelfLocation': return detail.privateOperations.shelfLocation ?? '';
        case 'internalNotes': return detail.privateOperations.internalNotes ?? '';
        case 'title': return detail.presentation.title;
        case 'condition': return detail.presentation.condition;
        case 'hasDamage': return detail.presentation.hasDamage;
        case 'damageTypes': return [...detail.presentation.damageTypes];
        case 'isSellable': return detail.presentation.isSellable;
    }
}

/** Sends only the edited set (damage-group expanded) against the baseline. */
export function buildEditedChanges(
    baseline: StoreViewDetail,
    draft: StoreViewEditDraft,
    editedSet: ReadonlySet<StoreViewEditField>,
): StoreViewChanges {
    const changes: StoreViewChanges = {};
    const send = (STORE_VIEW_DAMAGE_GROUP.some((field) => editedSet.has(field))
        ? new Set([...editedSet, ...STORE_VIEW_DAMAGE_GROUP])
        : editedSet);
    for (const field of STORE_VIEW_EDIT_FIELDS) {
        if (!send.has(field)) continue;
        Object.assign(changes, { [field]: normalizeEditField(field, draft) });
    }
    return changes;
}

export function buildStoreViewChanges(
    detail: StoreViewDetail,
    draft: StoreViewEditDraft,
): StoreViewChanges {
    return buildEditedChanges(detail, draft, computeEditedSet(detail, draft));
}
