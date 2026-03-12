jest.mock('@/lib/supabase');
jest.mock('@/features/auth/services/profileService', () => ({
  profileService: {
    getProfileSummary: jest.fn(),
  },
}));

import * as Sentry from '@sentry/react-native';
import { supabase } from '@/lib/supabase';
import { listingsService } from '../listingsService';

function mockQuery(response: Record<string, unknown>) {
  const builder: any = {};
  ['select', 'eq', 'order', 'range', 'contains', 'single'].forEach((method) => {
    builder[method] = jest.fn(() => builder);
  });
  builder.then = jest.fn((resolve: (value: unknown) => unknown) => resolve(response));
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listingsService Sentry instrumentation', () => {
  it('captures browse listing failures with safe context and rethrows', async () => {
    const error = new Error('Browse failed');
    const builder = mockQuery({ data: null, error });
    (supabase.from as jest.Mock).mockReturnValueOnce(builder);

    await expect(
      listingsService.browseListings('Delhi', { deliveryOption: 'meetup', limit: 12, offset: 4 }),
    ).rejects.toBe(error);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: expect.objectContaining({
          area: 'exchange',
          action: 'browse_listings_failed',
          feature: 'exchange',
          service: 'listingsService',
        }),
        extra: expect.objectContaining({
          operation: 'browseListings',
          delivery_option: 'meetup',
          limit: 12,
          offset: 4,
        }),
      }),
    );
  });

  it('captures listing detail failures with safe context and rethrows', async () => {
    const error = new Error('Detail failed');
    const builder = mockQuery({ data: null, error });
    (supabase.from as jest.Mock).mockReturnValueOnce(builder);

    await expect(listingsService.getListingDetails('listing-123')).rejects.toBe(error);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: expect.objectContaining({
          area: 'exchange',
          action: 'get_listing_details_failed',
          feature: 'exchange',
          service: 'listingsService',
        }),
        extra: expect.objectContaining({
          operation: 'getListingDetails',
          listing_id: 'listing-123',
        }),
      }),
    );
  });
});