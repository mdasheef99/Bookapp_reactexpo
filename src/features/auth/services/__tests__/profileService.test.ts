import { profileService } from '../profileService';

jest.mock('@/lib/supabase');

import { supabase } from '@/lib/supabase';

function mockQuery(response: Record<string, unknown>) {
  const builder: any = {};
  ['select', 'insert', 'update', 'eq', 'in', 'maybeSingle'].forEach((method) => {
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
    expect(builder.select).toHaveBeenCalledWith('id, user_id, display_name, username, avatar_url, city, email, referral_code, account_type, is_verified_author, membership_tier, trust_score, created_at, updated_at');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.maybeSingle).toHaveBeenCalled();
    expect(result?.account_type).toBe('admin');
  });

  it('checks profile existence with an id-only query', async () => {
    const builder = mockQuery({
      data: { id: 'profile-1' },
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(builder);

    const result = await profileService.hasProfile('user-1');

    expect(supabase.from).toHaveBeenCalledWith('user_profiles');
    expect(builder.select).toHaveBeenCalledWith('id');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.maybeSingle).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('reads profile summaries from the public profile summary surface', async () => {
    const builder = mockQuery({
      data: { id: 'profile-1', user_id: 'user-1', display_name: 'Reader One', username: 'readerone', avatar_url: null, trust_score: 4.8, city: 'Lagos', membership_tier: 'pro' },
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(builder);

    const result = await profileService.getProfileSummary('user-1');

    expect(supabase.from).toHaveBeenCalledWith('profile_public_summaries');
    expect(builder.select).toHaveBeenCalledWith('id, user_id, display_name, username, avatar_url, trust_score, city, membership_tier');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result?.membership_tier).toBe('pro');
    expect(result?.username).toBe('readerone');
  });

  it('batch reads profile summaries from the public profile summary surface using user_id filters', async () => {
    const builder = mockQuery({
      data: [{ id: 'profile-1', user_id: 'user-1', display_name: 'Reader One', username: 'readerone', avatar_url: null, trust_score: 4.8, city: 'Lagos', membership_tier: 'free' }],
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(builder);

    const result = await profileService.getProfileSummaries(['user-1']);

    expect(supabase.from).toHaveBeenCalledWith('profile_public_summaries');
    expect(builder.in).toHaveBeenCalledWith('user_id', ['user-1']);
    expect(result).toHaveLength(1);
  });

  it('returns early for empty batch summary reads without hitting Supabase', async () => {
    const result = await profileService.getProfileSummaries([]);

    expect(result).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('updates editable profile fields by auth user_id', async () => {
    const builder = mockQuery({
      data: { id: 'profile-1', user_id: 'user-1', display_name: 'Reader One', username: 'reader_one', city: 'Mumbai', avatar_url: null },
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(builder);

    const result = await profileService.updateProfile('user-1', {
      display_name: 'Reader One',
      username: 'Reader_One',
      city: 'Mumbai',
    });

    expect(supabase.from).toHaveBeenCalledWith('user_profiles');
    expect(builder.update).toHaveBeenCalledWith({
      display_name: 'Reader One',
      username: 'reader_one',
      city: 'Mumbai',
      updated_at: expect.any(String),
    });
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.select).toHaveBeenCalledWith('id, user_id, display_name, username, avatar_url, city, email, referral_code, account_type, is_verified_author, membership_tier, trust_score, created_at, updated_at');
    expect(builder.maybeSingle).toHaveBeenCalled();
    expect(result?.username).toBe('reader_one');
  });

  it('uploads a profile avatar and stores the public URL on the profile', async () => {
    const blob = new Blob(['avatar'], { type: 'image/png' });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: jest.fn().mockResolvedValue(blob) }) as jest.Mock;
    const upload = jest.fn().mockResolvedValue({ error: null });
    const getPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example/avatar.png' } });
    (supabase as any).storage = {
      from: jest.fn(() => ({ upload, getPublicUrl })),
    };
    const builder = mockQuery({
      data: { id: 'profile-1', user_id: 'user-1', display_name: 'Reader One', avatar_url: 'https://cdn.example/avatar.png' },
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(builder);

    const result = await profileService.uploadAvatar('user-1', 'file:///avatar.png');

    expect((supabase as any).storage.from).toHaveBeenCalledWith('profile-avatars');
    expect(upload).toHaveBeenCalledWith('user-1/avatar.png', blob, { contentType: 'image/png', upsert: true });
    expect(builder.update).toHaveBeenCalledWith({
      avatar_url: 'https://cdn.example/avatar.png',
      updated_at: expect.any(String),
    });
    expect(builder.select).not.toHaveBeenCalled();
    expect(builder.maybeSingle).not.toHaveBeenCalled();
    expect(result).toBe('https://cdn.example/avatar.png');
  });

  it('fails avatar upload early when the selected photo cannot be read', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, blob: jest.fn() }) as jest.Mock;
    const upload = jest.fn();
    (supabase as any).storage = {
      from: jest.fn(() => ({ upload })),
    };

    await expect(profileService.uploadAvatar('user-1', 'file:///missing-avatar.png')).rejects.toThrow(
      'Could not read the selected profile photo.'
    );

    expect(upload).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('does not persist avatar_url when storage cannot produce a public URL', async () => {
    const blob = new Blob(['avatar'], { type: 'image/jpeg' });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: jest.fn().mockResolvedValue(blob) }) as jest.Mock;
    const upload = jest.fn().mockResolvedValue({ error: null });
    const getPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl: '' } });
    (supabase as any).storage = {
      from: jest.fn(() => ({ upload, getPublicUrl })),
    };

    await expect(profileService.uploadAvatar('user-1', 'file:///avatar.jpg')).rejects.toThrow(
      'Could not create a public URL for the profile photo.'
    );

    expect(upload).toHaveBeenCalledWith('user-1/avatar.jpg', blob, { contentType: 'image/jpeg', upsert: true });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
