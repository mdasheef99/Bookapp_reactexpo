import {
    cancelAllCaptureWork,
    registerCaptureCancellation,
} from '../capture/captureCancellation';

describe('Phase 9 Unit 6C route-independent cancellation', () => {
    afterEach(cancelAllCaptureWork);

    it('cancels every active local workflow once on identity cleanup', () => {
        const first = jest.fn();
        const second = jest.fn();
        registerCaptureCancellation(first);
        registerCaptureCancellation(second);

        cancelAllCaptureWork();
        cancelAllCaptureWork();

        expect(first).toHaveBeenCalledTimes(2);
        expect(second).toHaveBeenCalledTimes(2);
    });

    it('does not cancel an unmounted workflow', () => {
        const cancel = jest.fn();
        const unregister = registerCaptureCancellation(cancel);
        unregister();
        cancelAllCaptureWork();
        expect(cancel).not.toHaveBeenCalled();
    });
});
