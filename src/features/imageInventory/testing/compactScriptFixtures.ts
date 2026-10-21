// Post-scan SDD-1 §6 / AC4-7, AC4-10: shared app/SQL test inputs, never runtime data.
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';
import { pickerCard, pickerDefaults, pickerReview } from './editionPickerClientFixtures';

export const scriptDefaults = { ...pickerDefaults, priceMinor: 100 };
export const scriptCases = [
    { name: 'Devanagari', title: 'कमल', authors: ['अमर A'], language: 'hi', expected: 'Deva' },
    { name: 'Latin-majority author', title: 'कमल', authors: ['Alexanderson'], language: 'hi', expected: 'Latn' },
    { name: 'mixed script', title: 'ಕಮಲ abc', authors: ['ಅಮರ def'], language: 'kn', expected: null },
    { name: 'Vietnamese beyond U+024F', title: 'ệộợ', authors: ['ệộợ'], language: 'en', expected: null },
    { name: 'Cyrillic in Latin', title: 'A Latin Book Ж', authors: ['Author'], language: 'en', expected: null },
    { name: 'hi-Latn', title: 'Kamal', authors: ['Amar'], language: 'hi-Latn', expected: 'Latn' },
    { name: 'en-Latn-US', title: 'Book', authors: ['Author'], language: 'en-Latn-US', expected: 'Latn' },
    { name: 'HI-latn', title: 'Kamal', authors: ['Amar'], language: 'HI-latn', expected: 'Latn' },
    { name: 'explicit script mismatch', title: 'कमल', authors: ['अमर A'], language: 'hi-Latn', expected: null },
    { name: 'Kannada', title: 'ಕಮಲ', authors: ['ಅಮರ A'], language: 'kn', expected: 'Knda' },
    { name: 'kn-IN', title: 'ಕಮಲ', authors: ['ಅಮರ A'], language: 'kn-IN', expected: 'Knda' },
    { name: 'Telugu', title: 'కమల', authors: ['అమర A'], language: 'te', expected: 'Telu' },
    { name: 'Malayalam', title: 'കമല', authors: ['അമര A'], language: 'ml', expected: 'Mlym' },
    { name: 'Tamil', title: 'கமல', authors: ['அமர A'], language: 'ta', expected: 'Taml' },
    { name: 'Arabic', title: 'كتاب', authors: ['عمر A'], language: 'ur', expected: 'Arab' },
    { name: 'observed Meetei', title: 'ꯀꯁꯂ', authors: ['ꯃꯄꯅ A'], language: 'zz', observed: 'Mtei', expected: 'Mtei' },
    { name: '60 percent boundary', title: 'abc', authors: ['ಕಮ'], language: 'kn', expected: 'Latn' },
    { name: 'below 60 percent', title: 'abc', authors: ['ಕಮಲ'], language: 'kn', expected: null },
    // U+0345 is Alphabetic but not a Letter: it must count in the server denominator.
    { name: 'Alphabetic denominator', title: 'abc', authors: ['\u0345\u0345\u0345'], language: 'en', expected: null },
    ...['Ω', 'א', 'ก', '中', '한'].map(letter => ({
        name: `blocked range ${letter}`, title: `Latin Book ${letter}`, authors: ['Author'], language: 'en', expected: null,
    })),
] as const;

export function scriptCard(input = scriptCases[0] as {
    title: string; authors: readonly string[]; language: string; observed?: string;
}): OwnerBatchReviewCard {
    const base = pickerCard();
    return { ...base, metadataState: 'manual', metadataSummary: null, review: null,
        reviewVersion: null, reviewReady: false, reviewDisposition: null,
        observed: { title: input.title, authors: [...input.authors], language: input.language, script: input.observed ?? null },
        fieldSources: { ...base.fieldSources, title: 'detected', authors: 'detected', language: 'detected' } };
}

export function scriptReview(patch: Partial<OwnerCandidateReview> = {}): OwnerCandidateReview {
    return { ...pickerReview, priceMinor: 100, script: null,
        metadataChoice: { mode: 'manual', selectionId: null },
        notes: { publicNote: null, internalNote: null }, ...patch };
}
