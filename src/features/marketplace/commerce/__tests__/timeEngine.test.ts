import {
    addStoreOpenSeconds,
    closingBoundaryAfter,
    nextStoreOpening,
    openSecondsBetween,
    validateStoreSchedule,
    type StoreSchedule,
} from '../timeEngine';

const interval = (opens: string, closes: string) => ({ opens, closes });
const weekday = (overrides: Partial<StoreSchedule> = {}): StoreSchedule => ({
    timeZone: 'Asia/Kolkata',
    weekly: {
        monday: [interval('09:00', '17:00')],
        tuesday: [interval('09:00', '17:00')],
        wednesday: [interval('09:00', '17:00')],
        thursday: [interval('09:00', '17:00')],
        friday: [interval('09:00', '17:00')],
    },
    exceptions: {},
    ...overrides,
});

describe('Phase 6 deterministic store-open time engine', () => {
    it('accumulates same-day open seconds', () => {
        expect(addStoreOpenSeconds(weekday(), '2026-07-13T04:30:00.000Z', 7200).toISOString())
            .toBe('2026-07-13T06:30:00.000Z');
    });

    it('jumps from a closed submission to the next opening', () => {
        expect(addStoreOpenSeconds(weekday(), '2026-07-13T01:00:00.000Z', 3600).toISOString())
            .toBe('2026-07-13T04:30:00.000Z');
    });

    it('crosses closing into the next business day', () => {
        expect(addStoreOpenSeconds(weekday(), '2026-07-13T10:30:00.000Z', 7200).toISOString())
            .toBe('2026-07-14T04:30:00.000Z');
    });

    it('supports multiple opening intervals in one day', () => {
        const schedule = weekday({ weekly: { monday: [interval('09:00', '12:00'), interval('14:00', '18:00')] } });
        expect(addStoreOpenSeconds(schedule, '2026-07-13T05:30:00.000Z', 10800).toISOString())
            .toBe('2026-07-13T10:30:00.000Z');
    });

    it('handles the exact Asia/Kolkata Friday overnight vector', () => {
        const schedule = weekday({ weekly: {
            friday: [interval('20:00', '02:00')], saturday: [interval('20:00', '02:00')],
        } });
        const submitted = '2026-07-17T17:30:00.000Z'; // Friday 23:00 local.
        expect(openSecondsBetween(schedule, submitted, '2026-07-17T20:30:00.000Z')).toBe(10800);
        expect(nextStoreOpening(schedule, '2026-07-17T20:30:00.000Z')?.toISOString())
            .toBe('2026-07-18T14:30:00.000Z');
        expect(addStoreOpenSeconds(schedule, submitted, 21600).toISOString())
            .toBe('2026-07-18T17:30:00.000Z'); // Saturday 23:00 local.
        expect(closingBoundaryAfter(schedule, '2026-07-18T17:30:00.000Z')?.toISOString())
            .toBe('2026-07-18T20:30:00.000Z'); // Sunday 02:00 local.
    });

    it('recognizes the post-midnight tail of an overnight interval', () => {
        const schedule = weekday({ weekly: { friday: [interval('20:00', '02:00')] } });
        expect(openSecondsBetween(schedule, '2026-07-17T19:30:00.000Z',
            '2026-07-17T20:30:00.000Z')).toBe(3600);
    });

    it('lets holidays and full closures override recurring hours', () => {
        const schedule = weekday({ exceptions: { '2026-07-13': { kind: 'closed' } } });
        expect(nextStoreOpening(schedule, '2026-07-13T03:30:00.000Z')?.toISOString())
            .toBe('2026-07-14T03:30:00.000Z');
    });

    it('lets date-specific special hours override recurring hours', () => {
        const schedule = weekday({ exceptions: {
            '2026-07-13': { kind: 'special', intervals: [interval('12:00', '15:00')] },
        } });
        expect(nextStoreOpening(schedule, '2026-07-13T03:30:00.000Z')?.toISOString())
            .toBe('2026-07-13T06:30:00.000Z');
    });

    it('rejects invalid IANA zones and overlapping/contradictory intervals', () => {
        expect(() => validateStoreSchedule(weekday({ timeZone: 'Mars/Olympus' }))).toThrow('STORE_SCHEDULE_INVALID');
        expect(() => validateStoreSchedule(weekday({ weekly: { monday: [
            interval('09:00', '13:00'), interval('12:00', '17:00'),
        ] } }))).toThrow('STORE_SCHEDULE_INVALID');
        expect(() => validateStoreSchedule(weekday({ weekly: { monday: [interval('09:00', '09:00')] } })))
            .toThrow('STORE_SCHEDULE_INVALID');
        expect(() => validateStoreSchedule(weekday({ exceptions: {
            '2026-07-13': { kind: 'special', intervals: [] },
        } }))).toThrow('STORE_SCHEDULE_INVALID');
        expect(() => validateStoreSchedule(weekday({ exceptions: {
            '2026-02-30': { kind: 'special', intervals: [interval('09:00', '10:00')] },
        } }))).toThrow('STORE_SCHEDULE_INVALID');
    });

    it('fails with a stable error when no opening exists inside the horizon', () => {
        expect(() => addStoreOpenSeconds(weekday({ weekly: {} }),
            '2026-07-13T00:00:00.000Z', 1, 14)).toThrow('STORE_SCHEDULE_UNAVAILABLE');
    });

    it('handles DST-forward using real elapsed open seconds', () => {
        const schedule: StoreSchedule = { timeZone: 'America/New_York', weekly: {
            sunday: [interval('01:00', '04:00')],
        }, exceptions: {} };
        expect(openSecondsBetween(schedule, '2026-03-08T06:00:00.000Z',
            '2026-03-08T08:00:00.000Z')).toBe(7200);
    });

    it('handles DST-backward using real elapsed open seconds', () => {
        const schedule: StoreSchedule = { timeZone: 'America/New_York', weekly: {
            sunday: [interval('00:00', '04:00')],
        }, exceptions: {} };
        expect(openSecondsBetween(schedule, '2026-11-01T04:00:00.000Z',
            '2026-11-01T09:00:00.000Z')).toBe(18000);
    });

    it('keeps Asia/Kolkata stable without DST', () => {
        const schedule: StoreSchedule = { timeZone: 'Asia/Kolkata', weekly: {
            sunday: [interval('09:00', '17:00')],
        }, exceptions: {} };
        expect(openSecondsBetween(schedule, '2026-07-19T03:30:00.000Z',
            '2026-07-19T11:30:00.000Z')).toBe(28800);
    });
});
