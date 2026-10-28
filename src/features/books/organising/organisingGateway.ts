import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { LABEL_SUGGESTIONS } from '../labels/labelsContract';

export type OrganisingKind = 'labels' | 'collections';
export interface OrganisingEntity { id: string; user_id: string; name: string; created_at: string; updated_at: string }
export interface OrganisingMembership { user_id: string; entity_id: string; target_id: string; added_at: string }
export const ORGANISING_LIMIT = 25;
export const organisingKeys = {
  root: (actor: string, kind: OrganisingKind) => ['library-organising', actor, kind] as const,
  entities: (actor: string, kind: OrganisingKind) => ['library-organising', actor, kind, 'entities'] as const,
  members: (actor: string, kind: OrganisingKind) => ['library-organising', actor, kind, 'members'] as const,
  suggestions: (actor: string) => ['library-organising', actor, 'labels', 'suggestions'] as const,
};
const domains = {
  labels: { table: 'user_library_labels', links: 'user_book_labels', entity: 'label_id', target: 'user_book_id', time: 'created_at', noun: 'label', length: 24, cap: 'library_label_limit' },
  collections: { table: 'user_note_collections', links: 'user_note_collection_items', entity: 'collection_id', target: 'note_id', time: 'added_at', noun: 'collection', length: 40, cap: 'library_collection_limit' },
} as const;
export class OrganisingError extends Error {
  constructor(public kind: 'unknown' | 'conflict' | 'missing' | 'duplicate' | 'limit' | 'invalid' | 'identity' | 'denied', message: string, public current?: OrganisingEntity) { super(message); }
}
let identityEpoch = 0;
useAuthStore.subscribe((state, previous) => { if (state.session?.user.id !== previous.session?.user.id) identityEpoch++; });
export function captureOrganisingActor(actor: string) {
  const epoch = identityEpoch;
  return () => {
    if (!actor || epoch !== identityEpoch || useAuthStore.getState().session?.user.id !== actor) throw new OrganisingError('identity', 'Your account changed. Reopen this screen to continue.');
  };
}
export function validateOrganisingName(input: string, kind: OrganisingKind) {
  const name = input.trim(), domain = domains[kind];
  const error = !name ? `Enter a ${domain.noun} name` : [...name].length > domain.length ? `Use ${domain.length} characters or fewer` : undefined;
  return { name, error };
}
function entity(value: unknown, actor: string): value is OrganisingEntity {
  if (!value || typeof value !== 'object') return false;
  const row = value as OrganisingEntity;
  return row.user_id === actor && !!row.id && typeof row.name === 'string' && typeof row.created_at === 'string' && typeof row.updated_at === 'string';
}
function databaseError(error: { code?: string; message?: string }, kind: OrganisingKind, name?: string) {
  const domain = domains[kind], message = error.message ?? '';
  if (error.code === '23505') return new OrganisingError('duplicate', name ? `You already have a ${domain.noun} called “${name}”.` : `You already have a ${domain.noun} with that name.`);
  if (error.code === '23514' && message.includes(domain.cap)) return new OrganisingError('limit', `You have ${ORGANISING_LIMIT} ${kind}. Delete one to create another.`);
  if (error.code === '23514') return new OrganisingError('invalid', `This ${domain.noun} wasn't saved. Check the name and try again.`);
  if (error.code === '23503') return new OrganisingError('missing', `This ${domain.noun}, book or note is no longer available. Refresh and try again.`);
  if (['42501', '23502', '55000'].includes(error.code ?? '')) return new OrganisingError('denied', `Couldn't save this ${domain.noun}. Refresh and try again.`);
  return new OrganisingError('unknown', `Couldn't confirm whether this ${domain.noun} was saved. Refresh before trying again.`);
}
async function request<T>(actor: string, run: (signal: AbortSignal) => PromiseLike<T> & { setHeader: (name: string, value: string) => unknown }, supplied?: AbortSignal): Promise<T> {
  const guard = captureOrganisingActor(actor); guard();
  const token = useAuthStore.getState().session?.access_token;
  if (!token) throw new OrganisingError('identity', 'Sign in again to continue.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (supplied?.aborted) abort();
  supplied?.addEventListener('abort', abort);
  const timer = setTimeout(abort, 15_000);
  try {
    // Supabase's shared client resolves its session asynchronously. Bind this
    // request so an account switch cannot create a name under the next account.
    const query = run(controller.signal);
    query.setHeader('Authorization', `Bearer ${token}`);
    const result = await query; guard(); return result;
  }
  catch (error) { guard(); if (error instanceof OrganisingError) throw error; throw new OrganisingError('unknown', "Couldn't confirm the result. Refresh before trying again."); }
  finally { clearTimeout(timer); supplied?.removeEventListener('abort', abort); }
}
const pendingMemberships = new Map<string, Promise<unknown>>();
export function setMembershipSerially<T>(actor: string, kind: OrganisingKind, target: string, id: string, run: () => Promise<T>): Promise<T> {
  const key = JSON.stringify([actor, kind, target, id]), guard = captureOrganisingActor(actor);
  const previous = pendingMemberships.get(key);
  const operation = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(() => { guard(); return run(); });
  pendingMemberships.set(key, operation);
  const clear = () => { if (pendingMemberships.get(key) === operation) pendingMemberships.delete(key); };
  void operation.then(clear, clear);
  return operation;
}
export const organisingGateway = {
  async entities(actor: string, kind: OrganisingKind, signal?: AbortSignal): Promise<OrganisingEntity[]> {
    const { data, error } = await request(actor, s => supabase.from(domains[kind].table).select('id,user_id,name,created_at,updated_at').eq('user_id', actor)
      .order(kind === 'labels' ? 'name' : 'created_at', { ascending: kind === 'labels' }).order('id', { ascending: true }).abortSignal(s), signal);
    if (error) throw databaseError(error, kind);
    return (data ?? []).filter((row: unknown) => entity(row, actor)) as OrganisingEntity[];
  },
  async memberships(actor: string, kind: OrganisingKind, signal?: AbortSignal): Promise<OrganisingMembership[]> {
    const domain = domains[kind], rows: OrganisingMembership[] = [], guard = captureOrganisingActor(actor);
    // PostgREST caps each response at PAGE_SIZE rows; the raw length is the stop condition.
    const PAGE_SIZE = 1000;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      guard();
      const { data, error } = await request(actor, s => supabase.from(domain.links).select('*').eq('user_id', actor)
        .order(domain.time, { ascending: true }).order(domain.target, { ascending: true }).order(domain.entity, { ascending: true }).range(offset, offset + PAGE_SIZE - 1).abortSignal(s), signal);
      if (error) throw databaseError(error, kind);
      const page = data ?? [];
      for (const row of page) if (row.user_id === actor && typeof row[domain.entity] === 'string' && typeof row[domain.target] === 'string') {
        rows.push({ user_id: actor, entity_id: row[domain.entity], target_id: row[domain.target], added_at: row[domain.time] });
      }
      if (page.length < PAGE_SIZE) return rows;
    }
  },
  async suggestions(actor: string, signal?: AbortSignal): Promise<string[]> {
    const available = await Promise.all(LABEL_SUGGESTIONS.map(async name => {
      const { data, error } = await request(actor, s => supabase.from('user_library_labels').select('id').eq('user_id', actor).ilike('name', name).abortSignal(s), signal);
      if (error) throw databaseError(error, 'labels');
      return data?.length ? null : name;
    }));
    return available.filter((name): name is typeof LABEL_SUGGESTIONS[number] => name !== null);
  },
  async create(actor: string, kind: OrganisingKind, input: string): Promise<OrganisingEntity> {
    const { name, error: invalid } = validateOrganisingName(input, kind);
    if (invalid) throw new OrganisingError('invalid', invalid);
    const { data, error } = await request(actor, s => supabase.from(domains[kind].table).insert({ name }).select('id,user_id,name,created_at,updated_at').abortSignal(s).single());
    if (error) throw databaseError(error, kind, name);
    if (!entity(data, actor) || data.name !== name) throw new OrganisingError('unknown', 'Creation was not confirmed. Refresh and choose an existing item before attaching.');
    return data;
  },
  async rename(actor: string, kind: OrganisingKind, original: OrganisingEntity, input: string): Promise<OrganisingEntity> {
    if (original.user_id !== actor) throw new OrganisingError('identity', 'This item belongs to another account.');
    const { name, error: invalid } = validateOrganisingName(input, kind);
    if (invalid) throw new OrganisingError('invalid', invalid);
    const { data, error } = await request(actor, s => supabase.from(domains[kind].table).update({ name }).eq('user_id', actor).eq('id', original.id)
      .eq('updated_at', original.updated_at).select('id,user_id,name,created_at,updated_at').abortSignal(s).maybeSingle());
    if (error) throw databaseError(error, kind, name);
    if (!data) {
      const { data: current, error: readError } = await request(actor, s => supabase.from(domains[kind].table).select('id,user_id,name,created_at,updated_at')
        .eq('user_id', actor).eq('id', original.id).abortSignal(s).maybeSingle());
      if (readError) throw databaseError(readError, kind);
      if (!current) throw new OrganisingError('missing', `This ${domains[kind].noun} was deleted. Your text has been kept.`);
      if (!entity(current, actor) || current.id !== original.id) throw new OrganisingError('unknown', 'Could not refresh this item. Your text has been kept.');
      throw new OrganisingError('conflict', `This ${domains[kind].noun} is now called “${current.name}”. Your text has been kept. Review it before saving again.`, current);
    }
    if (!entity(data, actor) || data.id !== original.id || data.name !== name) throw new OrganisingError('unknown', 'The rename was not confirmed. Refresh before trying again.');
    return data;
  },
  async remove(actor: string, kind: OrganisingKind, id: string): Promise<void> {
    if (!id) throw new OrganisingError('missing', 'This item is unavailable.');
    const { error } = await request(actor, s => supabase.from(domains[kind].table).delete().eq('user_id', actor).eq('id', id).abortSignal(s));
    if (error) throw databaseError(error, kind);
  },
  async membership(actor: string, kind: OrganisingKind, target: string, id: string, present: boolean): Promise<OrganisingMembership | undefined> {
    if (!target || !id) throw new OrganisingError('missing', 'This book, note or grouping is unavailable.');
    const domain = domains[kind];
    const { data, error } = await request(actor, s => (present
      ? supabase.from(domain.links).insert({ [domain.target]: target, [domain.entity]: id }).select('*').abortSignal(s).maybeSingle()
      : supabase.from(domain.links).delete().eq('user_id', actor).eq(domain.target, target).eq(domain.entity, id).abortSignal(s)));
    if (error && !(present && error.code === '23505')) throw databaseError(error, kind);
    if (present && data && data.user_id === actor && data[domain.target] === target && data[domain.entity] === id) {
      return { user_id: actor, target_id: target, entity_id: id, added_at: data[domain.time] };
    }
  },
};
