import * as Crypto from 'expo-crypto';
import { createCaptureUuid, createSemanticKey } from '../capture/captureIds';

jest.mock('expo-crypto', () => ({
    randomUUID: jest.fn(),
}));

const randomUUID = Crypto.randomUUID as jest.MockedFunction<typeof Crypto.randomUUID>;
const nativeUuid = '123e4567-e89b-42d3-a456-426614174000';

describe('capture identities', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        randomUUID.mockReturnValue(nativeUuid);
    });

    it('uses native Expo Crypto when the browser global is unavailable', () => {
        const originalCrypto = globalThis.crypto;
        Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });

        try {
            expect(createCaptureUuid()).toBe(nativeUuid);
            expect(randomUUID).toHaveBeenCalledTimes(1);
        } finally {
            Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });
        }
    });

    it('creates a scoped semantic key from the native UUID', () => {
        expect(createSemanticKey('start-session')).toBe(`start-session:${nativeUuid}`);
        expect(randomUUID).toHaveBeenCalledTimes(1);
    });

    it('returns a UUID-shaped value', () => {
        expect(createCaptureUuid()).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
        );
    });
});
