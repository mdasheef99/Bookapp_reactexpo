const PressResponder = require('react-native-web/src/modules/usePressEvents/PressResponder').default;

describe('actual web press responder timing', () => {
    it('opens at 450ms with zero activation delay and suppresses the release click', () => {
        jest.useFakeTimers();
        try {
            const long = jest.fn(), press = jest.fn();
            const responder = new PressResponder({ delayPressStart: 0, delayLongPress: 450, onLongPress: long, onPress: press });
            const event = { currentTarget: null, persist: () => {}, preventDefault: jest.fn(), stopPropagation: jest.fn(),
                nativeEvent: { type: 'mousedown', pageX: 10, pageY: 10 } };
            const handlers = responder.getEventHandlers();
            handlers.onResponderGrant(event);
            jest.advanceTimersByTime(449); expect(long).not.toHaveBeenCalled();
            jest.advanceTimersByTime(1); expect(long).toHaveBeenCalledTimes(1);
            handlers.onResponderRelease(event);
            handlers.onClick(event);
            expect(press).not.toHaveBeenCalled();
            responder.reset();
        } finally { jest.useRealTimers(); }
    });
});
