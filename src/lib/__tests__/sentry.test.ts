describe('sentry helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    process.env.EXPO_PUBLIC_APP_ENV = 'test';
    delete process.env.EXPO_PUBLIC_APP_BUILD;
    delete process.env.EXPO_PUBLIC_SENTRY_TEST_EVENT;
    delete process.env.EAS_BUILD_PROFILE;
  });

  it('initializes Sentry once with safe default tags', () => {
    const Sentry = require('@sentry/react-native');
    const { initSentry } = require('@/lib/sentry');

    initSentry();
    initSentry();

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
      environment: 'test',
      release: 'booktalks-mobile@1.0.0',
      dist: undefined,
    }));
    expect(Sentry.setTags).toHaveBeenCalledWith(expect.objectContaining({
      app_version: '1.0.0',
      backend: 'supabase',
      router: 'expo-router',
      server_state: 'tanstack-query',
      styling: 'nativewind',
    }));
  });

  it('syncs and clears the current user safely', () => {
    const Sentry = require('@sentry/react-native');
    const { syncSentryUser } = require('@/lib/sentry');

    syncSentryUser('user-123');
    syncSentryUser(null);

    expect(Sentry.setUser).toHaveBeenNthCalledWith(1, { id: 'user-123' });
    expect(Sentry.setUser).toHaveBeenNthCalledWith(2, null);
  });

  it('captures handled exceptions with privacy-safe tags and extras', () => {
    const Sentry = require('@sentry/react-native');
    const { captureAppException } = require('@/lib/sentry');

    captureAppException(new Error('Exchange request failed'), {
      area: 'exchange',
      action: 'request_transaction_failed',
      tags: {
        feature: 'exchange',
        attempt: 2,
        retryable: false,
      },
      extra: {
        listing_id: 'listing-123',
        phone: '+1234567890',
        shipping_address: '123 Main Street',
      },
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Exchange request failed' }),
      expect.objectContaining({
        tags: expect.objectContaining({
          area: 'exchange',
          action: 'request_transaction_failed',
          feature: 'exchange',
          attempt: '2',
          retryable: 'false',
        }),
        extra: expect.objectContaining({
          listing_id: 'listing-123',
          phone: '[REDACTED]',
          shipping_address: '[REDACTED]',
        }),
      }),
    );
  });

  it('records navigation breadcrumbs only when the route changes', () => {
    const Sentry = require('@sentry/react-native');
    const { trackSentryRoute } = require('@/lib/sentry');

    trackSentryRoute('(tabs)/library');
    trackSentryRoute('(tabs)/library');
    trackSentryRoute('(tabs)/exchange');

    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(2);
    expect(Sentry.setTag).toHaveBeenNthCalledWith(1, 'route', '(tabs)/library');
    expect(Sentry.setTag).toHaveBeenNthCalledWith(2, 'route', '(tabs)/exchange');
  });

  it('sends the verification event only once when explicitly enabled', () => {
    process.env.EXPO_PUBLIC_SENTRY_TEST_EVENT = 'true';

    const Sentry = require('@sentry/react-native');
    const { maybeSendSentryVerificationEvent } = require('@/lib/sentry');

    maybeSendSentryVerificationEvent();
    maybeSendSentryVerificationEvent();

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'BookTalks Sentry verification event' }),
      expect.objectContaining({
        tags: expect.objectContaining({ verification: 'true' }),
      }),
    );
  });
});