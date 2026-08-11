import type {
    OwnerCandidateDetail,
    OwnerSessionSummary,
} from '../contracts/ownerUxContracts';
import {
    ownerCandidateReviewSchema,
    type OwnerCandidateReview,
} from '../contracts/ownerUxReviewSchema';

type Condition = OwnerCandidateReview['baseCondition'];
type PublicationIntent = OwnerCandidateReview['publicationIntent'];
type DamageType = OwnerCandidateReview['damageDisclosure']['damageTypes'][number];
type DuplicateIntent = OwnerCandidateReview['duplicateIntent'];
type DuplicateAction = NonNullable<DuplicateIntent>['action'];

export type ReviewDraft = {
    originalTitle: string;
    authors: string[];
    originalLanguage: string;
    script: string;
    metadataMode: 'selected' | 'manual';
    selectionId: string | null;
    currentMetadataSelectionId: string | null;
    quantity: string;
    priceMinor: string;
    baseCondition: Condition | string;
    hasDamage: boolean;
    damageTypes: DamageType[];
    damageNote: string;
    isSellable: boolean;
    completeReadableSafe: boolean;
    shelfLocation: string;
    publicNote: string;
    internalNote: string;
    publicationIntent: PublicationIntent;
    duplicateIntent: DuplicateIntent;
    originalFieldConfirmation: {
        title: boolean;
        authors: boolean[];
    };
    duplicateAdviceVersion: number | null;
    duplicateTargetInventoryId: string | null;
    duplicateAllowedIntents: DuplicateAction[];
};

export type ReviewFieldErrors = Record<string, string>;
export type ReviewBuildResult =
    | { success: true; data: OwnerCandidateReview; errors: ReviewFieldErrors }
    | { success: false; data: null; errors: ReviewFieldErrors };

const integerPattern = /^(?:0|[1-9]\d*)$/u;

function stringValue(value: string | null): string {
    return value ?? '';
}

export function createReviewDraft(
    detail: OwnerCandidateDetail,
    defaults: OwnerSessionSummary['defaults'],
): ReviewDraft {
    const saved = detail.review.value;
    const selected = detail.metadata.state === 'selected'
        ? detail.metadata.selectionId
        : null;
    return {
        originalTitle: saved?.originalTitle ?? detail.observed.title,
        authors: [...(saved?.authors ?? detail.observed.authors)],
        originalLanguage: saved?.originalLanguage ?? detail.observed.language,
        script: saved?.script ?? detail.observed.script ?? '',
        metadataMode: saved?.metadataChoice.mode ?? (selected ? 'selected' : 'manual'),
        selectionId: saved?.metadataChoice.selectionId ?? selected,
        currentMetadataSelectionId: selected,
        quantity: String(saved?.quantity ?? defaults.quantity),
        priceMinor: saved ? String(saved.priceMinor) : '',
        baseCondition: saved?.baseCondition ?? defaults.condition,
        hasDamage: saved?.damageDisclosure.hasDamage ?? false,
        damageTypes: [...(saved?.damageDisclosure.damageTypes ?? [])],
        damageNote: stringValue(saved?.damageDisclosure.damageNote ?? null),
        isSellable: saved?.damageDisclosure.isSellable ?? true,
        completeReadableSafe: saved?.damageDisclosure.completeReadableSafe ?? true,
        shelfLocation: saved?.shelfLocation ?? defaults.location,
        publicNote: stringValue(saved?.notes.publicNote ?? null),
        internalNote: stringValue(saved?.notes.internalNote ?? null),
        publicationIntent: saved?.publicationIntent ?? defaults.publication,
        duplicateIntent: null,
        originalFieldConfirmation: saved
            ? {
                title: saved.originalFieldConfirmation.title,
                authors: [...saved.originalFieldConfirmation.authors],
            }
            : {
                title: false,
                authors: detail.observed.authors.map(() => false),
            },
        duplicateAdviceVersion: detail.duplicateAdvice.version,
        duplicateTargetInventoryId: detail.duplicateAdvice.targetInventoryId,
        duplicateAllowedIntents: [...detail.duplicateAdvice.allowedIntents],
    };
}

