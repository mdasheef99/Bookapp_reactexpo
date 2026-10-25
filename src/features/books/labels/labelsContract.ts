/** Suggestions become account labels only when the reader uses them. */
export const LABEL_SUGGESTIONS = ['Favourites', 'To re-read', 'Borrowed', 'Gift', 'Signed copy', 'Classics'] as const;
export type { OrganisingEntity as LibraryLabel } from '../organising/organisingGateway';
