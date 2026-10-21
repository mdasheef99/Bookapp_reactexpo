

import {


    type OwnerCandidateDetail,
    type OwnerCandidateCommitResult,
    type OwnerDiscovery,
    type OwnerInputPage,
    type OwnerRemoveInputResult,
    type OwnerDuplicateInputResult,
    type OwnerSessionReadiness,

} from '../contracts/ownerUxContracts';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';





import { invokeOwnerUx as invoke } from './ownerUxTransport';
export { OwnerUxClientError, type OwnerUxErrorCode } from './ownerUxTransport';

export type UpdateCandidateReviewRequest = Readonly<{
    sessionId: string;
    candidateId: string;
    expectedCandidateVersion: number;
    expectedMetadataRevision: number;
    review: OwnerCandidateReview;
    idempotencyKey: string;
    commandId: string;
}>;

export type CloseScanSessionRequest = Readonly<{
    sessionId: string;
    expectedSessionVersion: number;
    idempotencyKey: string;
    commandId: string;
}>;

export type AddCandidateToInventoryRequest = Readonly<{
    sessionId: string;
    candidateId: string;
    expectedCandidateVersion: number;
    expectedReviewVersion: number;
    expectedMetadataRevision: number;
    idempotencyKey: string;
    commandId: string;
}>;

export type RemoveScanInputRequest = Readonly<{
    sessionId: string;
    inputId: string;
    expectedInputVersion: number;
    idempotencyKey: string;
    commandId: string;
}>;
export type ResolveDuplicateScanInputRequest = Readonly<{
    sessionId: string;
    inputId: string;
    decision: 'cancel' | 'proceed';
    expectedInputVersion: number;
    expectedConfirmationVersion: number;
    idempotencyKey: string;
    commandId: string;
}>;

export const ownerUxService = {
    discover(): Promise<OwnerDiscovery> {
        return invoke('discover_scan_session', {});
    },
    listInputs(
        sessionId: string,
        pageSize = 20,
        cursor: string | null = null,
    ): Promise<OwnerInputPage> {
        return invoke('list_scan_inputs', { sessionId, pageSize, cursor });
    },
    removeInput(
        request: RemoveScanInputRequest,
        signal?: AbortSignal,
    ): Promise<OwnerRemoveInputResult> {
        return invoke('remove_scan_input', request, signal);
    },
    resolveDuplicateInput(
        request: ResolveDuplicateScanInputRequest,
        signal?: AbortSignal,
    ): Promise<OwnerDuplicateInputResult> {
        return invoke('resolve_duplicate_scan_input', request, signal);
    },
    readCandidate(
        sessionId: string,
        candidateId: string,
        signal?: AbortSignal,
    ): Promise<OwnerCandidateDetail> {
        return invoke('read_scan_candidate', { sessionId, candidateId }, signal);
    },
    updateCandidateReview(
        request: UpdateCandidateReviewRequest,
        signal?: AbortSignal,
    ): Promise<OwnerCandidateDetail> {
        return invoke('update_candidate_review', request, signal);
    },
    addCandidateToInventory(
        request: AddCandidateToInventoryRequest,
        signal?: AbortSignal,
    ): Promise<OwnerCandidateCommitResult> {
        return invoke('add_candidate_to_inventory', request, signal);
    },
    readReadiness(sessionId: string): Promise<OwnerSessionReadiness> {
        return invoke('read_scan_readiness', { sessionId });
    },
    closeSession(request: CloseScanSessionRequest, signal?: AbortSignal): Promise<OwnerSessionReadiness> {
        return invoke('close_scan_session', request, signal);
    },
};
