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
});