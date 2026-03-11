import * as Sentry from '@sentry/react-native';

const appConfig = require('../../app.json') as {
    expo?: {
        slug?: string;
        version?: string;
    };
};

const SENSITIVE_KEYS = [
    'address', 'anon_key', 'authorization', 'cookie', 'cookies', 'display_name',
    'email', 'otp', 'password', 'phone', 'phone_number', 'query', 'referral',
    'refresh_token', 'session', 'token', 'user_metadata',
];

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const appSlug = appConfig.expo?.slug ?? 'booktalks-mobile';
const appVersion = appConfig.expo?.version ?? '1.0.0';
const environment = process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production');
const buildNumber = process.env.EXPO_PUBLIC_APP_BUILD ?? undefined;
const buildProfile = process.env.EAS_BUILD_PROFILE ?? undefined;
const shouldSendVerificationEvent = process.env.EXPO_PUBLIC_SENTRY_TEST_EVENT === 'true';
const release = buildNumber ? `${appSlug}@${appVersion}+${buildNumber}` : `${appSlug}@${appVersion}`;

let hasInitialized = false;
let lastTrackedRoute: string | null = null;
let hasSentVerificationEvent = false;

function isSensitiveKey(key: string) {
    const normalized = key.toLowerCase();
    return SENSITIVE_KEYS.some(sensitive => normalized.includes(sensitive));
}

function sanitizeRecord(
    record?: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
    if (!record) return undefined;

    return Object.entries(record).reduce<Record<string, unknown>>((acc, [key, value]) => {
        acc[key] = isSensitiveKey(key) ? '[REDACTED]' : value;
        return acc;
    }, {});
}

function sanitizeEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
    if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
    }

    if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.headers;
        delete event.request.query_string;
    }

    event.extra = sanitizeRecord(event.extra) ?? event.extra;
    event.tags = sanitizeRecord(event.tags) as Record<string, string> | undefined;

    return event;
}

export function initSentry() {
    if (hasInitialized || !dsn) {
        if (!dsn && __DEV__) {
            console.warn('Sentry disabled: missing EXPO_PUBLIC_SENTRY_DSN');
        }
        return;
    }

    Sentry.init({
        dsn,
        enabled: !__DEV__ || process.env.EXPO_PUBLIC_ENABLE_SENTRY_IN_DEV === 'true',
        debug: __DEV__,
        environment,
        release,
        dist: buildNumber,
        attachStacktrace: true,
        sendDefaultPii: false,
        tracesSampleRate: 0,
        beforeSend: sanitizeEvent,
    });

    Sentry.setTags({
        app_slug: appSlug,
        app_version: appVersion,
        backend: 'supabase',
        router: 'expo-router',
        server_state: 'tanstack-query',
        styling: 'nativewind',
    });

    if (buildNumber) {
        Sentry.setTag('build_number', buildNumber);
    }

    if (buildProfile) {
        Sentry.setTag('build_profile', buildProfile);
    }

    hasInitialized = true;
}

export function syncSentryUser(userId: string | null) {
    Sentry.setUser(userId ? { id: userId } : null);
}

export function trackSentryRoute(route: string) {
    if (!route || lastTrackedRoute === route) return;

    Sentry.setTag('route', route);
    Sentry.addBreadcrumb({
        category: 'navigation',
        level: 'info',
        message: `Navigated to ${route}`,
        type: 'navigation',
        data: { route },
    });

    lastTrackedRoute = route;
}

export function maybeSendSentryVerificationEvent() {
    if (!shouldSendVerificationEvent || hasSentVerificationEvent) return;

    Sentry.captureException(new Error('BookTalks Sentry verification event'), {
        tags: {
            verification: 'true',
            verification_source: 'app_start',
        },
        extra: {
            app_slug: appSlug,
            environment,
        },
    });

    hasSentVerificationEvent = true;
}

export { Sentry };