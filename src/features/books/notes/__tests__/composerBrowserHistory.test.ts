import { guardComposerHistory, initializeComposerHistory } from '../composerBrowserHistory';

it('does not register browser events on a native window alias', () => {
  const nativeWindow = {} as Window;
  expect(() => initializeComposerHistory(nativeWindow)).not.toThrow();
  expect(() => guardComposerHistory(nativeWindow, () => true, () => {})).not.toThrow();
});

function fixture() {
  const target = new EventTarget() as EventTarget & {
    navigation: EventTarget & { currentEntry: { key: string; index: number } };
    history: { go: jest.Mock };
  };
  target.navigation = Object.assign(new EventTarget(), { currentEntry: { key: '3', index: 3 } });
  target.history = { go: jest.fn() };
  const windowTarget = target as unknown as Window;
  initializeComposerHistory(windowTarget);
  const router = jest.fn(); target.addEventListener('popstate', router);
  const traverse = (index: number) => {
    const event = Object.assign(new Event('navigate'), {
      navigationType: 'traverse', destination: { key: String(index), index, sameDocument: true },
    });
    target.navigation.dispatchEvent(event);
    target.navigation.currentEntry = { key: String(index), index };
    target.dispatchEvent(new Event('popstate'));
  };
  return { target, windowTarget, router, traverse };
}

test('early dispatcher is dormant unless a composer protects its exit', () => {
  const f = fixture(); const prompt = jest.fn();
  const guard = guardComposerHistory(f.windowTarget, () => false, prompt);
  f.traverse(2);
  expect(f.router).toHaveBeenCalledTimes(1); expect(prompt).not.toHaveBeenCalled();
  expect(f.target.history.go).not.toHaveBeenCalled(); guard.dispose();
});

test('restores before prompting, then replays the original destination exactly once', () => {
  const f = fixture(); let protect = true; const prompt = jest.fn();
  const guard = guardComposerHistory(f.windowTarget, () => protect, prompt);
  f.traverse(1); expect(f.target.history.go).toHaveBeenLastCalledWith(2);
  expect(prompt).not.toHaveBeenCalled(); expect(f.router).not.toHaveBeenCalled();
  f.traverse(3); expect(prompt).toHaveBeenCalledTimes(1);
  protect = false; prompt.mock.calls[0][0]();
  expect(f.target.history.go).toHaveBeenLastCalledWith(-2);
  f.traverse(1); expect(f.router).toHaveBeenCalledTimes(1); guard.dispose();
});

test('Keep during a repeated Back restoration waits without another dialog', () => {
  const f = fixture(); const prompt = jest.fn();
  const guard = guardComposerHistory(f.windowTarget, () => true, prompt);
  f.traverse(2); f.traverse(3); f.traverse(2); guard.keepEditing(); f.traverse(3);
  expect(prompt).toHaveBeenCalledTimes(1); expect(f.router).not.toHaveBeenCalled();
  f.traverse(2); f.traverse(3); expect(prompt).toHaveBeenCalledTimes(2); guard.dispose();
});

test('Discard during a repeated Back restoration waits even after protection is released', () => {
  const f = fixture(); let protect = true; const prompt = jest.fn();
  const guard = guardComposerHistory(f.windowTarget, () => protect, prompt);
  f.traverse(2); f.traverse(3); f.traverse(1);
  protect = false; prompt.mock.calls[0][0]();
  expect(f.target.history.go).toHaveBeenLastCalledWith(2);
  f.traverse(3); expect(f.target.history.go).toHaveBeenLastCalledWith(-1);
  expect(prompt).toHaveBeenCalledTimes(1); expect(f.router).not.toHaveBeenCalled();
  f.traverse(2); expect(f.router).toHaveBeenCalledTimes(1); guard.dispose();
});

test('disposing a newer retained composer does not remove an older focused subscription', () => {
  const f = fixture(); const prompt = jest.fn();
  const older = guardComposerHistory(f.windowTarget, () => true, prompt);
  const newer = guardComposerHistory(f.windowTarget, () => false, jest.fn());
  newer.dispose(); f.traverse(2); f.traverse(3);
  expect(prompt).toHaveBeenCalledTimes(1); older.dispose();
  f.traverse(2); expect(f.router).toHaveBeenCalledTimes(1);
});
