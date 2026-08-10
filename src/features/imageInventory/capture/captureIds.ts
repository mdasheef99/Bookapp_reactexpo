import * as Crypto from 'expo-crypto';

export function createCaptureUuid(): string {
    return Crypto.randomUUID();
}

export function createSemanticKey(prefix: string): string {
    return `${prefix}:${createCaptureUuid()}`;
}

export type CaptureAttempt = Readonly<{
    key: string;
    commandId: string;
}>;

export function createCaptureAttempt(prefix: string): CaptureAttempt {
    return {
        key: createSemanticKey(prefix),
        commandId: createCaptureUuid(),
    };
}
