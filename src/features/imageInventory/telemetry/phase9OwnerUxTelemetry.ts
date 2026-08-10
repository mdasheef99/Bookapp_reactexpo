import { z } from 'zod';

const eventSchema = z.object({
    event: z.enum([
        'entry', 'source', 'upload', 'resume', 'candidate', 'false_missed',
        'variant', 'conflict', 'reconnect', 'readiness', 'close',
    ]),
    operation: z.enum([
        'inventory_hub', 'capture', 'session_progress', 'candidate_review',
        'variant_review', 'readiness_summary', 'close_session',
    ]),
    outcome: z.enum(['started', 'success', 'cancelled', 'blocked', 'error']),
    status: z.enum(['online', 'offline', 'refreshing', 'authoritative']).optional(),
    countBucket: z.enum(['0', '1-5', '6-10', '11-15']).optional(),
    durationBucket: z.enum(['under_1s', '1-3s', '3-10s', 'over_10s']).optional(),
    errorCategory: z.enum([
        'auth', 'validation', 'state_conflict', 'version_conflict',
        'idempotency', 'network', 'internal',
    ]).optional(),
    contractVersion: z.literal('phase9-owner-ux-v1').optional(),
}).strict();

export type Phase9OwnerUxTelemetryEvent = z.infer<typeof eventSchema>;

export const phase9OwnerUxTelemetry = Object.freeze({
    create(value: unknown): Phase9OwnerUxTelemetryEvent {
        const result = eventSchema.safeParse(value);
        if (!result.success) throw new Error('Owner UX telemetry event was rejected.');
        return Object.freeze(result.data);
    },
});
