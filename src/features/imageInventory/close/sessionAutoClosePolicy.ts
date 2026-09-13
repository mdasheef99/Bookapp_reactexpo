export type CompletedScanAutoCloseState = Readonly<{
    sessionId: string;
    sessionStatus: string;
    sessionVersion: number;
    allInputsTerminal: boolean;
    closeState: 'closeable' | 'not_closeable' | 'closed' | 'expired';
    batchStatus: string;
    batchSessionId: string;
    detected: number;
    processing: number;
    needsAttention: number;
    reviewReadySaved: number;
    committed: number;
    ownerRemoved: number;
    falseDetections: number;
    visibleCandidates: number;
    commandsIdle: boolean;
    online: boolean;
    focused: boolean;
}>;

// Unit 6G SDD §§4/14/16: only explicit commits may satisfy auto-close.
// Removal/false-detection dispositions remain deliberate manual-close cases.
export function canAutoCloseCompletedScan(state: CompletedScanAutoCloseState): boolean {
    return state.sessionStatus === 'active'
        && state.batchStatus === 'active'
        && state.sessionId === state.batchSessionId
        && Number.isSafeInteger(state.sessionVersion)
        && state.sessionVersion > 0
        && state.allInputsTerminal
        && state.closeState === 'closeable'
        && state.detected > 0
        && state.committed === state.detected
        && state.processing === 0
        && state.needsAttention === 0
        && state.reviewReadySaved === 0
        && state.ownerRemoved === 0
        && state.falseDetections === 0
        && state.visibleCandidates === 0
        && state.commandsIdle
        && state.online
        && state.focused;
}
