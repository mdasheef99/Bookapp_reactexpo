import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import {
    ownerCandidateReviewSchema,
    type OwnerCandidateReview,
} from '../contracts/ownerUxReviewSchema';
import type { ScanSetupFormState } from '../scanSetup/scanSetupForm';

export type CompactReviewEdits = Omit<Partial<OwnerCandidateReview>, 'priceMinor'> & {
    priceMinor?: number | null;
};

export type CompactReviewDisplay = Readonly<{
    title: string;
    authors: string[];
    language: string;
    condition: OwnerCandidateReview['baseCondition'] | null;
    priceMinor: number | null;
    quantity: number;
    location: string;
    publication: OwnerCandidateReview['publicationIntent'];
    damage: OwnerCandidateReview['damageDisclosure'];
}>;

function identityValue<T>(
    source: string,
    saved: T | undefined,
    selected: T | undefined,
    observed: T,
    defaultValue: T,
    missingValue: T,
): T {
    if (source === 'custom') return saved ?? missingValue;
    if (source === 'matched') return selected ?? missingValue;
    if (source === 'detected') return observed;
    if (source === 'default') return defaultValue;
    return missingValue;
}

const NO_DAMAGE: OwnerCandidateReview['damageDisclosure'] = {
    hasDamage: false,
    damageTypes: [],
    damageNote: null,
    isSellable: true,
    completeReadableSafe: true,
};

export function compactReviewDisplay(
    card: OwnerBatchReviewCard,
    defaults: ScanSetupFormState,
    edits: CompactReviewEdits,
): CompactReviewDisplay {
    const title = edits.originalTitle ?? identityValue(
        card.fieldSources.title,
        card.review?.originalTitle,
        card.metadataSummary?.title,
        card.observed.title,
        '',
        '',
    );
    const authors = edits.authors ?? identityValue(
        card.fieldSources.authors,
        card.review?.authors,
        card.metadataSummary?.authors,
        card.observed.authors,
        [],
        [],
    );
    const language = edits.originalLanguage ?? identityValue(
        card.fieldSources.language,
        card.review?.originalLanguage,
        card.metadataSummary?.language,
        card.observed.language,
        defaults.languageHint,
        '',
    );
    const damage = edits.damageDisclosure ?? card.review?.damageDisclosure ?? NO_DAMAGE;
    const publication = !damage.isSellable || !damage.completeReadableSafe
        ? 'private'
        : edits.publicationIntent ?? card.review?.publicationIntent
            ?? defaults.publication;
    return {
        title,
        authors: [...authors],
        language,
        condition: edits.baseCondition ?? card.review?.baseCondition
            ?? defaults.condition ?? null,
        priceMinor: edits.priceMinor !== undefined
            ? edits.priceMinor
            : card.review?.priceMinor ?? defaults.priceMinor ?? null,
        quantity: edits.quantity ?? card.review?.quantity ?? 1,
        location: edits.shelfLocation ?? card.review?.shelfLocation
            ?? defaults.location,
        publication,
        damage,
    };
}

export function buildCompactReview(
    card: OwnerBatchReviewCard,
    defaults: ScanSetupFormState,
    edits: CompactReviewEdits,
): OwnerCandidateReview | null {
    const display = compactReviewDisplay(card, defaults, edits);
    const metadataChoice = edits.metadataChoice ?? card.review?.metadataChoice;
    const candidate = {
        originalTitle: display.title,
        authors: display.authors,
        originalLanguage: display.language,
        script: edits.script ?? card.review?.script ?? card.observed.script,
        metadataChoice,
        quantity: display.quantity,
        priceMinor: display.priceMinor,
        baseCondition: display.condition,
        damageDisclosure: display.damage,
        shelfLocation: display.location,
        notes: card.review?.notes ?? { publicNote: null, internalNote: null },
        publicationIntent: display.publication,
        duplicateIntent: null,
        // Add/Add-all is the explicit confirmation boundary for every value
        // shown on the compact card. Merely rendering/editing confirms nothing.
        originalFieldConfirmation: {
            title: true,
            authors: display.authors.map(() => true),
        },
        candidateDisposition: 'reviewed',
    };
    const parsed = ownerCandidateReviewSchema.safeParse(candidate);
    return parsed.success ? parsed.data : null;
}

export function detectedIdentityEdits(card: OwnerBatchReviewCard): CompactReviewEdits {
    return {
        originalTitle: card.observed.title,
        authors: [...card.observed.authors],
        originalLanguage: card.observed.language,
        script: card.observed.script,
        metadataChoice: { mode: 'manual', selectionId: null },
    };
}

export function manualIdentityEdits(): CompactReviewEdits {
    return { metadataChoice: { mode: 'manual', selectionId: null } };
}

export function applyCompactEdits(
    savedReview: Record<string, unknown>,
    edits: CompactReviewEdits,
): Record<string, unknown> {
    return { ...savedReview, ...edits };
}
