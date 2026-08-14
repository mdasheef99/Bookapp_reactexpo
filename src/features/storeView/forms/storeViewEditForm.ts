import type { StoreViewDetail } from '../contracts/storeViewContracts';
import type { StoreViewChanges } from '../contracts/storeViewManagementContracts';

type DamageType = NonNullable<StoreViewChanges['damageTypes']>[number];
type Condition = NonNullable<StoreViewChanges['condition']>;

export type StoreViewEditDraft = {
    title: string;
    authors: string;
    language: string;
    publicDescription: string;
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
        sellingPriceMinor: String(detail.presentation.sellingPriceMinor),
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

export function validateStoreViewEditDraft(draft: StoreViewEditDraft): string | null {
    const parsedAuthors = authors(draft.authors);
    if (!draft.title.trim() || draft.title.trim().length > 512) return 'Enter a title up to 512 characters.';
    if (parsedAuthors.length > 20 || parsedAuthors.some((author) => author.length > 256)) {
        return 'Enter at most 20 authors, separated by commas.';
    }
    if (!languagePattern.test(draft.language.trim().replaceAll('_', '-'))) {
        return 'Enter a valid language code, such as en or hi-Latn.';
    }
    if (!integerPattern.test(draft.sellingPriceMinor)
        || Number(draft.sellingPriceMinor) > 2_147_483_647) {
        return 'Enter a whole non-negative price in paise.';
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

export function buildStoreViewChanges(
    detail: StoreViewDetail,
    draft: StoreViewEditDraft,
): StoreViewChanges {
    const next = {
        title: draft.title.trim(),
        authors: authors(draft.authors),
        language: draft.language.trim().replaceAll('_', '-'),
        publicDescription: nullable(draft.publicDescription),
        sellingPriceMinor: Number(draft.sellingPriceMinor),
        condition: draft.condition,
        publicConditionNote: nullable(draft.publicConditionNote),
        hasDamage: draft.hasDamage,
        damageTypes: draft.hasDamage ? draft.damageTypes : [],
        damageNote: draft.hasDamage ? nullable(draft.damageNote) : null,
        isSellable: draft.isSellable,
        shelfLocation: nullable(draft.shelfLocation),
        internalNotes: nullable(draft.internalNotes),
    } satisfies Required<StoreViewChanges>;
    const current = {
        ...detail.presentation,
        shelfLocation: detail.privateOperations.shelfLocation,
        internalNotes: detail.privateOperations.internalNotes,
    };
    const changes: StoreViewChanges = {};
    for (const key of Object.keys(next) as (keyof typeof next)[]) {
        if (JSON.stringify(next[key]) !== JSON.stringify(current[key])) {
            Object.assign(changes, { [key]: next[key] });
        }
    }
    return changes;
}
