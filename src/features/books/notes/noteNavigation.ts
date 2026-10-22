import type { Href, Router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useAuthStore } from '@/features/auth/store/authStore';
import { NoteOrigin } from './manualNoteContract';

interface NoteRouteContext { actorId: string; bookId: string; origin: NoteOrigin; canBack: boolean; readerReturn?: boolean; readerKey?: string }
interface NoteNavigationState { getState(): { index: number; routes: readonly { name: string; key?: string; params?: object }[] } | undefined }
const contexts = new Map<string, NoteRouteContext>();
useAuthStore.subscribe((state, previous) => { if (state.session?.user.id !== previous.session?.user.id) contexts.clear(); });
export function noteRouteContext(id: string | undefined, actorId: string, bookId: string): NoteRouteContext {
  const context = id ? contexts.get(id) : undefined;
  return context?.actorId === actorId && context.bookId === bookId ? context : { actorId, bookId, origin: 'collection', canBack: false };
}
export function registerNoteContext(context: NoteRouteContext) { const id = randomUUID(); contexts.set(id, context); return id; }
export function composeHref(bookId: string, contextId: string, noteId?: string, operationId?: string): Href {
  return { pathname: '/(tabs)/library/note-compose', params: { bookId, contextId, ...(noteId ? { noteId } : {}), ...(operationId ? { operationId } : {}) } } as Href;
}
export function readerHref(
  bookId: string,
  noteId: string,
  contextId: string,
  justSaved?: boolean,
): Href {
  return {
    pathname: '/(tabs)/library/note',
    params: { bookId, noteId, contextId, ...(justSaved ? { justSaved: '1' } : {}) },
  } as Href;
}
export function openNoteComposer(router: Router, actorId: string, bookId: string, origin: NoteOrigin) {
  router.push(composeHref(bookId, registerNoteContext({ actorId, bookId, origin, canBack: true })));
}
export function openNoteReader(router: Router, actorId: string, bookId: string, noteId: string, origin: NoteOrigin) {
  router.push(readerHref(bookId, noteId, registerNoteContext({ actorId, bookId, origin, canBack: true })));
}
/** Match the intended destination, never assume the preceding entry is it. */
function returnToRoute(router: Router, navigation: NoteNavigationState, name: string, params: Record<string, string>, fallback: Href, routeKey?: string) {
  const state = navigation.getState();
  for (let index = (state?.index ?? 0) - 1; state && index >= 0; index--) {
    const route = state.routes[index];
    const routeParams = route.params as Record<string, unknown> | undefined;
    if ((routeKey && route.key !== routeKey) || route.name.split('/').at(-1) !== name || !Object.entries(params).every(([key, value]) => routeParams?.[key] === value)) continue;
    const count = state.index - index;
    if (count === 1) router.back(); else router.dismiss(count);
    return;
  }
  router.replace(fallback);
}
export function returnToBook(router: Router, navigation: NoteNavigationState, bookId: string) {
  if (!bookId) { router.replace('/(tabs)/library'); return; }
  returnToRoute(router, navigation, '[bookId]', { bookId }, { pathname: '/(tabs)/library/[bookId]', params: { bookId } });
}
export function returnFromNote(router: Router, context: NoteRouteContext, navigation: NoteNavigationState) {
  if (context.origin === 'book' || !context.bookId) { returnToBook(router, navigation, context.bookId); return; }
  returnToRoute(router, navigation, 'notes', { userBookId: context.bookId }, { pathname: '/(tabs)/library/notes', params: { userBookId: context.bookId } });
}
export function returnToSavedReader(
  router: Router,
  navigation: NoteNavigationState,
  context: NoteRouteContext,
  noteId: string,
  options?: { justSaved?: boolean },
) {
  const justSaved = options?.justSaved === true;
  returnToRoute(
    router,
    navigation,
    'note',
    { bookId: context.bookId, noteId },
    readerHref(context.bookId, noteId, registerNoteContext(context), justSaved),
    context.readerKey,
  );
  if (justSaved) {
    try {
      (router as unknown as { setParams?: (params: Record<string, string | undefined>) => void }).setParams?.({
        justSaved: '1',
      });
    } catch {
      // Best effort: the fallback href already carries justSaved for replace paths.
    }
  }
}
export function retainedReaderKey(navigation: NoteNavigationState, bookId: string, noteId: string) {
  const state = navigation.getState(); const route = state?.routes[state.index]; const params = route?.params as Record<string, unknown> | undefined;
  return route?.name.split('/').at(-1) === 'note' && params?.bookId === bookId && params?.noteId === noteId ? route.key : undefined;
}
