jest.mock('@/lib/supabase');

import { supabase } from '@/lib/supabase';
import { creditService } from '../creditService';

function mockQuery(response: Record<string, unknown>) {
  const builder: any = {};
  ['select', 'eq', 'order', 'range', 'maybeSingle'].forEach((method) => {
    builder[method] = jest.fn(() => builder);
  });
  builder.then = jest.fn((resolve: (value: unknown) => unknown) => resolve(response));
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('creditService', () => {
  it('fetches one extra credit event to infer pagination without an exact count', async () => {
    const builder = mockQuery({
      data: [
        { id: 'event-1', user_id: 'reader-1', amount: 1, event_type: 'signup_bonus', created_at: '2026-05-24T00:00:00.000Z' },
        { id: 'event-2', user_id: 'reader-1', amount: -1, event_type: 'borrow_spent', created_at: '2026-05-23T00:00:00.000Z' },
        { id: 'event-3', user_id: 'reader-1', amount: 1, event_type: 'lend_completed', created_at: '2026-05-22T00:00:00.000Z' },
      ],
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(builder);

    const result = await creditService.getCreditHistory('reader-1', 2, 0);

    expect(supabase.from).toHaveBeenCalledWith('credit_events');
    expect(builder.select).toHaveBeenCalledWith('*');
    expect(builder.range).toHaveBeenCalledWith(0, 2);
    expect(result.events).toHaveLength(2);
    expect(result.hasMore).toBe(true);
  });
});
