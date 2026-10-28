jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { organisingGateway, organisingKeys, OrganisingError, validateOrganisingName, setMembershipSerially } from '../../organising/organisingGateway';
import { useOrganising } from '../../organising/useOrganising';

const entity = { id: 'label', user_id: 'actor', name: 'Borrowed', created_at: '2026-10-25T00:00:00Z', updated_at: '2026-10-25T00:00:00.123456Z' };
const queries: any[] = [];
let reply: (q: any) => any;
function builder(table: string) {
  const q: any = { table, filters: {}, window: [0, 999] };
  for (const op of ['select', 'insert', 'update', 'delete', 'order', 'abortSignal', 'single', 'maybeSingle', 'ilike', 'setHeader']) q[op] = jest.fn((...args) => { q[op + 'Args'] = args; return q; });
  q.eq = jest.fn((key, value) => { q.filters[key] = value; return q; });
  q.range = jest.fn((from, to) => { q.window = [from, to]; return q; });
  q.then = (resolve: any, reject: any) => Promise.resolve().then(() => reply(q)).then(resolve, reject);
  queries.push(q); return q;
}
beforeEach(() => {
  queries.length = 0; jest.clearAllMocks();
  useAuthStore.setState({ session: { user: { id: 'actor' }, access_token: 'actor-token' } as any });
  (supabase.from as jest.Mock).mockImplementation(builder);
  reply = q => ({ data: q.updateArgs ? { ...entity, name: q.updateArgs[0].name } : entity, error: null });
});
afterEach(() => useAuthStore.setState({ session: null }));

