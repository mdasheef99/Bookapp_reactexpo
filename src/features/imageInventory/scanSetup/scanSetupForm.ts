import { createCaptureAttempt } from '../capture/captureIds';

export type ScanCondition = 'new' | 'like_new' | 'very_good' | 'good' | 'acceptable';

export type ScanSetupFormState = Readonly<{
    languageHint: string;
    condition: ScanCondition | null;
    location: string;
    priceMinor: number | null;
    publication: 'private' | 'publish';
    batchLabel: string;
}>;

export const DEFAULT_LANGUAGE_HINT = 'en';

export const LANGUAGE_OPTIONS: ReadonlyArray<Readonly<{ value: string; label: string }>> = [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'es', label: 'Spanish' },
    { value: 'hi', label: 'Hindi' },
    { value: 'ur', label: 'Urdu' },
    { value: 'ta', label: 'Tamil' },
];

export const CONDITION_CHOICES: ReadonlyArray<Readonly<{
    value: ScanCondition | null;
    label: string;
}>> = [
    { value: null, label: 'Not set' },
    { value: 'new', label: 'New' },
    { value: 'like_new', label: 'Like New' },
    { value: 'very_good', label: 'Very Good' },
    { value: 'good', label: 'Good' },
    { value: 'acceptable', label: 'Acceptable' },
];

export const PUBLICATION_CHOICES: ReadonlyArray<Readonly<{
    value: 'private' | 'publish';
    label: string;
}>> = [
    { value: 'private', label: 'Private' },
    { value: 'publish', label: 'Prepare to publish' },
];

// Contract: priceMinor is SafeInteger[0..2147483647] minor units; the custom
// UI entry accepts whole rupees only, so the rupee ceiling is floor(max/100).
export const MAX_PRICE_MINOR = 2_147_483_647;
const MAX_WHOLE_RUPEES = Math.floor(MAX_PRICE_MINOR / 100);

function wholeRupeesToMinor(rupees: number): number {
    return rupees * 100;
}

export function pricePresetMinorOptions(): ReadonlyArray<number | null> {
    const presets: Array<number | null> = [null];
    for (let rupees = 25; rupees <= 250; rupees += 25) {
        presets.push(wholeRupeesToMinor(rupees));
    }
    for (let rupees = 300; rupees <= 1000; rupees += 50) {
        presets.push(wholeRupeesToMinor(rupees));
    }
    for (let rupees = 1100; rupees <= 2000; rupees += 100) {
        presets.push(wholeRupeesToMinor(rupees));
    }
    return presets;
}

export const PRICE_PRESET_MINOR_OPTIONS = pricePresetMinorOptions();

export function rupeesToPriceMinor(rupees: number): number | null {
    if (!Number.isInteger(rupees) || rupees < 0
        || rupees > MAX_WHOLE_RUPEES) return null;
    return wholeRupeesToMinor(rupees);
}

const controlOrBidi = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u;

export function normalizeBatchLabel(raw: string): string | null {
    const normalized = raw.normalize('NFC').trim();
    if (!normalized) return null;
    if ([...normalized].length > 80 || controlOrBidi.test(normalized)) {
        throw new Error('invalid batch label');
    }
    return normalized;
}

export function formatInrFromMinor(priceMinor: number | null): string {
    if (priceMinor === null) return 'Not set';
    return `\u20B9${priceMinor / 100}`;
}

export const initialScanSetupForm: ScanSetupFormState = Object.freeze({
    languageHint: DEFAULT_LANGUAGE_HINT,
    condition: null,
    location: '',
    priceMinor: null,
    publication: 'private',
    batchLabel: '',
});

export function isStartEnabled(form: ScanSetupFormState): boolean {
    return form.location.trim().length > 0 && form.location.trim().length <= 120;
}

export function buildStartScanSessionV2Request(
    form: ScanSetupFormState,
    attempt: ReturnType<typeof createCaptureAttempt>,
): {
    action: 'start_scan_session_v2';
    contractVersion: 'phase9-owner-batch-review-v1';
    languageHint: string;
    condition: ScanCondition | null;
    location: string;
    priceMinor: number | null;
    publication: 'private' | 'publish';
    batchLabel: string | null;
    idempotencyKey: string;
    commandId: string;
} {
    return {
        action: 'start_scan_session_v2',
        contractVersion: 'phase9-owner-batch-review-v1',
        languageHint: form.languageHint,
        condition: form.condition,
        location: form.location.trim(),
        priceMinor: form.priceMinor,
        publication: form.publication,
        batchLabel: normalizeBatchLabel(form.batchLabel),
        idempotencyKey: attempt.key,
        commandId: attempt.commandId,
    };
}
