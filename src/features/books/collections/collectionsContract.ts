import { NOTE_CATEGORIES, NoteDeckIndexRow, NoteCategory } from '../notes/manualNoteContract';
import type { OrganisingEntity, OrganisingMembership } from '../organising/organisingGateway';

export type NoteDeckFilter = { kind: 'all' } | { kind: 'category'; tag: NoteCategory } | { kind: 'collection'; collectionId: string };
export const filterKey = (filter: NoteDeckFilter) => JSON.stringify(filter.kind === 'all' ? ['all'] : filter.kind === 'category' ? ['category', filter.tag] : ['collection', filter.collectionId]);
export function collectionIds(members: readonly OrganisingMembership[], id: string) {
  return members.filter(row => row.entity_id === id).sort((a, b) => b.added_at.localeCompare(a.added_at) || a.target_id.localeCompare(b.target_id)).map(row => row.target_id);
}
export function filterCollectionNotes<T extends NoteDeckIndexRow>(rows: readonly T[], members: readonly OrganisingMembership[], filter: NoteDeckFilter): T[] {
  const ids = new Set(filter.kind === 'collection' ? members.filter(row => row.entity_id === filter.collectionId).map(row => row.target_id) : []);
  return rows.filter(row => filter.kind === 'all' || (filter.kind === 'category' ? row.tag === filter.tag : ids.has(row.id)));
}
export function collectionFilters(rows: readonly NoteDeckIndexRow[], groups: readonly OrganisingEntity[], members: readonly OrganisingMembership[]): NoteDeckFilter[] {
  const ids = new Set(rows.map(row => row.id));
  const nonempty = new Set(members.filter(row => ids.has(row.target_id)).map(row => row.entity_id));
  return [{ kind: 'all' }, ...NOTE_CATEGORIES.filter(c => rows.some(row => row.tag === c.value)).map(c => ({ kind: 'category' as const, tag: c.value })),
    ...[...groups].filter(group => nonempty.has(group.id)).sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)).map(group => ({ kind: 'collection' as const, collectionId: group.id }))];
}