it('trims and counts code points without deciding server uniqueness', () => {
  expect(validateOrganisingName('  😀'.repeat(1).trim(), 'labels').name).toBe('😀');
  expect(validateOrganisingName('😀'.repeat(24), 'labels').error).toBeUndefined();
  expect(validateOrganisingName('😀'.repeat(25), 'labels').error).toContain('24');
  expect(validateOrganisingName(' \t ', 'collections').error).toContain('collection');
  expect(validateOrganisingName('X'.repeat(40), 'collections').error).toBeUndefined();
});
it('creates with only the name and conditional rename preserves exact server timestamp', async () => {
  expect(await organisingGateway.create('actor', 'labels', ' Borrowed ')).toEqual(entity);
  expect(queries[0].insertArgs).toEqual([{ name: 'Borrowed' }]);
  await organisingGateway.rename('actor', 'labels', entity, 'Lent');
  expect(queries[1].updateArgs).toEqual([{ name: 'Lent' }]);
  expect(queries[1].filters).toEqual({ user_id: 'actor', id: 'label', updated_at: entity.updated_at });
  expect(queries[1].select).toHaveBeenCalled();
});
it('reads back an unmatched rename and distinguishes a newer name from deletion', async () => {
  const current = { ...entity, name: 'Elsewhere', updated_at: '2026-10-26' };
  reply = q => ({ data: q.updateArgs ? null : current, error: null });
  await expect(organisingGateway.rename('actor', 'labels', entity, 'Lent')).rejects.toMatchObject({ kind: 'conflict', current });
  expect(queries[1].filters).toEqual({ user_id: 'actor', id: 'label' });
  reply = () => ({ data: null, error: null });
  await expect(organisingGateway.rename('actor', 'labels', entity, 'Lent')).rejects.toMatchObject({ kind: 'missing' });
});
it('binds the request to the captured account token instead of a later global session', async () => {
  await organisingGateway.create('actor', 'labels', 'Borrowed');
  expect(queries[0].setHeader).toHaveBeenCalledWith('Authorization', 'Bearer actor-token');
});
it('allows duplicates only for memberships, and maps name-check errors separately from caps', async () => {
  reply = () => ({ data: null, error: { code: '23505', message: 'duplicate' } });
  await expect(organisingGateway.create('actor', 'labels', 'Borrowed')).rejects.toMatchObject({ kind: 'duplicate', message: 'You already have a label called “Borrowed”.' });
  await expect(organisingGateway.rename('actor', 'labels', entity, 'Lent')).rejects.toMatchObject({ kind: 'duplicate', message: 'You already have a label called “Lent”.' });
  await expect(organisingGateway.membership('actor', 'labels', 'book', 'label', true)).resolves.toBeUndefined();
  expect(queries[2].insertArgs).toEqual([{ user_book_id: 'book', label_id: 'label' }]);
  reply = () => ({ error: { code: '23514', message: 'user_library_labels_name_check' } });
  await expect(organisingGateway.create('actor', 'labels', 'Borrowed')).rejects.toMatchObject({ kind: 'invalid' });
  reply = () => ({ error: { code: '23514', message: 'library_label_limit' } });
  await expect(organisingGateway.create('actor', 'labels', 'Borrowed')).rejects.toMatchObject({ kind: 'limit' });
});
it('pages assignments on raw lengths with a stable unique order and rejects foreign rows', async () => {
  const rows = Array.from({ length: 2000 }, (_, i) => ({ user_id: i === 2 ? 'other' : 'actor', user_book_id: `b${i}`, label_id: 'label', created_at: entity.created_at }));
  reply = q => ({ data: rows.slice(q.window[0], q.window[1] + 1), error: null });
  const data = await organisingGateway.memberships('actor', 'labels');
  expect(data).toHaveLength(1999);
  expect(queries.map(q => q.window)).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  for (const q of queries) {
    expect(q.filters).toEqual({ user_id: 'actor' });
    expect(q.order.mock.calls).toEqual([['created_at', { ascending: true }], ['user_book_id', { ascending: true }], ['label_id', { ascending: true }]]);
  }
});
it.each(['collections', 'labels'] as const)('checks stale membership after a duplicate add in %s before refetch completes', async kind => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(organisingKeys.entities('actor', kind), [entity]);
  client.setQueryData(organisingKeys.members('actor', kind), []);
  let blockRefresh = false;
  let finishRefresh!: (value: { data: never[]; error: null }) => void;
  const backgroundReply = new Promise(resolve => { finishRefresh = resolve; });
  reply = q => q.insertArgs ? { data: null, error: { code: '23505', message: 'duplicate' } }
    : blockRefresh ? backgroundReply : { data: q.table === 'user_note_collections' || q.table === 'user_library_labels' ? [entity] : [], error: null };
  const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children);
  const view = renderHook(() => useOrganising('actor', kind), { wrapper });
  try {
    await waitFor(() => expect(view.result.current.members.isFetching).toBe(false));
    expect(view.result.current.members.data).toEqual([]);
    blockRefresh = true;
    await act(async () => { await view.result.current.membership('note', 'label', true); });
    await waitFor(() => expect(view.result.current.members.data).toEqual([
      expect.objectContaining({ user_id: 'actor', target_id: 'note', entity_id: 'label' }),
    ]));
    expect(view.result.current.members.isFetching).toBe(true);
  } finally {
    view.unmount();
    finishRefresh({ data: [], error: null });
    client.clear();
  }
});
it('keeps an uncertain creation visibly unknown and fences a late account response', async () => {
  reply = () => { throw new TypeError('network'); };
  await expect(organisingGateway.create('actor', 'labels', 'Borrowed')).rejects.toMatchObject({ kind: 'unknown' });
  reply = () => { useAuthStore.setState({ session: { user: { id: 'other' } } as any }); return { data: entity, error: null }; };
  await expect(organisingGateway.create('actor', 'labels', 'Borrowed')).rejects.toMatchObject({ kind: 'identity' });
});
it('serializes membership intents and does not lose a remove queued behind an add', async () => {
  const events: string[] = []; let release!: () => void;
  const first = setMembershipSerially('actor', 'labels', 'book', 'label', async () => { events.push('add'); await new Promise<void>(resolve => { release = resolve; }); });
  const second = setMembershipSerially('actor', 'labels', 'book', 'label', async () => { events.push('remove'); });
  await Promise.resolve(); await Promise.resolve();
  expect(events).toEqual(['add']); release(); await Promise.all([first, second]);
  expect(events).toEqual(['add', 'remove']);
});
it('uses only collection/note IDs on insertion and filters the owner and both IDs on removal', async () => {
  reply = () => ({ data: { user_id: 'actor', collection_id: 'group', note_id: 'note', added_at: '2026-10-25' }, error: null });
  expect(await organisingGateway.membership('actor', 'collections', 'note', 'group', true)).toEqual({ user_id: 'actor', entity_id: 'group', target_id: 'note', added_at: '2026-10-25' });
  expect(queries[0].table).toBe('user_note_collection_items');
  expect(queries[0].insertArgs).toEqual([{ collection_id: 'group', note_id: 'note' }]);
  await organisingGateway.membership('actor', 'collections', 'note', 'group', false);
  expect(queries[1].filters).toEqual({ user_id: 'actor', note_id: 'note', collection_id: 'group' });
});
