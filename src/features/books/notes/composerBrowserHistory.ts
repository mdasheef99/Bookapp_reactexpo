interface Entry { key: string; index: number }
interface TraverseEvent extends Event {
  navigationType: string;
  destination: Entry & { sameDocument: boolean };
}
interface BrowserNavigation extends EventTarget { currentEntry: Entry | null }
type HistoryWindow = Window & { navigation?: BrowserNavigation };
export interface ComposerHistoryGuard { keepEditing: () => void; dispose: () => void }

const dispatchers = new WeakMap<HistoryWindow, Set<(event: Event) => void>>();

/** Register before Expo's linker. Dormant outside the mounted composer; no
 * history entries, router state or unrelated navigation are changed. */
export function initializeComposerHistory(target: HistoryWindow): void {
  // React Native's window alias is not a DOM event target.
  if (typeof target.addEventListener !== 'function') return;
  if (dispatchers.has(target)) return;
  const dispatcher = new Set<(event: Event) => void>();
  dispatchers.set(target, dispatcher);
  target.addEventListener('popstate', event => {
    for (const listener of [...dispatcher].reverse()) {
      listener(event);
      if (event.cancelBubble) break;
    }
  }, true);
}

/** The installed Expo web linker resets the root on popstate, bypassing the
 * screen's usePreventRemove. Capture only this focused composer's meaningful
 * exits. Navigation API indices identify Back, Forward and multi-entry traversals
 * without changing history.state, adding entries or patching the router.
 */
export function guardComposerHistory(
  target: HistoryWindow,
  shouldProtect: () => boolean,
  requestExit: (proceed: () => void) => void,
): ComposerHistoryGuard {
  const browserNavigation = target.navigation;
  if (!browserNavigation) return { keepEditing: () => {}, dispose: () => {} };
  initializeComposerHistory(target);
  const dispatcher = dispatchers.get(target)!;
  type Traversal = { from: Entry; to: Entry };
  let traversal: Traversal | undefined;
  let request: (Traversal & { prompted: boolean; restoring: boolean; onRestore?: () => void }) | undefined;
  let disposed = false;
  const onNavigate = (raw: Event) => {
    const event = raw as TraverseEvent;
    const from = browserNavigation.currentEntry;
    traversal = event.navigationType === 'traverse' && event.destination.sameDocument && from
      ? { from: { key: from.key, index: from.index }, to: { key: event.destination.key, index: event.destination.index } }
      : undefined;
  };
  const onPopState = (event: Event) => {
    const current = browserNavigation.currentEntry;
    const attempted = traversal; traversal = undefined;
    if (!current) return;
    if (request?.restoring && current.key === request.from.key) {
      // Do not expose the restoration to Expo's linker: its navigation state
      // and composer stay mounted throughout the contextual confirmation.
      event.stopImmediatePropagation(); request.restoring = false;
      if (request.onRestore) { request.onRestore(); return; }
      if (!request.prompted) {
        request.prompted = true;
        const approved = request;
        requestExit(() => {
          if (disposed || request !== approved) return;
          const proceed = () => {
            request = undefined;
            // Clear before go(): confirmed departure reaches the linker once.
            const entry = browserNavigation.currentEntry;
            if (entry) target.history.go(approved.to.index - entry.index);
          };
          if (approved.restoring) approved.onRestore = proceed;
          else proceed();
        });
      }
      return;
    }
    if (!shouldProtect() || !attempted || current.key === attempted.from.key) return;
    event.stopImmediatePropagation();
    request ??= { ...attempted, prompted: false, restoring: false };
    request.restoring = true;
    target.history.go(request.from.index - current.index);
  };
  browserNavigation.addEventListener('navigate', onNavigate);
  dispatcher.add(onPopState);
  return {
    keepEditing: () => {
      if (request?.restoring) request.onRestore = () => { request = undefined; };
      else request = undefined;
    },
    dispose: () => {
      disposed = true; request = undefined;
      browserNavigation.removeEventListener('navigate', onNavigate);
      dispatcher.delete(onPopState);
    },
  };
}
