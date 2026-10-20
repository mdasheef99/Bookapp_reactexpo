import { act, renderHook } from '@testing-library/react-native';
import { useHorizontalShelfDrag } from '../useHorizontalShelfDrag';
const mockEvents: Record<string, (...args: any[]) => void> = {};
jest.mock('react-native-gesture-handler', () => ({ Gesture: { Pan: () => {
    const gesture: Record<string, jest.Mock> = {};
    for (const name of ['enabled', 'minDistance', 'maxPointers', 'runOnJS']) gesture[name] = jest.fn(() => gesture);
    for (const name of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) gesture[name] = jest.fn((callback) => { mockEvents[name] = callback; return gesture; });
    return gesture;
} } }));
describe('horizontal drag lifecycle', () => {
    let frames: Map<number, FrameRequestCallback>, lastFrame: number;
    beforeEach(() => {
        frames = new Map(); lastFrame = 0;
        jest.spyOn(global, 'requestAnimationFrame').mockImplementation((fn) => { frames.set(++lastFrame, fn); return lastFrame; });
        jest.spyOn(global, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id); });
    });
    afterEach(() => jest.restoreAllMocks());
    const setup = (defer = false) => {
        const topScroll = jest.fn(), bottomScroll = jest.fn(), move = jest.fn(), changed = jest.fn();
        const offsets = { current: { top: 30, bottom: 50 } };
        let measurement: (x: number, y: number) => void = () => {};
        const args = { enabled: true, selectedId: 'b0', books: Array.from({ length: 17 }, (_, i) => ({ id: `b${i}`, reading_status: 'reading', ownership: 'owned', book: { title: String(i) } })),
            viewportWidth: 300, fontScale: 1, frameRef: { current: { measureInWindow: (fn: typeof measurement) => { measurement = fn; if (!defer) fn(30, 20); } } } as any,
            scrollRefs: { top: { current: { scrollTo: topScroll } }, bottom: { current: { scrollTo: bottomScroll } } } as any,
            offsets, onMove: move, onOffsetChange: changed };
        const hook = renderHook((props: typeof args) => useHorizontalShelfDrag(props), { initialProps: args });
        return { ...hook, topScroll, bottomScroll, offsets, move, args, measure: () => measurement(30, 20) };
    };
    const tick = (time: number) => act(() => { const fn = frames.get(lastFrame)!; frames.delete(lastFrame); fn(time); });
    it('scrolls only the destination tier, stops outside and cancels invalid drops', () => {
        const { result, topScroll, bottomScroll, offsets, move } = setup();
        act(() => mockEvents.onStart({ absoluteX: 60, absoluteY: 110 }));
        act(() => mockEvents.onUpdate({ absoluteX: 325, absoluteY: 440 }));
        tick(16);
        expect(offsets.current.top).toBe(30); expect(offsets.current.bottom).toBeGreaterThan(50);
        expect(topScroll).not.toHaveBeenCalled(); expect(bottomScroll).toHaveBeenCalled();
        const last = offsets.current.bottom;
        act(() => mockEvents.onUpdate({ absoluteX: 325, absoluteY: -1 })); tick(32);
        expect(result.current.drag?.target).toBeNull(); expect(offsets.current.bottom).toBe(last);
        act(() => mockEvents.onEnd({ absoluteX: 325, absoluteY: -1 }, true));
        expect(move).not.toHaveBeenCalled(); expect(result.current.drag).toBeNull();
    });
    it('commits once and never commits a canceled gesture', () => {
        const { result, move } = setup();
        act(() => mockEvents.onStart({ absoluteX: 60, absoluteY: 110 }));
        act(() => mockEvents.onEnd({ absoluteX: 150, absoluteY: 460 }, false));
        expect(move).not.toHaveBeenCalled();
        act(() => mockEvents.onStart({ absoluteX: 60, absoluteY: 110 }));
        act(() => mockEvents.onEnd({ absoluteX: 150, absoluteY: 460 }, true));
        act(() => mockEvents.onFinalize());
        expect(move).toHaveBeenCalledTimes(1);
        expect(move).toHaveBeenCalledWith('b0', 'bottom', 'b12');
        expect(result.current.drag).toBeNull();
    });
    it('ignores delayed measurement after finalization and cancels membership changes', () => {
        const { result, args, measure, rerender, move } = setup(true);
        act(() => mockEvents.onStart({ absoluteX: 60, absoluteY: 110 }));
        act(() => mockEvents.onFinalize()); act(measure);
        expect(result.current.drag).toBeNull();
        act(() => mockEvents.onStart({ absoluteX: 60, absoluteY: 110 })); act(measure);
        expect(result.current.drag).not.toBeNull();
        rerender({ ...args, books: args.books.slice(1) });
        expect(result.current.drag).toBeNull(); expect(move).not.toHaveBeenCalled();
    });
});
