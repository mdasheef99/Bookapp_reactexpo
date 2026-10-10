import { useEffect, useRef } from 'react';
import { captureOwnerRequest } from './ownerRequestFence';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';

export type OwnerCandidateCommandSlot = Readonly<{
  claimSlot(candidateId: string, prefix: string): string | null;
  releaseSlot(candidateId: string, token: string): void;
  isCommandActive(candidateId: string): boolean;
}>;
export function useOwnerCardCommand(
  identity: ImageInventoryIdentity | null, sessionId: string | null, candidateId: string | null,
  slot?: OwnerCandidateCommandSlot,
) {
  const scope = `${identity?.userId ?? ''}:${identity?.storeId ?? ''}:${sessionId ?? ''}:${candidateId ?? ''}`;
  const active = useRef(scope);
  const controllers = useRef(new Set<AbortController>());
  const releases = useRef(new Set<() => void>());
  useEffect(() => {
    active.current = scope;
    return () => {
      active.current = '';
      controllers.current.forEach(controller => controller.abort());
      controllers.current.clear();
      releases.current.forEach(release => release());
      releases.current.clear();
    };
  }, [scope]);
  const assertScope = () => {
    if (active.current !== scope || !identity || !sessionId || !candidateId) {
      throw new Error('OWNER_CANDIDATE_AUTHORITY_CHANGED');
    }
  };
  return {
    assertScope,
    async run<T>(
      work: (signal: AbortSignal, assertCurrent: () => void) => Promise<T>,
      signal?: AbortSignal, commandPrefix?: string,
    ): Promise<T> {
      assertScope();
      const token = commandPrefix && slot ? slot.claimSlot(candidateId!, commandPrefix) : null;
      if (commandPrefix && slot && !token) throw new Error('OWNER_CANDIDATE_BUSY');
      const releaseSlot = () => { if (token && slot) slot.releaseSlot(candidateId!, token); };
      releases.current.add(releaseSlot);
      const lifecycle = new AbortController();
      if (signal?.aborted) lifecycle.abort();
      const abort = () => lifecycle.abort();
      signal?.addEventListener('abort', abort, { once: true });
      controllers.current.add(lifecycle);
      let fence: ReturnType<typeof captureOwnerRequest> | undefined;
      try {
        fence = captureOwnerRequest(identity!, lifecycle.signal);
        const assertCurrent = () => { assertScope(); fence!.assertCurrent(); };
        assertCurrent();
        const result = await work(fence.signal, assertCurrent);
        assertCurrent();
        return result;
      } finally {
        fence?.release();
        signal?.removeEventListener('abort', abort);
        controllers.current.delete(lifecycle);
        releases.current.delete(releaseSlot);
        releaseSlot();
      }
    },
  };
}