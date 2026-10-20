import { act, renderHook } from '@testing-library/react-native';
import { useVerticalShelfDrag } from '../useVerticalShelfDrag';

const mockEvents: Record<string, (...args: any[]) => void> = {};
jest.mock('react-native-gesture-handler', () => ({ Gesture: { Pan: () => {
    const gesture: Record<string, jest.Mock> = {};
    for (const name of ['enabled', 'minDistance', 'maxPointers', 'runOnJS']) gesture[name] = jest.fn(() => gesture);
    for (const name of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) gesture[name] = jest.fn((callback) => {
        mockEvents[name] = callback;
        return gesture;
    });
    return gesture;
} } }));

describe('vertical drag lifecycle and frame scrolling', () => {
    let frames: Map<number, FrameRequestCallback>;
    let lastFrame: number;
    beforeEach(() => {
        frames = new Map();
        lastFrame = 0;
        jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
            frames.set(++lastFrame, callback);
            return lastFrame;
        });
        jest.spyOn(global, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id); });
    });
    afterEach(() => jest.restoreAllMocks());
    const setup = () => {
        const scrollTo = jest.fn();
        const move = jest.fn();
        const scrollXRef = { current: 40 };
        const args = {
            enabled: true, selectedId: 'a', books: ['a', 'b', 'c', 'd'].map((id) => ({ id, reading_status: 'want_to_read', ownership: 'owned', book: { title: id } })),
            layouts: [
                { id: 'a', row: 'top' as const, offsetLeft: 12, width: 32, height: 150 },
                { id: 'b', row: 'top' as const, offsetLeft: 46, width: 32, height: 150 },
                { id: 'c', row: 'bottom' as const, offsetLeft: 12, width: 32, height: 150 },
                { id: 'd', row: 'bottom' as const, offsetLeft: 46, width: 32, height: 150 },
            ], rows: { top: { y: 28, height: 192 }, bottom: { y: 238, height: 192 } },
            viewportWidth: 300, contentWidth: 600,
            frameRef: { current: { measureInWindow: (callback: (x: number, y: number) => void) => callback(30, 20) } } as any,
            scrollRef: { current: { scrollTo } } as any, scrollXRef, onMove: move,
        };
        return { ...renderHook(() => useVerticalShelfDrag(args)), scrollTo, move, scrollXRef };
    };
    const tick = (time: number) => act(() => {
        const callback = frames.get(lastFrame)!;
        frames.delete(lastFrame);
        callback(time);
    });

    it('scrolls near a valid edge, stops outside the cabinet and discards an outside drop', () => {
        const { result, scrollTo, move, scrollXRef } = setup();
        act(() => mockEvents.onStart({ absoluteX: 50, absoluteY: 150 }));
        act(() => mockEvents.onUpdate({ absoluteX: 325, absoluteY: 160 }));
        tick(16);
        expect(scrollXRef.current).toBeGreaterThan(40);
        expect(scrollTo).toHaveBeenCalledWith({ x: scrollXRef.current, animated: false });
        const validOffset = scrollXRef.current;
        scrollTo.mockClear();
        act(() => mockEvents.onUpdate({ absoluteX: 325, absoluteY: -10 }));
        tick(32);
        expect(result.current.drag?.target).toBeNull();
        expect(scrollXRef.current).toBe(validOffset);
        expect(scrollTo).not.toHaveBeenCalled();
        act(() => mockEvents.onEnd({ absoluteX: 325, absoluteY: -10 }, true));
        expect(result.current.drag).toBeNull();
        expect(move).not.toHaveBeenCalled();
    });

    it('commits exactly once on successful drop and ignores canceled gestures', () => {
        const { result, move } = setup();
        act(() => mockEvents.onStart({ absoluteX: 50, absoluteY: 150 }));
        act(() => mockEvents.onUpdate({ absoluteX: 230, absoluteY: 370 }));
        expect(move).not.toHaveBeenCalled();
        act(() => mockEvents.onEnd({ absoluteX: 230, absoluteY: 370 }, false));
        expect(result.current.drag).toBeNull();
        expect(move).not.toHaveBeenCalled();
        act(() => mockEvents.onStart({ absoluteX: 50, absoluteY: 150 }));
        act(() => mockEvents.onEnd({ absoluteX: 230, absoluteY: 370 }, true));
        act(() => mockEvents.onFinalize());
        expect(move).toHaveBeenCalledTimes(1);
        expect(move).toHaveBeenCalledWith('a', null);
        expect(result.current.drag).toBeNull();
    });
});
