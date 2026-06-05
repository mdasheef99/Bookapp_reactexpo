jest.mock('@/lib/supabase');
jest.mock('@/features/auth/services/profileService', () => ({
  profileService: {
    getProfileSummary: jest.fn(),
    getProfileSummaries: jest.fn(),
  },
}));

import * as Sentry from '@sentry/react-native';
import { supabase } from '@/lib/supabase';
import { transactionsService } from '../transactionsService';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('transactionsService Sentry instrumentation', () => {
  it.each([
    {
      label: 'requestTransaction',
      rpc: 'request_transaction',
      action: 'request_transaction_failed',
      run: () => transactionsService.requestTransaction({ listingId: 'listing-1', borrowerId: 'user-1', deliveryType: 'meetup' }),
      expectedExtra: expect.objectContaining({ listing_id: 'listing-1', delivery_type: 'meetup', has_message: false, shipping_details_provided: false }),
    },
    {
      label: 'approveTransaction',
      rpc: 'approve_transaction',
      action: 'approve_transaction_failed',
      run: () => transactionsService.approveTransaction('txn-1', 'user-1'),
      expectedExtra: expect.objectContaining({ transaction_id: 'txn-1' }),
    },
    {
      label: 'declineTransaction',
      rpc: 'decline_transaction',
      action: 'decline_transaction_failed',
      run: () => transactionsService.declineTransaction('txn-2', 'user-1'),
      expectedExtra: expect.objectContaining({ transaction_id: 'txn-2' }),
    },
    {
      label: 'cancelTransaction',
      rpc: 'cancel_transaction',
      action: 'cancel_transaction_failed',
      run: () => transactionsService.cancelTransaction('txn-3', 'user-1'),
      expectedExtra: expect.objectContaining({ transaction_id: 'txn-3' }),
    },
    {
      label: 'completeTransaction',
      rpc: 'complete_transaction',
      action: 'complete_transaction_failed',
      run: () => transactionsService.completeTransaction('txn-4', 'user-1'),
      expectedExtra: expect.objectContaining({ transaction_id: 'txn-4' }),
    },
    {
      label: 'transitionStatus',
      rpc: 'transition_transaction_status',
      action: 'transition_transaction_status_failed',
      run: () => transactionsService.transitionStatus('txn-5', 'delivered', 'user-1'),
      expectedExtra: expect.objectContaining({ transaction_id: 'txn-5', new_status: 'delivered' }),
    },
    {
      label: 'fileDispute',
      rpc: 'file_transaction_dispute',
      action: 'file_transaction_dispute_failed',
      run: () => transactionsService.fileDispute({ transactionId: 'txn-6', actorId: 'user-1', reason: 'Book damaged' }),
      expectedExtra: expect.objectContaining({ transaction_id: 'txn-6', has_reason: true }),
    },
  ])('captures $label failures with safe context and rethrows', async ({ rpc, action, run, expectedExtra }) => {
    const error = new Error(`${rpc} failed`);
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error });

    await expect(run()).rejects.toBe(error);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: expect.objectContaining({
          area: 'exchange',
          action,
          feature: 'exchange',
          service: 'transactionsService',
          rpc,
        }),
        extra: expectedExtra,
      }),
    );
  });

  it('files a transaction dispute through the dispute RPC with trimmed metadata', async () => {
    const saved = { id: 'txn-6', status: 'disputed' };
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: saved, error: null });

    const result = await transactionsService.fileDispute({
      transactionId: 'txn-6',
      actorId: 'user-1',
      reason: '  Book was damaged at meetup  ',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('file_transaction_dispute', {
      p_transaction_id: 'txn-6',
      p_actor_id: 'user-1',
      p_reason: 'Book was damaged at meetup',
    });
    expect(result).toEqual(saved);
  });

  it('passes a selected pickup venue through the request transaction RPC', async () => {
    const saved = { id: 'txn-venue', pickup_venue_id: 'venue-1' };
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: saved, error: null });

    const result = await transactionsService.requestTransaction({
      listingId: 'listing-1',
      borrowerId: 'user-1',
      deliveryType: 'meetup',
      pickupVenueId: 'venue-1',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('request_transaction', {
      p_listing_id: 'listing-1',
      p_borrower_id: 'user-1',
      p_delivery_type: 'meetup',
      p_message: null,
      p_shipping_address_id: null,
      p_pickup_venue_id: 'venue-1',
    });
    expect(result).toEqual(saved);
  });
});
