import { z } from 'zod';
import { assertNoPrivacySensitiveKeys } from './privacy.ts';
import { OwnerUxRequest, parseOwnerUxRequest } from './ownerUx.ts';
import {
  isPublicationAction, parsePublicationRequest, PublicationRequest,
} from './publication.ts';
import {
  isStoreViewAction,
  parseStoreViewRequest,
  StoreViewRequest,
} from './storeView.ts';
import {
  isStoreViewManagementAction,
  parseStoreViewManagementRequest,
  StoreViewManagementRequest,
} from './storeViewManagement.ts';

const uuid = z.string().uuid();
const contractVersion = z.literal('phase9-v1');
const idempotencyKey = z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/u);

const startSession = z.object({
  action: z.literal('start_session'),
  contractVersion,
  storeHint: uuid.optional(),
  language: z.string().min(2).max(35),
  script: z.string().min(1).max(32),
  condition: z.string().min(1).max(32),
  idempotencyKey,
  commandId: uuid,
}).strict();

const authorizeUpload = z.object({
  action: z.literal('authorize_scan_upload'),
  contractVersion,
  sessionId: uuid,
  sourceKind: z.enum(['camera', 'gallery']),
  declaredMime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  declaredBytes: z.number().int().positive().max(10_485_760),
  ordinal: z.number().int().min(1).max(15),
  idempotencyKey,
  commandId: uuid,
}).strict();

const completeUpload = z.object({
  action: z.literal('complete_scan_upload'),
  contractVersion,
  capabilityId: uuid,
  sourceKind: z.enum(['camera', 'gallery']),
  idempotencyKey,
  commandId: uuid,
}).strict();

const ownerRequest = z.discriminatedUnion('action', [startSession, authorizeUpload, completeUpload]);
const workerRequest = z.object({
  contractVersion,
  leaseOwner: z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/u),
  batchSize: z.number().int().min(1).max(10),
}).strict();
const dedicatedWorkerRequest = z.object({
  contractVersion,
  batchSize: z.number().int().min(1).max(10),
}).strict();

export type OwnerIngestionRequest = z.infer<typeof ownerRequest> | OwnerUxRequest
  | PublicationRequest | StoreViewRequest | StoreViewManagementRequest;
export type WorkerIngestionRequest = z.infer<typeof workerRequest>;
export type DedicatedWorkerRequest = z.infer<typeof dedicatedWorkerRequest>;

export function parseOwnerIngestionRequest(value: unknown): OwnerIngestionRequest {
  const result = ownerRequest.safeParse(value);
  if (!result.success) {
    const action = value && typeof value === 'object'
      ? (value as { action?: unknown }).action
      : undefined;
    if (typeof action === 'string' && [
      'discover_scan_session', 'read_scan_session', 'list_scan_inputs',
      'remove_scan_input',
      'list_scan_candidates', 'read_scan_candidate', 'update_candidate_review',
      'add_candidate_to_inventory', 'read_scan_readiness', 'close_scan_session',
    ].includes(action)) return parseOwnerUxRequest(value);
    if (isStoreViewManagementAction(action)) return parseStoreViewManagementRequest(value);
    if (isStoreViewAction(action)) return parseStoreViewRequest(value);
    if (isPublicationAction(action)) return parsePublicationRequest(value);
    const unknown = result.error.issues.some((issue) => issue.code === 'unrecognized_keys');
    throw new Error(unknown ? 'unknown keys in Owner ingestion request' : 'invalid Owner ingestion request');
  }
  return result.data;
}

export function parseWorkerIngestionRequest(value: unknown): WorkerIngestionRequest {
  const result = workerRequest.safeParse(value);
  if (!result.success) {
    const unknown = result.error.issues.some((issue) => issue.code === 'unrecognized_keys');
    throw new Error(unknown ? 'unknown keys in worker ingestion request' : 'invalid worker ingestion request');
  }
  return result.data;
}

export function parseDedicatedWorkerRequest(value: unknown): DedicatedWorkerRequest {
  const result = dedicatedWorkerRequest.safeParse(value);
  if (!result.success) {
    const unknown = result.error.issues.some((issue) => issue.code === 'unrecognized_keys');
    throw new Error(unknown ? 'unknown keys in dedicated worker request' : 'invalid dedicated worker request');
  }
  return result.data;
}

export function assertSafeIngestionResponse(value: unknown): void {
  assertNoPrivacySensitiveKeys(value, 'forbidden private ingestion field');
}

export const PHASE9_MEDIA_ENVELOPE = Object.freeze({
  maxBytes: 10_485_760,
  maxWidth: 8_192,
  maxHeight: 8_192,
  maxPixels: 16_000_000,
  outputMime: 'image/webp' as const,
});