function localErrors(draft: ReviewDraft): ReviewFieldErrors {
    const errors: ReviewFieldErrors = {};
    if (!integerPattern.test(draft.quantity)) errors.quantity = 'Enter a whole quantity.';
    if (!integerPattern.test(draft.priceMinor)) errors.priceMinor = 'Enter a whole price in paise.';
    if (
        draft.metadataMode === 'selected'
        && draft.selectionId !== draft.currentMetadataSelectionId
    ) errors.metadataChoice = 'The matched book details changed. Choose them again or use manual details.';
    return errors;
}

function issuePath(path: PropertyKey[]): string {
    return path.length ? path.join('.') : 'form';
}

export function buildReviewInput(draft: ReviewDraft): ReviewBuildResult {
    const errors = localErrors(draft);
    const quantity = integerPattern.test(draft.quantity) ? Number(draft.quantity) : Number.NaN;
    const priceMinor = integerPattern.test(draft.priceMinor) ? Number(draft.priceMinor) : Number.NaN;
    const contamination = draft.hasDamage
        && draft.damageTypes.includes('mould_or_contamination');
    const candidate = {
        originalTitle: draft.originalTitle,
        authors: draft.authors,
        originalLanguage: draft.originalLanguage,
        script: draft.script.trim() || null,
        metadataChoice: {
            mode: draft.metadataMode,
            selectionId: draft.metadataMode === 'selected' ? draft.selectionId : null,
        },
        quantity,
        priceMinor,
        baseCondition: draft.baseCondition,
        damageDisclosure: {
            hasDamage: draft.hasDamage,
            damageTypes: draft.hasDamage ? draft.damageTypes : [],
            damageNote: draft.hasDamage ? draft.damageNote : null,
            isSellable: contamination ? false : draft.isSellable,
            completeReadableSafe: contamination ? false : draft.completeReadableSafe,
        },
        shelfLocation: draft.shelfLocation,
        notes: {
            publicNote: draft.publicNote,
            internalNote: draft.internalNote,
        },
        publicationIntent: (contamination || !draft.isSellable || !draft.completeReadableSafe)
            ? 'private'
            : draft.publicationIntent,
        duplicateIntent: null,
        originalFieldConfirmation: draft.originalFieldConfirmation,
        candidateDisposition: 'reviewed',
    };
    const parsed = ownerCandidateReviewSchema.safeParse(candidate);
    if (!parsed.success) {
        for (const issue of parsed.error.issues) {
            const path = issuePath(issue.path);
            if (!errors[path]) errors[path] = issue.message;
        }
    }
    if (Object.keys(errors).length || !parsed.success) {
        return { success: false, data: null, errors };
    }
    return { success: true, data: parsed.data, errors: {} };
}

export function reviewDraftFingerprint(draft: ReviewDraft): string {
    const {
        duplicateIntent: _duplicateIntent,
        duplicateAdviceVersion: _duplicateAdviceVersion,
        duplicateTargetInventoryId: _duplicateTargetInventoryId,
        duplicateAllowedIntents: _duplicateAllowedIntents,
        ...authoritative
    } = draft;
    return JSON.stringify(authoritative);
}

export function rebaseReviewDraft(
    draft: ReviewDraft,
    latest: OwnerCandidateDetail,
): ReviewDraft {
    return {
        ...draft,
        currentMetadataSelectionId: latest.metadata.state === 'selected'
            ? latest.metadata.selectionId
            : null,
        duplicateAdviceVersion: latest.duplicateAdvice.version,
        duplicateTargetInventoryId: latest.duplicateAdvice.targetInventoryId,
        duplicateAllowedIntents: [...latest.duplicateAdvice.allowedIntents],
    };
}
