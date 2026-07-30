import { z } from 'zod';

const routeId = z.string().uuid();

type RouteParams = Record<string, string | string[] | undefined>;

export function parseSessionRouteParams(params: RouteParams): { sessionId: string } | null {
    const parsed = z.object({ sessionId: routeId }).strict().safeParse(params);
    return parsed.success ? parsed.data : null;
}

export function parseCandidateRouteParams(
    params: RouteParams,
): { sessionId: string; candidateId: string } | null {
    const parsed = z.object({
        sessionId: routeId,
        candidateId: routeId,
    }).strict().safeParse(params);
    return parsed.success ? parsed.data : null;
}

export const inventoryRoutes = {
    root: () => '/(store-owner)/inventory' as const,
    reviews: () => '/(store-owner)/inventory/reviews' as const,
    scan: () => '/(store-owner)/inventory/scan' as const,
    preview: (sessionId: string) => ({
        pathname: '/(store-owner)/inventory/scan/preview' as const,
        params: { sessionId },
    }),
    session: (sessionId: string) => `/(store-owner)/inventory/scan/${sessionId}` as const,
    candidate: (sessionId: string, candidateId: string) => (
        `/(store-owner)/inventory/scan/${sessionId}/candidate/${candidateId}` as const
    ),
    missed: (sessionId: string) => (
        `/(store-owner)/inventory/scan/${sessionId}/missed` as const
    ),
    summary: (sessionId: string) => (
        `/(store-owner)/inventory/scan/${sessionId}/summary` as const
    ),
};
