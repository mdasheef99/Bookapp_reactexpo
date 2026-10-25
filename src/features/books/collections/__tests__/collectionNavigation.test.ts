import { noteRouteContext, readerHref, registerNoteContext, returnFromNote, swipeHref } from '../../notes/noteNavigation';
jest.mock('expo-crypto', () => ({ randomUUID: () => 'collection-context' }));
it('returns from a collection reader to its matching retained collection route', () => {
  const context = { actorId: 'actor', bookId: 'book', origin: 'collection' as const, canBack: true, collectionId: 'group', collectionKey: 'intended' };
  const router: any = { back: jest.fn(), dismiss: jest.fn(), replace: jest.fn() };
  const navigation = { getState: () => ({ index: 2, routes: [{ name: 'collection', key: 'intended', params: { collectionId: 'group' } }, { name: 'collection', key: 'other', params: { collectionId: 'other' } }, { name: 'note' }] }) };
  returnFromNote(router, context, navigation);
  expect(router.dismiss).toHaveBeenCalledWith(2); expect(router.replace).not.toHaveBeenCalled();
});
it('retains collection context after reload and keeps dedicated and chip scope in swipe fallbacks', () => {
  const context = { actorId: 'actor', bookId: 'book', origin: 'collection' as const, canBack: true, collectionId: 'group', collectionKey: 'intended' };
  const href: any = readerHref('book', 'note', registerNoteContext(context));
  expect(noteRouteContext(undefined, 'actor', 'book', href.params)).toMatchObject({ origin: 'collection', collectionId: 'group', collectionKey: 'intended' });
  const fallback: any = swipeHref({ scope: { kind: 'collection', collectionId: 'group' }, category: 'all', order: 'oldest', seed: 's', noteId: 'note' });
  expect(fallback.params).toMatchObject({ scope: 'collection', collectionId: 'group', order: 'oldest' });
  const chip: any = swipeHref({ scope: { kind: 'book', userBookId: 'book' }, category: 'all', collectionId: 'group', order: 'newest', seed: 's', noteId: 'note' });
  expect(chip.params).toMatchObject({ scope: 'book', userBookId: 'book', filterCollectionId: 'group' });
});
