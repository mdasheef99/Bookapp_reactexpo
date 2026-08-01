export type OwnerRequestIdentity = Readonly<{
    userId: string;
    storeId: string;
}>;

const tokenFor = (identity: OwnerRequestIdentity | null) => (
    identity ? `${identity.userId}:${identity.storeId}` : null
);

let generation = 0;
let activeToken: string | null = null;
const activeControllers = new Set<AbortController>();

export function beginOwnerIdentityTransition(): number {
    generation += 1;
    activeToken = null;
    for (const controller of activeControllers) controller.abort();
    activeControllers.clear();
    return generation;
}

export function completeOwnerIdentityTransition(
    transitionGeneration: number,
    identity: OwnerRequestIdentity | null,
): void {
    if (generation === transitionGeneration) activeToken = tokenFor(identity);
}

export function captureOwnerRequest(
    identity: OwnerRequestIdentity,
    externalSignal?: AbortSignal,
) {
    const requestGeneration = generation;
    const expectedToken = tokenFor(identity);
    if (!expectedToken || activeToken !== expectedToken) throw new Error('OWNER_IDENTITY_CHANGED');
    const controller = new AbortController();
    const abort = () => controller.abort();
    externalSignal?.addEventListener('abort', abort, { once: true });
    activeControllers.add(controller);
    const assertCurrent = () => {
        if (
            controller.signal.aborted
            || generation !== requestGeneration
            || activeToken !== expectedToken
        ) throw new Error('OWNER_IDENTITY_CHANGED');
    };
    const release = () => {
        externalSignal?.removeEventListener('abort', abort);
        activeControllers.delete(controller);
    };
    return { signal: controller.signal, assertCurrent, release };
}

export function resetOwnerRequestFence(identity: OwnerRequestIdentity | null): void {
    for (const controller of activeControllers) controller.abort();
    activeControllers.clear();
    generation = 0;
    activeToken = tokenFor(identity);
}
