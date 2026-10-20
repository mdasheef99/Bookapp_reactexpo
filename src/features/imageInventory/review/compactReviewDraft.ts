export { applyCompactEditionSelection } from './editionSelectionDraft';
import type { EditionChoices } from '../contracts/ownerEditionPicker';
import { editionSelectionAuthority } from './editionSelectionDraft';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import {
    ownerCandidateReviewSchema,
    type OwnerCandidateReview,
} from '../contracts/ownerUxReviewSchema';
import type { ScanSetupFormState } from '../scanSetup/scanSetupForm';

export type CompactReviewEdits = Omit<Partial<OwnerCandidateReview>, 'priceMinor'> & {
    priceMinor?: number | null;
};

export type CompactReviewValidationIssue = Readonly<{
    field: keyof OwnerCandidateReview | 'review';
    safeMessage: string;
}>;

export type CompactReviewValidation = Readonly<{
    review: OwnerCandidateReview | null;
    issues: readonly CompactReviewValidationIssue[];
}>;

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
        card.metadataSummary?.title ?? undefined,
        card.observed.title,
        '',
        '',
    );
    const authors = edits.authors ?? identityValue(
        card.fieldSources.authors,
        card.review?.authors,
        card.metadataSummary?.authors ?? undefined,
        card.observed.authors,
        [],
        [],
    );
    const language = edits.originalLanguage ?? identityValue(
        card.fieldSources.language,
        card.review?.originalLanguage,
        card.metadataSummary?.language ?? undefined,
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

export function publicationHasEffectiveOverride(
    card: OwnerBatchReviewCard,
    defaults: ScanSetupFormState,
    edits: CompactReviewEdits,
): boolean {
    const damage = edits.damageDisclosure ?? card.review?.damageDisclosure ?? NO_DAMAGE;
    const requested = edits.publicationIntent ?? card.review?.publicationIntent
        ?? defaults.publication;
    return (!damage.isSellable || !damage.completeReadableSafe) && requested !== 'private';
}

function issueField(path: readonly PropertyKey[], message: string): CompactReviewValidationIssue['field'] {
    const first = String(path[0] ?? '');
    if (first === 'originalTitle' || message.includes('title must')) return 'originalTitle';
    if (first === 'authors' || message.includes('authors must')) return 'authors';
    if (first === 'originalLanguage' || first === 'script'
        || message.includes('language, script')) return 'originalLanguage';
    if (first === 'metadataChoice' || message.includes('metadata selection')) return 'metadataChoice';
    if (first === 'quantity') return 'quantity';
    if (first === 'priceMinor' || message.includes('positive price')) return 'priceMinor';
    if (first === 'baseCondition') return 'baseCondition';
    if (first === 'damageDisclosure' || message.includes('damage')
        || message.includes('sellable') || message.includes('unsafe')
        || message.includes('mould')) return 'damageDisclosure';
    if (first === 'shelfLocation') return 'shelfLocation';
    if (first === 'publicationIntent') return 'publicationIntent';
    return 'review';
}

function issueMessage(field: CompactReviewValidationIssue['field']): string {
    if (field === 'originalTitle') return 'Add a title.';
    if (field === 'authors') return 'Check the author names.';
    if (field === 'originalLanguage') return 'Choose a valid language.';
    if (field === 'metadataChoice') return "Choose an edition or keep the card's details.";
    if (field === 'quantity') return 'Set a quantity from 1 to 10,000.';
    if (field === 'priceMinor') return 'Set a whole-rupee selling price.';
    if (field === 'baseCondition') return 'Choose a condition.';
    if (field === 'damageDisclosure') return 'Complete the damage details.';
    if (field === 'shelfLocation') return 'Add a shelf location.';
    if (field === 'publicationIntent') return 'Choose Private or Prepare to publish.';
    return 'Check the highlighted review details.';
}

// SDD-1 §4 / D47: the same requirements gate compact drafts and all commit entry points.
export function cardAddRequirementIssues(review: {
    priceMinor?: number | null; baseCondition?: OwnerCandidateReview['baseCondition'] | null;
    quantity?: number; authors?: readonly string[];
}): CompactReviewValidationIssue[] {
    const issues: CompactReviewValidationIssue[] = [];
    if (review.priceMinor == null) issues.push({ field: 'priceMinor', safeMessage: 'Set a whole-rupee selling price.' });
    else if (review.priceMinor === 0) issues.push({ field: 'priceMinor', safeMessage: 'Enter a price above ₹0.' });
    if (!review.baseCondition) issues.push({ field: 'baseCondition', safeMessage: 'Choose a condition.' });
    if (review.quantity == null || review.quantity < 1) issues.push({ field: 'quantity', safeMessage: 'Set a quantity from 1 to 10,000.' });
    if (!review.authors?.length) issues.push({ field: 'authors', safeMessage: 'Add an author.' });
    return issues;
}

export function compactReviewScript(card: OwnerBatchReviewCard, edits: CompactReviewEdits, choices?: EditionChoices) {
    return edits.script !== undefined ? edits.script : card.review ? card.review.script
        : choices?.selection ? choices.selection.snapshot.script : card.observed.script;
}

export function compactIdentityMatches(
    identity: { title: string; authors: readonly string[]; language: string; script: string | null },
    snapshot: { title: string | null; authors: readonly string[] | null; language: string | null; script?: string | null },
): boolean {
    return identity.title === snapshot.title && JSON.stringify(identity.authors) === JSON.stringify(snapshot.authors)
        && identity.language === snapshot.language && (snapshot.script === undefined || identity.script === snapshot.script);
}

export function validateCompactReview(
    card: OwnerBatchReviewCard,
    defaults: ScanSetupFormState,
    edits: CompactReviewEdits,
    choices?: EditionChoices,
): CompactReviewValidation {
    if (choices?.lookupStatus === 'pending' || card.metadataState === 'pending') {
        return { review: null, issues: [{ field: 'metadataChoice', safeMessage: 'Finding the edition…' }] };
    }
    const display = compactReviewDisplay(card, defaults, edits);
    const resumedChoice = choices?.sessionId === card.sessionId && choices.candidateId === card.candidateId
        && choices.candidateVersion === card.candidateVersion && choices.metadataRevision === card.metadataRevision
        && choices.selection?.selectionId === card.metadataSummary?.selectionId
        && editionSelectionAuthority(choices, card.review) === 'controlled';
    const selectedMetadataChoice = card.metadataState === 'selected'
        && card.metadataSummary?.selectionId
        ? { mode: resumedChoice ? 'edition_option' as const : 'selected' as const, selectionId: card.metadataSummary.selectionId }
        : undefined;
    // C8: the selection snapshot is trusted only when the choices belong to
    // this card and name the choice that would otherwise be sent.
    const baseChoice = edits.metadataChoice ?? card.review?.metadataChoice ?? selectedMetadataChoice;
    const trustedChoices = choices?.sessionId === card.sessionId && choices.candidateId === card.candidateId
        && choices.selection?.selectionId === baseChoice?.selectionId ? choices : undefined;
    const script = compactReviewScript(card, edits, trustedChoices);
    let metadataChoice: OwnerCandidateReview['metadataChoice'];
    if (!baseChoice || baseChoice.mode === 'manual' || !baseChoice.selectionId) {
        metadataChoice = { mode: 'manual' as const, selectionId: null };
    } else if (!choices) {
        const chosen = card.metadataSummary
            ? { ...card.metadataSummary, script: card.review ? card.review.script : card.observed.script } : null;
        metadataChoice = chosen && !compactIdentityMatches({ ...display, script }, chosen)
            ? { mode: 'manual' as const, selectionId: null } : baseChoice;
    } else if (trustedChoices?.selection) {
        metadataChoice = compactIdentityMatches({ ...display, script }, trustedChoices.selection.snapshot)
            ? baseChoice : { mode: 'manual' as const, selectionId: null };
    } else {
        metadataChoice = { mode: 'manual' as const, selectionId: null };
    }
    const candidate = {
        originalTitle: display.title,
        authors: display.authors,
        originalLanguage: display.language,
        script,
        metadataChoice,
        quantity: display.quantity,
        priceMinor: display.priceMinor,
        baseCondition: display.condition,
        damageDisclosure: display.damage,
        shelfLocation: display.location,
        notes: edits.notes !== undefined ? edits.notes : card.review?.notes ?? { publicNote: null, internalNote: null },
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
    const issues = cardAddRequirementIssues(candidate);
    const fields = new Set(issues.map(issue => issue.field));
    if (!parsed.success) parsed.error.issues.forEach(issue => {
        const field = issueField(issue.path, issue.message);
        if (fields.has(field)) return;
        fields.add(field);
        issues.push({ field, safeMessage: issueMessage(field) });
    });
    return { review: parsed.success && issues.length === 0 ? parsed.data : null, issues };
}

export function buildCompactReview(
    card: OwnerBatchReviewCard,
    defaults: ScanSetupFormState,
    edits: CompactReviewEdits,
    choices?: EditionChoices,
): OwnerCandidateReview | null {
    return validateCompactReview(card, defaults, edits, choices).review;
}

export function applyCompactEdits(
    savedReview: Record<string, unknown>,
    edits: CompactReviewEdits,
): Record<string, unknown> {
    return { ...savedReview, ...edits };
}
