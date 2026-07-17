export type Weekday = 'sunday' | 'monday' | 'tuesday' | 'wednesday'
    | 'thursday' | 'friday' | 'saturday';
export interface LocalOpenInterval { opens: string; closes: string }
export type ScheduleException = { kind: 'closed' }
    | { kind: 'special'; intervals: LocalOpenInterval[] };
export interface StoreSchedule {
    timeZone: string;
    weekly: Partial<Record<Weekday, LocalOpenInterval[]>>;
    exceptions: Record<string, ScheduleException>;
}

interface LocalDate { year: number; month: number; day: number }
interface LocalDateTime extends LocalDate { hour: number; minute: number; second: number }
interface UtcSegment { opens: Date; closes: Date }

const weekdays: Weekday[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];
const formatterCache = new Map<string, Intl.DateTimeFormat>();
const conversionCache = new Map<string, number[]>();

function formatter(timeZone: string): Intl.DateTimeFormat {
    const cached = formatterCache.get(timeZone);
    if (cached) return cached;
    let created: Intl.DateTimeFormat;
    try {
        created = new Intl.DateTimeFormat('en-CA', {
            timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        created.format(new Date(0));
    } catch {
        throw new Error('STORE_SCHEDULE_INVALID');
    }
    formatterCache.set(timeZone, created);
    return created;
}

function localParts(value: Date | number, timeZone: string): LocalDateTime {
    const parts = formatter(timeZone).formatToParts(new Date(value));
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(
        parts.find((candidate) => candidate.type === type)?.value,
    );
    return {
        year: part('year'), month: part('month'), day: part('day'),
        hour: part('hour'), minute: part('minute'), second: part('second'),
    };
}

function isoDate(value: LocalDate): string {
    return `${value.year.toString().padStart(4, '0')}-${value.month.toString().padStart(2, '0')}-${value.day.toString().padStart(2, '0')}`;
}

function addLocalDays(value: LocalDate, days: number): LocalDate {
    const date = new Date(Date.UTC(value.year, value.month - 1, value.day + days));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function weekday(value: LocalDate): Weekday {
    return weekdays[new Date(Date.UTC(value.year, value.month - 1, value.day)).getUTCDay()];
}

function parseTime(value: string): { hour: number; minute: number; total: number } {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) throw new Error('STORE_SCHEDULE_INVALID');
    const hour = Number(match[1]); const minute = Number(match[2]);
    if (hour > 23 || minute > 59) throw new Error('STORE_SCHEDULE_INVALID');
    return { hour, minute, total: hour * 60 + minute };
}

function localToUtc(value: LocalDateTime, timeZone: string, edge: 'open' | 'close'): Date {
    const key = `${timeZone}:${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}`;
    let candidates = conversionCache.get(key);
    if (!candidates) {
        const naive = Date.UTC(value.year, value.month - 1, value.day,
            value.hour, value.minute, value.second);
        const offsets = new Set<number>();
        for (let hours = -36; hours <= 36; hours += 3) {
            const instant = naive + hours * 3600000;
            const local = localParts(instant, timeZone);
            offsets.add(Date.UTC(local.year, local.month - 1, local.day,
                local.hour, local.minute, local.second) - instant);
        }
        candidates = [...offsets].map((offset) => naive - offset).filter((instant) => {
            const local = localParts(instant, timeZone);
            return local.year === value.year && local.month === value.month && local.day === value.day
                && local.hour === value.hour && local.minute === value.minute
                && local.second === value.second;
        }).sort((a, b) => a - b);
        conversionCache.set(key, candidates);
    }
    if (candidates.length === 0) throw new Error('STORE_SCHEDULE_INVALID');
    return new Date(edge === 'open' ? candidates[0] : candidates[candidates.length - 1]);
}

function sourceIntervals(schedule: StoreSchedule, date: LocalDate): LocalOpenInterval[] {
    const exception = schedule.exceptions[isoDate(date)];
    if (exception?.kind === 'closed') return [];
    if (exception?.kind === 'special') return exception.intervals;
    return schedule.weekly[weekday(date)] ?? [];
}

function validateIntervals(intervals: LocalOpenInterval[], includePrevious: LocalOpenInterval[] = []): void {
    const ranges = intervals.map((candidate) => {
        const opens = parseTime(candidate.opens).total;
        const rawClose = parseTime(candidate.closes).total;
        if (opens === rawClose) throw new Error('STORE_SCHEDULE_INVALID');
        return [opens, rawClose <= opens ? rawClose + 1440 : rawClose] as const;
    });
    includePrevious.forEach((candidate) => {
        const opens = parseTime(candidate.opens).total;
        const closes = parseTime(candidate.closes).total;
        if (closes <= opens && closes > 0) ranges.push([0, closes]);
    });
    ranges.sort((left, right) => left[0] - right[0]);
    for (let index = 1; index < ranges.length; index += 1) {
        if (ranges[index][0] < ranges[index - 1][1]) throw new Error('STORE_SCHEDULE_INVALID');
    }
}

export function validateStoreSchedule(schedule: StoreSchedule): void {
    formatter(schedule.timeZone);
    weekdays.forEach((day, index) => {
        const previous = weekdays[(index + 6) % 7];
        validateIntervals(schedule.weekly[day] ?? [], schedule.weekly[previous] ?? []);
    });
    Object.entries(schedule.exceptions).forEach(([date, exception]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('STORE_SCHEDULE_INVALID');
        const [year, month, day] = date.split('-').map(Number);
        const parsed = new Date(Date.UTC(year, month - 1, day));
        if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month
            || parsed.getUTCDate() !== day) throw new Error('STORE_SCHEDULE_INVALID');
        if (exception.kind === 'special') {
            if (exception.intervals.length === 0) throw new Error('STORE_SCHEDULE_INVALID');
            validateIntervals(exception.intervals);
            const next = addLocalDays({ year, month, day }, 1);
            if (!schedule.exceptions[isoDate(next)]) {
                validateIntervals(schedule.weekly[weekday(next)] ?? [], exception.intervals);
            }
        }
    });
}

function segmentsForDate(schedule: StoreSchedule, date: LocalDate): UtcSegment[] {
    const currentException = schedule.exceptions[isoDate(date)];
    if (currentException?.kind === 'closed') return [];
    const midnight = { ...date, hour: 0, minute: 0, second: 0 };
    const tomorrow = addLocalDays(date, 1);
    const nextMidnight = { ...tomorrow, hour: 0, minute: 0, second: 0 };
    const localSegments: Array<{ opens: LocalDateTime; closes: LocalDateTime }> = [];
    const current = sourceIntervals(schedule, date);
    current.forEach((candidate) => {
        const opens = parseTime(candidate.opens); const closes = parseTime(candidate.closes);
        localSegments.push({
            opens: { ...date, hour: opens.hour, minute: opens.minute, second: 0 },
            closes: closes.total <= opens.total
                ? nextMidnight : { ...date, hour: closes.hour, minute: closes.minute, second: 0 },
        });
    });
    if (!currentException) {
        const yesterday = addLocalDays(date, -1);
        sourceIntervals(schedule, yesterday).forEach((candidate) => {
            const opens = parseTime(candidate.opens); const closes = parseTime(candidate.closes);
            if (closes.total <= opens.total && closes.total > 0) {
                localSegments.push({ opens: midnight,
                    closes: { ...date, hour: closes.hour, minute: closes.minute, second: 0 } });
            }
        });
    }
    return localSegments.map((segment) => ({
        opens: localToUtc(segment.opens, schedule.timeZone, 'open'),
        closes: localToUtc(segment.closes, schedule.timeZone, 'close'),
    })).filter((segment) => segment.closes > segment.opens)
        .sort((left, right) => left.opens.getTime() - right.opens.getTime());
}

function asDate(value: string | Date): Date {
    const result = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(result.getTime())) throw new Error('STORE_SCHEDULE_INVALID');
    return result;
}

