import {
    CONDITION_CHOICES,
    DEFAULT_LANGUAGE_HINT,
    PRICE_PRESET_MINOR_OPTIONS,
    buildStartScanSessionV2Request,
    initialScanSetupForm,
    isStartEnabled,
    normalizeBatchLabel,
    rupeesToPriceMinor,
} from '../scanSetup/scanSetupForm';

const baseAttempt = { key: 'start-scan-session-v2:00000000-0000-4000-8000-000000000001', commandId: '00000000-0000-4000-8000-000000000002' };

function completeForm(overrides: Partial<typeof initialScanSetupForm> = {}) {
    return { ...initialScanSetupForm, location: 'Front shelf', ...overrides };
}

describe('Phase 9 NEW 6G-C scan setup defaults', () => {
    it('preselects English as a non-authoritative hint and leaves condition/price unset', () => {
        expect(DEFAULT_LANGUAGE_HINT).toBe('en');
        expect(initialScanSetupForm.languageHint).toBe('en');
        expect(initialScanSetupForm.condition).toBeNull();
        expect(initialScanSetupForm.priceMinor).toBeNull();
    });

    it('offers exactly the nullable condition vocabulary led by Not set', () => {
        expect(CONDITION_CHOICES.map((choice) => choice.value)).toEqual([
            null, 'new', 'like_new', 'very_good', 'good', 'acceptable',
        ]);
    });

    it('keeps exact INR preset boundaries in integer minor units', () => {
        expect(PRICE_PRESET_MINOR_OPTIONS[0]).toBeNull();
        expect(PRICE_PRESET_MINOR_OPTIONS).toContain(2500);
        expect(PRICE_PRESET_MINOR_OPTIONS).toContain(25000);
        expect(PRICE_PRESET_MINOR_OPTIONS).toContain(30000);
        expect(PRICE_PRESET_MINOR_OPTIONS).toContain(100000);
        expect(PRICE_PRESET_MINOR_OPTIONS).toContain(110000);
        expect(PRICE_PRESET_MINOR_OPTIONS).toContain(200000);
        for (const option of PRICE_PRESET_MINOR_OPTIONS) {
            if (option !== null) expect(Number.isSafeInteger(option)).toBe(true);
        }
    });

    it('converts whole rupees exactly and rejects fractional or negative input', () => {
        expect(rupeesToPriceMinor(25)).toBe(2500);
        expect(rupeesToPriceMinor(0)).toBe(0);
        expect(rupeesToPriceMinor(12.5)).toBeNull();
        expect(rupeesToPriceMinor(-1)).toBeNull();
        expect(rupeesToPriceMinor(Number.NaN)).toBeNull();
    });

    it('bounds custom whole-rupee entry by the exact minor-unit contract maximum', () => {
        // Contract: priceMinor is SafeInteger[0..2147483647] minor units.
        expect(rupeesToPriceMinor(21_474_836)).toBe(2_147_483_600);
        // One more rupee would overflow the minor-unit maximum.
        expect(rupeesToPriceMinor(21_474_837)).toBeNull();
    });

    it('normalizes the optional batch label with NFC, trimming, and an 80 code-point bound', () => {
        expect(normalizeBatchLabel('')).toBeNull();
        expect(normalizeBatchLabel('   ')).toBeNull();
        expect(normalizeBatchLabel('  Shelf\u00A0A  ')).toBe('Shelf\u00A0A');
        expect(normalizeBatchLabel('\u212B angstrom')).toBe('Å angstrom');
        expect(() => normalizeBatchLabel('x'.repeat(81))).toThrow();
        expect(normalizeBatchLabel('x'.repeat(80))).toBe('x'.repeat(80));
    });

    it('disables Start until a non-empty location exists', () => {
        expect(isStartEnabled(initialScanSetupForm)).toBe(false);
        expect(isStartEnabled(completeForm({ location: '   ' }))).toBe(false);
        expect(isStartEnabled(completeForm())).toBe(true);
    });

    it('builds the exact Start v2 request without caller-owned quantity, script, or currency keys', () => {
        const form = completeForm({
            condition: 'good',
            priceMinor: 25000,
            publication: 'publish',
            batchLabel: ' Box 7 ',
        });
        const request = buildStartScanSessionV2Request(form, baseAttempt);
        expect(request).toEqual({
            action: 'start_scan_session_v2',
            contractVersion: 'phase9-owner-batch-review-v1',
            languageHint: 'en',
            condition: 'good',
            location: 'Front shelf',
            priceMinor: 25000,
            publication: 'publish',
            batchLabel: 'Box 7',
            idempotencyKey: baseAttempt.key,
            commandId: baseAttempt.commandId,
        });
        expect(Object.keys(request).sort()).toEqual([
            'action', 'batchLabel', 'commandId', 'condition', 'contractVersion',
            'idempotencyKey', 'languageHint', 'location', 'priceMinor', 'publication',
        ]);
    });

    it('submits a null batch label rather than an empty string', () => {
        const request = buildStartScanSessionV2Request(completeForm(), baseAttempt);
        expect(request.batchLabel).toBeNull();
    });
});
