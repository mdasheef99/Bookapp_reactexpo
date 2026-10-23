import type { Href, Router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useAuthStore } from '@/features/auth/store/authStore';
import { NOTE_CATEGORIES, NoteDeckReturnState, NoteOrigin } from './manualNoteContract';
import { parseDeckScope } from './noteDeck';

export interface NoteRouteContext { actorId: string; bookId: string; origin: NoteOrigin; canBack: boolean; readerReturn?: boolean; readerKey?: string; swipeKey?: string; swipe?: NoteDeckReturnState }
export interface SwipeRouteParams { origin?: string; swipeKey?: string; swipeScope?: string; swipeUserBookId?: string; swipeCategory?: string; swipeOrder?: string; swipeSeed?: string; swipeNoteId?: string; swipeAt?: string; swipeNext?: string }
interface NoteNavigationState { getState(): { index: number; routes: readonly { name: string; key?: string; params?: object }[] } | undefined }
const contexts = new Map<string, NoteRouteContext>();
useAuthStore.subscribe((state, previous) => { if (state.session?.user.id !== previous.session?.user.id) contexts.clear(); });
export function noteRouteContext(id: string | undefined, actorId: string, bookId: string, params?: SwipeRouteParams): NoteRouteContext {
  const context = id ? contexts.get(id) : undefined;
  if (context?.actorId === actorId && context.bookId === bookId) return context;
  if (params?.origin === 'swipe') {
    const atRaw = params.swipeAt === undefined ? Number.NaN : Number.parseInt(params.swipeAt, 10);
    const at = Number.isSafeInteger(atRaw) && atRaw >= 0 ? atRaw : undefined;
    const nextId = params.swipeNext === undefined ? undefined : params.swipeNext === '__end__' ? null : params.swipeNext;
    return { actorId, bookId, origin: 'swipe', canBack: false, swipeKey: params.swipeKey,
      swipe: { scope: parseDeckScope({ scope: params.swipeScope, userBookId: params.swipeUserBookId }),
        category: NOTE_CATEGORIES.find(c => c.value === params.swipeCategory)?.value ?? 'all',
        order: params.swipeOrder === 'newest' || params.swipeOrder === 'oldest' ? params.swipeOrder : 'shuffle',
        seed: params.swipeSeed ?? '', noteId: params.swipeNoteId === '__end__' ? null : params.swipeNoteId ?? '',
        ...(at === undefined ? {} : { at }), ...(nextId === undefined ? {} : { nextId }) } };
  }
  return { actorId, bookId, origin: 'list', canBack: false };
}
function swipeParams(contextId: string): SwipeRouteParams {
  const context = contexts.get(contextId); const state = context?.swipe;
  return context?.origin === 'swipe' && state ? { origin: 'swipe', swipeKey: context.swipeKey, swipeScope: state.scope.kind,
    swipeUserBookId: state.scope.kind === 'book' ? state.scope.userBookId : undefined, swipeCategory: state.category,
    swipeOrder: state.order, swipeSeed: state.seed, swipeNoteId: state.noteId ?? '__end__',
    ...(state.at === undefined ? {} : { swipeAt: String(state.at) }),
    ...(state.nextId === undefined ? {} : { swipeNext: state.nextId ?? '__end__' }) } : {};
}
export function swipeHref(state: NoteDeckReturnState): Href {
  return { pathname: '/(tabs)/library/notes-swipe', params: { scope: state.scope.kind,
    ...(state.scope.kind === 'book' ? { userBookId: state.scope.userBookId } : {}), category: state.category, order: state.order, seed: state.seed, noteId: state.noteId ?? '__end__',
    ...(state.at === undefined ? {} : { swipeAt: String(state.at) }),
    ...(state.nextId === undefined ? {} : { swipeNext: state.nextId ?? '__end__' }) } } as Href;
}
export function registerNoteContext(context: NoteRouteContext) { const id = randomUUID(); contexts.set(id, context); return id; }
export function composeHref(bookId: string, contextId: string, noteId?: string, operationId?: string): Href {
  return { pathname: '/(tabs)/library/note-compose', params: { bookId, contextId, ...swipeParams(contextId), ...(noteId ? { noteId } : {}), ...(operationId ? { operationId } : {}) } } as Href;
}
export function readerHref(
  bookId: string,
  noteId: string,
  contextId: string,
  justSaved?: boolean,
): Href {
  return {
    pathname: '/(tabs)/library/note',
    params: { bookId, noteId, contextId, ...swipeParams(contextId), ...(justSaved ? { justSaved: '1' } : {}) },
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
  if (context.origin === 'swipe' && context.swipe) {
    returnToRoute(router, navigation, 'notes-swipe', {}, swipeHref(context.swipe), context.swipeKey); return;
  }
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
