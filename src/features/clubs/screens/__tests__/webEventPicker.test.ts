import { showWebEventPicker } from '../webEventPicker';

describe('showWebEventPicker', () => {
    it('opens the supported picker with the input as its receiver', () => {
        const input = { showPicker: jest.fn(function (this: unknown) { expect(this).toBe(input); }) };
        showWebEventPicker(input);
        expect(input.showPicker).toHaveBeenCalledTimes(1);
    });

    it('allows browsers without showPicker to use the normal input', () => {
        expect(() => showWebEventPicker({})).not.toThrow();
    });

    it('allows focus without user activation to continue editing', () => {
        const error = Object.assign(new Error('User activation required'), { name: 'NotAllowedError' });
        expect(() => showWebEventPicker({ showPicker: () => { throw error; } })).not.toThrow();
    });

    it('does not hide unexpected picker failures', () => {
        const error = new Error('Unexpected picker error');
        expect(() => showWebEventPicker({ showPicker: () => { throw error; } })).toThrow(error);
    });
});
