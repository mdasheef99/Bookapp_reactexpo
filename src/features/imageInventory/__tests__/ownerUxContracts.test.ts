import {
    OWNER_UX_CONTRACT_VERSION,
    OwnerUxResponseContractError,
    decodeOwnerUxResponse,
} from '../contracts/ownerUxContracts';
import { decodeOwnerUxRequest } from '../contracts/ownerUxRequestContracts';

const uuid = (digit: number) => `00000000-0000-4000-8000-${String(digit).padStart(12, '0')}`;

describe('Phase 9 Unit 6B mobile Owner UX response contracts', () => {
    it('strictly decodes the remove-image command and canonical skipped result', () => {
        const request = {
            action: 'remove_scan_input' as const,
            contractVersion: OWNER_UX_CONTRACT_VERSION,
            sessionId: uuid(1),
            inputId: uuid(2),
            expectedInputVersion: 3,
            idempotencyKey: 'remove-input:fixed-command-0001',
            commandId: uuid(9),
        };
        const result = {
            sessionId: uuid(1),
            inputId: uuid(2),
            inputState: 'skipped',
            inputVersion: 4,
            sessionVersion: 5,
            presentationRevision: 6,
        };

        expect(decodeOwnerUxRequest('remove_scan_input', request)).toEqual(request);
        expect(decodeOwnerUxRequest('remove_scan_input', { ...request, storeId: uuid(8) })).toBeNull();
        expect(decodeOwnerUxResponse('remove_scan_input', {
            contractVersion: OWNER_UX_CONTRACT_VERSION,
            data: result,
        })).toEqual(result);
        expect(() => decodeOwnerUxResponse('remove_scan_input', {
            contractVersion: OWNER_UX_CONTRACT_VERSION,
            data: { ...result, objectPath: 'private/path.jpg' },
        })).toThrow(OwnerUxResponseContractError);
    });

    it('strictly decodes the Unit 6F Close response and rejects unknown request keys', () => {
        const readiness = {
            sessionId: uuid(1),
            sessionStatus: 'closed',
            sessionVersion: 3,
            allInputsTerminal: true,
            closeSummary: {
                imagesSubmitted: 0, imagesProcessed: 0, imagesFailed: 0, imagesSkipped: 0,
                candidatesDetected: 0, candidatesReviewReady: 0, candidatesNeedsReview: 0,
                candidatesFailed: 0, falseDetections: 0, manualMissedCandidates: 0,
                committedInventoryItems: 0, quantitiesAddedToExisting: 0, privateItems: 0,
                publishedItems: 0, languageSkips: 0, candidateCapSkips: 0, qualitySkips: 0,
            },
            blockerCounts: {
                input_processing: 0, candidate_processing: 0, candidate_failed: 0,
                review_missing: 0, title_unconfirmed: 0, author_confirmation_incomplete: 0,
                language_missing: 0, metadata_choice_missing: 0, quantity_invalid: 0,
                price_invalid: 0, condition_missing: 0, damage_answer_missing: 0,
                damage_details_missing: 0, location_missing: 0, publication_intent_missing: 0,
                duplicate_intent_missing: 0, variant_source_stale: 0,
            },
            nextBlockingCandidateId: null,
            closeState: 'closed',
            closeAllowed: false,
            presentationRevision: 4,
        };
        expect(decodeOwnerUxResponse('close_scan_session', {
            contractVersion: OWNER_UX_CONTRACT_VERSION,
            data: readiness,
        })).toEqual(readiness);
        const request = {
            action: 'close_scan_session' as const,
            contractVersion: OWNER_UX_CONTRACT_VERSION,
            sessionId: uuid(1), expectedSessionVersion: 2,
            idempotencyKey: 'close:fixed-command-0001', commandId: uuid(9),
        };
        expect(decodeOwnerUxRequest('close_scan_session', request)).toEqual(request);
        expect(decodeOwnerUxRequest('close_scan_session', { ...request, storeId: uuid(8) })).toBeNull();
    });
    it('strictly decodes discovery and rejects identity fields or unknown versions', () => {
        const data = {
            activeSession: null,
            needsReviewCount: 0,
            reviewScopeVersion: 1,
        };

        expect(decodeOwnerUxResponse('discover_scan_session', {
            contractVersion: OWNER_UX_CONTRACT_VERSION,
            data,
        })).toEqual(data);

        expect(() => decodeOwnerUxResponse('discover_scan_session', {
            contractVersion: OWNER_UX_CONTRACT_VERSION,
            data: { ...data, storeId: uuid(9) },
        })).toThrow(OwnerUxResponseContractError);
        expect(() => decodeOwnerUxResponse('discover_scan_session', {
            contractVersion: 'phase9-owner-ux-v2',
            data,
        })).toThrow(OwnerUxResponseContractError);
    });

    it('strictly decodes the five Unit 6B-assigned query responses', () => {
        const closeSummary = {
            imagesSubmitted: 1,
            imagesProcessed: 1,
            imagesFailed: 0,
            imagesSkipped: 0,
            candidatesDetected: 1,
            candidatesReviewReady: 0,
            candidatesNeedsReview: 1,
            candidatesFailed: 0,
            falseDetections: 0,
            manualMissedCandidates: 0,
            committedInventoryItems: 0,
            quantitiesAddedToExisting: 0,
            privateItems: 0,
            publishedItems: 0,
            languageSkips: 0,
            candidateCapSkips: 0,
            qualitySkips: 0,
        };
        const blockerCounts = {
            input_processing: 0,
            candidate_processing: 0,
            candidate_failed: 0,
            review_missing: 1,
            title_unconfirmed: 0,
            author_confirmation_incomplete: 0,
            language_missing: 0,
            metadata_choice_missing: 0,
            quantity_invalid: 0,
            price_invalid: 0,
            condition_missing: 0,
            damage_answer_missing: 0,
            damage_details_missing: 0,
            location_missing: 0,
            publication_intent_missing: 0,
            duplicate_intent_missing: 0,
            variant_source_stale: 0,
        };
        const candidate = {
            sessionId: uuid(1),
            candidateId: uuid(2),
            inputId: null,
            ordinal: 1,
            candidateState: 'needs_review',
            candidateVersion: 1,
            observed: { title: 'The Book', authors: ['One Author'], language: 'en', script: 'Latn' },
            metadata: {
                state: 'manual',
                revision: 1,
                selectionVersion: null,
                selectionId: null,
                canonicalEditionId: null,
                snapshot: null,
            },
            review: { value: null, reviewVersion: null },
            duplicateAdvice: {
                state: 'none',
                version: null,
                targetInventoryId: null,
                matchReason: null,
                compatibility: null,
                display: null,
                allowedIntents: [],
            },
            variantSummary: { unresolvedCount: 0, proposalVersions: [] },
            attentionCodes: ['metadata_manual_required'],
            readiness: {
                reviewReady: false,
                blockers: [{
                    code: 'review_missing',
                    candidateId: uuid(2),
                    inputId: null,
                    field: null,
                    safeMessage: 'Review this book.',
                }],
                derivedFromCandidateVersion: 1,
                derivedFromMetadataRevision: 1,
                derivedFromDuplicateAdviceVersion: null,
            },
            allowedActions: ['save_review', 'mark_false', 'add_missed', 'view_readiness'],
            updatedAt: '2026-07-30T00:00:00.000Z',
        };
        const session = {
            sessionId: uuid(1),
            status: 'active',
            sessionVersion: 1,
            startedAt: '2026-07-30T00:00:00.000Z',
            updatedAt: '2026-07-30T00:00:00.000Z',
            closedAt: null,
            expiresAt: '2026-08-30T00:00:00.000Z',
            defaults: {
                language: 'en',
                script: null,
                condition: 'good',
                location: 'A1',
                quantity: 1,
                publication: 'private',
            },
            closeSummary,
            allInputsTerminal: true,
            closeState: 'closeable',
            presentationRevision: 1,
        };
        const candidatePage = {
            items: [{
                sessionId: uuid(1),
                sessionStartedAt: '2026-07-30T00:00:00.000Z',
                sessionExpiresAt: '2026-08-30T00:00:00.000Z',
                sessionStatus: 'active',
                candidateId: uuid(2),
                inputId: null,
                ordinal: 1,
                title: 'The Book',
                authors: ['One Author'],
                language: 'en',
                candidateState: 'needs_review',
                candidateVersion: 1,
                metadataState: 'manual',
                reviewDisposition: null,
                attentionCodes: ['metadata_manual_required'],
                reviewReady: false,
                updatedAt: '2026-07-30T00:00:00.000Z',
            }],
            pageInfo: { nextCursor: null, hasMore: false },
            scopeVersion: 1,
            sessionVersion: 1,
        };
        const readiness = {
            sessionId: uuid(1),
            sessionStatus: 'active',
            sessionVersion: 1,
            allInputsTerminal: true,
            closeSummary,
            blockerCounts,
            nextBlockingCandidateId: uuid(2),
            closeState: 'closeable',
            closeAllowed: true,
            presentationRevision: 1,
        };

        for (const [action, data] of [
            ['read_scan_session', session],
            ['list_scan_candidates', candidatePage],
            ['read_scan_candidate', candidate],
            ['read_scan_readiness', readiness],
        ] as const) {
            expect(decodeOwnerUxResponse(action, {
                contractVersion: OWNER_UX_CONTRACT_VERSION,
                data,
            })).toEqual(data);
        }

        expect(() => decodeOwnerUxResponse('read_scan_candidate', {
            contractVersion: OWNER_UX_CONTRACT_VERSION,
            data: {
                ...candidate,
                observed: { ...candidate.observed, language: 'EN_us' },
            },
        })).toThrow(OwnerUxResponseContractError);
        expect(() => decodeOwnerUxResponse('read_scan_candidate', {
            contractVersion: OWNER_UX_CONTRACT_VERSION,
            data: {
                ...candidate,
                metadata: {
                    ...candidate.metadata,
                    state: 'selected',
                    selectionVersion: null,
                },
            },
        })).toThrow(OwnerUxResponseContractError);
        expect(() => decodeOwnerUxResponse('read_scan_candidate', {
            contractVersion: OWNER_UX_CONTRACT_VERSION,
            data: {
                ...candidate,
                readiness: {
                    ...candidate.readiness,
                    derivedFromCandidateVersion: 2,
                },
            },
        })).toThrow(OwnerUxResponseContractError);
    });

    it('maps malformed nested data to a response-contract failure', () => {
        expect(() => decodeOwnerUxResponse('read_scan_candidate', {
            contractVersion: OWNER_UX_CONTRACT_VERSION,
            data: {
                sessionId: uuid(1),
                candidateId: uuid(2),
                raw_payload: { title: 'private' },
            },
        })).toThrow(OwnerUxResponseContractError);
    });

    it('rejects non-canonical language, active text, and inconsistent paging', () => {
        expect(() => decodeOwnerUxResponse('discover_scan_session', {
            contractVersion: OWNER_UX_CONTRACT_VERSION,
            data: {
                activeSession: null,
                needsReviewCount: 0,
                reviewScopeVersion: 1,
                note: 'https://private.example',
            },
        })).toThrow(OwnerUxResponseContractError);
        expect(() => decodeOwnerUxResponse('list_scan_candidates', {
            contractVersion: OWNER_UX_CONTRACT_VERSION,
            data: {
                items: [],
                pageInfo: { nextCursor: null, hasMore: true },
                scopeVersion: 1,
                sessionVersion: null,
            },
        })).toThrow(OwnerUxResponseContractError);
    });
});