function dateAtInstant(value: Date, zone: string): LocalDate {
    const local = localParts(value, zone);
    return { year: local.year, month: local.month, day: local.day };
}

function allSegments(schedule: StoreSchedule, start: Date, horizonDays: number): UtcSegment[] {
    if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 366) {
        throw new Error('STORE_SCHEDULE_INVALID');
    }
    validateStoreSchedule(schedule);
    const first = dateAtInstant(start, schedule.timeZone);
    const result: UtcSegment[] = [];
    for (let day = 0; day <= horizonDays; day += 1) {
        result.push(...segmentsForDate(schedule, addLocalDays(first, day)));
    }
    return result;
}

export function nextStoreOpening(schedule: StoreSchedule, from: string | Date,
    horizonDays = 62): Date | null {
    const cursor = asDate(from);
    const segment = allSegments(schedule, cursor, horizonDays)
        .find((candidate) => candidate.closes > cursor);
    if (!segment) return null;
    return new Date(Math.max(cursor.getTime(), segment.opens.getTime()));
}

export function addStoreOpenSeconds(schedule: StoreSchedule, from: string | Date,
    seconds: number, horizonDays = 62): Date {
    if (!Number.isSafeInteger(seconds) || seconds < 0) throw new Error('STORE_SCHEDULE_INVALID');
    const start = asDate(from);
    if (seconds === 0) return start;
    let remaining = seconds * 1000;
    let cursor = start.getTime();
    for (const segment of allSegments(schedule, start, horizonDays)) {
        const opens = Math.max(cursor, segment.opens.getTime());
        const available = segment.closes.getTime() - opens;
        if (available <= 0) continue;
        if (remaining <= available) return new Date(opens + remaining);
        remaining -= available; cursor = segment.closes.getTime();
    }
    throw new Error('STORE_SCHEDULE_UNAVAILABLE');
}

export function openSecondsBetween(schedule: StoreSchedule, from: string | Date,
    to: string | Date, horizonDays = 62): number {
    const start = asDate(from); const end = asDate(to);
    if (end < start) throw new Error('STORE_SCHEDULE_INVALID');
    let milliseconds = 0;
    for (const segment of allSegments(schedule, start, horizonDays)) {
        if (segment.opens >= end) break;
        milliseconds += Math.max(0, Math.min(end.getTime(), segment.closes.getTime())
            - Math.max(start.getTime(), segment.opens.getTime()));
    }
    return Math.floor(milliseconds / 1000);
}

export function closingBoundaryAfter(schedule: StoreSchedule, from: string | Date,
    horizonDays = 62): Date | null {
    const cursor = asDate(from);
    const segments = allSegments(schedule, cursor, horizonDays);
    const index = segments.findIndex((segment) => segment.opens <= cursor && segment.closes > cursor);
    if (index < 0) return null;
    let closes = segments[index].closes;
    for (let next = index + 1; next < segments.length
        && segments[next].opens.getTime() === closes.getTime(); next += 1) {
        closes = segments[next].closes;
    }
    return new Date(closes);
}
