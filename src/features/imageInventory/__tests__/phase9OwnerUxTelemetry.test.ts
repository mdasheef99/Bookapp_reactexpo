import { phase9OwnerUxTelemetry } from '../telemetry/phase9OwnerUxTelemetry';

describe('Phase 9 Unit 6F Owner UX telemetry boundary', () => {
    it('accepts only bounded non-content operational fields', () => {
        expect(phase9OwnerUxTelemetry.create({
            event: 'close', operation: 'readiness_summary', outcome: 'success',
            countBucket: '1-5', contractVersion: 'phase9-owner-ux-v1',
        })).toEqual({
            event: 'close', operation: 'readiness_summary', outcome: 'success',
            countBucket: '1-5', contractVersion: 'phase9-owner-ux-v1',
        });
    });

    it.each(['title', 'author', 'isbn', 'uri', 'hash', 'token', 'rawError', 'sessionId', 'price']) (
        'rejects forbidden content or identity field %s',
        (field) => expect(() => phase9OwnerUxTelemetry.create({
            event: 'close', operation: 'readiness_summary', outcome: 'error',
            [field]: 'private',
        })).toThrow('telemetry'),
    );
});
