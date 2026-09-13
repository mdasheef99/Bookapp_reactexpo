import { canAutoCloseCompletedScan } from '../close/sessionAutoClosePolicy';

const completed = (overrides: Record<string, unknown> = {}) => ({
    sessionId: '00000000-0000-4000-8000-000000000010',
    sessionStatus: 'active' as const,
    sessionVersion: 4,
    allInputsTerminal: true,
    closeState: 'closeable' as const,
    batchStatus: 'active' as const,
    batchSessionId: '00000000-0000-4000-8000-000000000010',
    detected: 3,
    processing: 0,
    needsAttention: 0,
    reviewReadySaved: 0,
    committed: 3,
    ownerRemoved: 0,
    falseDetections: 0,
    visibleCandidates: 0,
    commandsIdle: true,
    online: true,
    focused: true,
    ...overrides,
});

describe('Unit 6G completed-scan auto-close policy', () => {
    it('allows Close only after every detected book was explicitly committed', () => {
        expect(canAutoCloseCompletedScan(completed())).toBe(true);
    });

    it.each([
        ['zero detected books', { detected: 0, committed: 0 }],
        ['one uncommitted book', { committed: 2, needsAttention: 1 }],
        ['a processing book', { committed: 2, processing: 1 }],
        ['a saved ready book', { committed: 2, reviewReadySaved: 1 }],
        ['an Owner-removed book', { committed: 2, ownerRemoved: 1 }],
        ['a false detection', { committed: 2, falseDetections: 1 }],
        ['a stale visible card', { visibleCandidates: 1 }],
        ['a nonterminal image', { allInputsTerminal: false }],
        ['a server close denial', { closeState: 'not_closeable' }],
        ['an in-flight command', { commandsIdle: false }],
        ['offline state', { online: false }],
        ['a blurred route', { focused: false }],
        ['a closed session', { sessionStatus: 'closed' }],
        ['a mismatched aggregate', {
            batchSessionId: '00000000-0000-4000-8000-000000000099',
        }],
    ])('denies auto-close for %s', (_label, overrides) => {
        expect(canAutoCloseCompletedScan(completed(overrides))).toBe(false);
    });
});
