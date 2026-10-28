import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { captureOrganisingActor, OrganisingEntity, OrganisingKind, OrganisingMembership, organisingGateway, organisingKeys, setMembershipSerially } from './organisingGateway';

export function invalidateOrganising(client: QueryClient, actor: string) {
  void client.invalidateQueries({ queryKey: ['library-organising', actor] });
}
export function useOrganising(actor: string, kind: OrganisingKind, includeSuggestions = false) {
  const client = useQueryClient(), { isOffline } = useNetworkStatus();
  const entities = useQuery({ queryKey: organisingKeys.entities(actor, kind), queryFn: ({ signal }) => organisingGateway.entities(actor, kind, signal), enabled: !!actor, retry: false });
  const members = useQuery({ queryKey: organisingKeys.members(actor, kind), queryFn: ({ signal }) => organisingGateway.memberships(actor, kind, signal), enabled: !!actor, retry: false });
  const suggestions = useQuery({ queryKey: organisingKeys.suggestions(actor), queryFn: ({ signal }) => organisingGateway.suggestions(actor, signal), enabled: !!actor && kind === 'labels' && includeSuggestions, retry: false });
  const refresh = useCallback(() => {
    if (actor && !isOffline) {
      void entities.refetch(); void members.refetch();
      if (kind === 'collections') void client.invalidateQueries({ queryKey: ['library-note-deck', actor, 'index'] });
      if (kind === 'labels') void client.invalidateQueries({ queryKey: organisingKeys.suggestions(actor) });
    }
  }, [actor, isOffline, entities.refetch, members.refetch, kind, client]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => { if (!isOffline) refresh(); }, [isOffline, refresh]);
  useEffect(() => { const sub = AppState.addEventListener('change', state => { if (state === 'active') refresh(); }); return () => sub.remove(); }, [refresh]);
  const changed = () => {
    void client.invalidateQueries({ queryKey: organisingKeys.root(actor, kind) });
    if (kind === 'collections') void client.invalidateQueries({ queryKey: ['library-note-deck', actor] });
  };
  const create = async (name: string) => {
    const guard = captureOrganisingActor(actor);
    const saved = await organisingGateway.create(actor, kind, name); guard();
    await client.cancelQueries({ queryKey: organisingKeys.entities(actor, kind) }); guard();
    client.setQueryData<OrganisingEntity[]>(organisingKeys.entities(actor, kind), rows => [...(rows ?? []).filter(row => row.id !== saved.id), saved]); changed(); return saved;
  };
  const rename = async (original: OrganisingEntity, name: string) => {
    const guard = captureOrganisingActor(actor);
    const saved = await organisingGateway.rename(actor, kind, original, name); guard();
    await client.cancelQueries({ queryKey: organisingKeys.entities(actor, kind) }); guard();
    client.setQueryData<OrganisingEntity[]>(organisingKeys.entities(actor, kind), rows => rows?.map(row => row.id === saved.id ? saved : row)); changed(); return saved;
  };
  const remove = async (id: string) => {
    const guard = captureOrganisingActor(actor);
    await organisingGateway.remove(actor, kind, id); guard();
    await client.cancelQueries({ queryKey: organisingKeys.root(actor, kind) }); guard();
    client.setQueryData<OrganisingEntity[]>(organisingKeys.entities(actor, kind), rows => rows?.filter(row => row.id !== id));
    client.setQueryData<OrganisingMembership[]>(organisingKeys.members(actor, kind), rows => rows?.filter(row => row.entity_id !== id)); changed();
  };
  const membership = (target: string, id: string, present: boolean) => setMembershipSerially(actor, kind, target, id, async () => {
    const guard = captureOrganisingActor(actor);
    const saved = await organisingGateway.membership(actor, kind, target, id, present); guard();
    await client.cancelQueries({ queryKey: organisingKeys.members(actor, kind) }); guard();
    client.setQueryData<OrganisingMembership[]>(organisingKeys.members(actor, kind), rows => {
      const others = (rows ?? []).filter(row => row.target_id !== target || row.entity_id !== id);
      // A duplicate confirms presence; the refresh supplies any unknown server timestamp.
      const confirmed = saved ?? rows?.find(row => row.target_id === target && row.entity_id === id)
        ?? { user_id: actor, target_id: target, entity_id: id, added_at: '' };
      return present ? [...others, confirmed] : others;
    }); changed();
  });
  return { actor, kind, entities, members, suggestions, isOffline, refresh, create, rename, remove, membership };
}
