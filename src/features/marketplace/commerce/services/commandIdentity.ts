function randomHex(length: number) {
    let value = '';
    while (value.length < length) value += Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
    return value.slice(0, length);
}

export function createCommandIdentity(command: string) {
    const commandId = `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-a${randomHex(3)}-${randomHex(12)}`;
    return { commandId, idempotencyKey: `${command}:${commandId}` };
}
