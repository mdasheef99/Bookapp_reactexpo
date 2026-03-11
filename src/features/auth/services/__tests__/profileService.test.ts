import { profileService } from '../profileService';

jest.mock('@/lib/supabase');

import { supabase } from '@/lib/supabase';

function mockQuery(response: Record<string, unknown>) {
  const builder: any = {};
  ['select', 'eq', 'in', 'maybeSingle'].forEach((method) => {
    builder[method] = jest.fn(() => builder);
  });
  builder.then = jest.fn((resolve: (value: unknown) => unknown) => resolve(response));
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('profileService', () => {
  it('reads full profiles from user_profiles by auth user_id', async () => {
    const builder = mockQuery({
      data: { id: 'profile-1', user_id: 'user-1', display_name: 'Reader One', account_type: 'admin', membership_tier: 'pro_plus' },
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(builder);

    const result = await profileService.getProfile('user-1');

    expect(supabase.from).toHaveBeenCalledWith('user_profiles');
    expect(builder.select).toHaveBeenCalledWith('*');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.maybeSingle).toHaveBeenCalled();
    expect(result?.account_type).toBe('admin');
  });

  it('reads profile summaries from user_profiles with the summary column contract', async () => {
    const builder = mockQuery({
      data: { id: 'profile-1', user_id: 'user-1', display_name: 'Reader One', username: 'readerone', avatar_url: null, trust_score: 4.8, city: 'Lagos', membership_tier: 'pro' },
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(builder);

    const result = await profileService.getProfileSummary('user-1');

    expect(supabase.from).toHaveBeenCalledWith('user_profiles');
    expect(builder.select).toHaveBeenCalledWith('id, user_id, display_name, username, avatar_url, trust_score, city, membership_tier');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result?.membership_tier).toBe('pro');
    expect(result?.username).toBe('readerone');
  });

  it('batch reads profile summaries from user_profiles using user_id filters', async () => {
    const builder = mockQuery({
      data: [{ id: 'profile-1', user_id: 'user-1', display_name: 'Reader One', username: 'readerone', avatar_url: null, trust_score: 4.8, city: 'Lagos', membership_tier: 'free' }],
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(builder);

    const result = await profileService.getProfileSummaries(['user-1']);

    expect(supabase.from).toHaveBeenCalledWith('user_profiles');
    expect(builder.in).toHaveBeenCalledWith('user_id', ['user-1']);
    expect(result).toHaveLength(1);
  });

  it('returns early for empty batch summary reads without hitting Supabase', async () => {
    const result = await profileService.getProfileSummaries([]);

    expect(result).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});