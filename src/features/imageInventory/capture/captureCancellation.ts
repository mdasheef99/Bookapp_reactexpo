type Canceller = () => void;
const cancellers = new Set<Canceller>();

export function registerCaptureCancellation(cancel: Canceller): () => void {
    cancellers.add(cancel);
    return () => cancellers.delete(cancel);
}

export function cancelAllCaptureWork(): void {
    for (const cancel of [...cancellers]) cancel();
}
