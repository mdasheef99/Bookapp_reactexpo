/**
 * Reads the HTTP status of a `supabase.functions.invoke` failure before
 * looking at the app error body (§3.2 access-lost rule).
 *
 * supabase-js surfaces function errors as objects with a `context` holding
 * the fetch `Response`; network failures have no status.
 */
export function httpStatusOf(error: unknown): number | null {
    if (!error || typeof error !== 'object') return null;
    const context = (error as { context?: unknown }).context;
    if (context && typeof context === 'object' && 'status' in context) {
        const status = (context as { status?: unknown }).status;
        if (typeof status === 'number' && Number.isInteger(status)) return status;
    }
    if ('status' in error) {
        const status = (error as { status?: unknown }).status;
        if (typeof status === 'number' && Number.isInteger(status)) return status;
    }
    return null;
}

/** 401/403 without (or with) an app error body means access was lost. */
export function isAccessLostHttpStatus(status: number | null): boolean {
    return status === 401 || status === 403;
}
