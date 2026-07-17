import { isServiceRoleAuthorization } from '../_shared/serviceRoleAuthorization';
import fs from 'fs';
import path from 'path';

const jwtWithRole = (role: string) => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role })}.test-signature`;
};

describe('commerce-task-worker service-role authorization', () => {
    it('accepts the exact configured service-role key', () => {
        expect(isServiceRoleAuthorization('Bearer configured-service-key', 'configured-service-key')).toBe(true);
    });

    it('accepts a gateway-validated service-role JWT when the forwarded token differs', () => {
        expect(isServiceRoleAuthorization(`Bearer ${jwtWithRole('service_role')}`, 'configured-service-key')).toBe(true);
    });

    it('rejects authenticated-user, malformed, and missing credentials', () => {
        expect(isServiceRoleAuthorization(`Bearer ${jwtWithRole('authenticated')}`, 'configured-service-key')).toBe(false);
        expect(isServiceRoleAuthorization('Bearer not-a-jwt', 'configured-service-key')).toBe(false);
        expect(isServiceRoleAuthorization(null, 'configured-service-key')).toBe(false);
        expect(isServiceRoleAuthorization('Bearer configured-service-key', null)).toBe(false);
    });
});

describe('commerce scheduler worker dispatch', () => {
    it('forwards its service-role bearer token explicitly to the worker', () => {
        const schedulerPath = path.join(process.cwd(), 'supabase', 'functions', 'commerce-scheduler', 'index.ts');
        const source = fs.readFileSync(schedulerPath, 'utf8');

        expect(source).toContain('headers: { Authorization: `Bearer ${serviceKey}` }');
    });
});
