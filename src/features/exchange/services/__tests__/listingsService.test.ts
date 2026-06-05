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
  ['select', 'insert', 'update', 'delete', 'eq', 'order', 'range', 'contains', 'single'].forEach((method) => {
    builder[method] = jest.fn(() => builder);
  });
  builder.then = jest.fn((resolve: (value: unknown) => unknown) => resolve(response));
  return builder;
}

function mockListingPhotoStorage() {
  const upload = jest.fn(() => Promise.resolve({ error: null }));
  const getPublicUrl = jest.fn((path: string) => ({
    data: { publicUrl: `https://cdn.test/storage/v1/object/public/listing-photos/${path}` },
  }));
  const remove = jest.fn(() => Promise.resolve({ error: null }));

  (supabase as any).storage = {
    from: jest.fn(() => ({ upload, getPublicUrl, remove })),
  };

  return { upload, getPublicUrl, remove };
}

beforeEach(() => {
  jest.clearAllMocks();
  (global as any).fetch = jest.fn(() => Promise.resolve({
    blob: () => Promise.resolve({ type: 'image/jpeg' }),
  }));
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

describe('listingsService.createListing', () => {
  it('creates the draft listing as paused with schema-valid photo placeholders, then activates it with uploaded URLs', async () => {
    const insertBuilder = mockQuery({
      data: { id: 'listing-1' },
      error: null,
    });
    const updateBuilder = mockQuery({
      data: {
        id: 'listing-1',
        photos: [
          'https://cdn.test/storage/v1/object/public/listing-photos/owner-1/listing-1/0.jpg',
          'https://cdn.test/storage/v1/object/public/listing-photos/owner-1/listing-1/1.jpg',
        ],
        status: 'active',
      },
      error: null,
    });
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(insertBuilder)
      .mockReturnValueOnce(updateBuilder);
    mockListingPhotoStorage();

    const listing = await listingsService.createListing({
      userBookId: 'user-book-1',
      ownerId: 'owner-1',
      bookId: 'book-1',
      condition: 'good',
      photoUris: ['file://cover-a.jpg', 'file://cover-b.jpg'],
      deliveryOptions: ['meetup'],
      city: 'Delhi',
    });

    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      photos: ['uploading', 'uploading'],
      status: 'paused',
    }));
    expect(updateBuilder.update).toHaveBeenCalledWith({
      photos: [
        'https://cdn.test/storage/v1/object/public/listing-photos/owner-1/listing-1/0.jpg',
        'https://cdn.test/storage/v1/object/public/listing-photos/owner-1/listing-1/1.jpg',
      ],
      status: 'active',
    });
    expect(listing.status).toBe('active');
  });
});
