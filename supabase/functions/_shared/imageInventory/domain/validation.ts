export class Phase9ContractError extends Error {
  constructor(
    readonly field: string,
    readonly reason: string,
  ) {
    super(`${field}: ${reason}`);
    this.name = 'Phase9ContractError';
  }
}

const CONTROL_OR_BIDI = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u;
const ACTIVE_CONTENT = /(?:https?:\/\/|file:\/\/|javascript:|data:text\/html|<\/?[a-z][^>]*>|\[[^\]]+\]\([^)]*\)|(?:^|\s)(?:\.\.?[/\\]|[A-Za-z]:\\|\\\\[^\s\\]+\\[^\s\\]+|\/(?:[^/\s]+\/)+[^/\s]+)|\b(?:SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+.+\s+SET|DELETE\s+FROM|DROP\s+(?:TABLE|SCHEMA|DATABASE)|ALTER\s+(?:TABLE|SCHEMA)|TRUNCATE\s+TABLE)\b|\b(?:curl|wget|powershell|cmd\.exe|bash|sh)\s+[-/]|\brm\s+-rf\b)/iu;

export function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Phase9ContractError(field, 'must be an object');
  }
  return value as Record<string, unknown>;
}

export function assertKnownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Phase9ContractError(field, `unknown keys: ${unknown.sort().join(', ')}`);
  }
}

export function requiredString(
  value: unknown,
  field: string,
  maxLength: number,
  options: { activeContent?: boolean; pattern?: RegExp } = {},
): string {
  if (typeof value !== 'string') throw new Phase9ContractError(field, 'must be a string');
  const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!normalized) throw new Phase9ContractError(field, 'must not be empty');
  if (normalized.length > maxLength) throw new Phase9ContractError(field, `exceeds ${maxLength} characters`);
  if (CONTROL_OR_BIDI.test(normalized)) throw new Phase9ContractError(field, 'contains control or bidi characters');
  if (options.activeContent !== false && ACTIVE_CONTENT.test(normalized)) {
    throw new Phase9ContractError(field, 'contains active or operational content');
  }
  if (options.pattern && !options.pattern.test(normalized)) {
    throw new Phase9ContractError(field, 'has an invalid format');
  }
  return normalized;
}

export function optionalString(value: unknown, field: string, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  return requiredString(value, field, maxLength);
}

export function boundedInteger(value: unknown, field: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new Phase9ContractError(field, `must be a safe integer from ${min} to ${max}`);
  }
  return value as number;
}

export function boundedNumber(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Phase9ContractError(field, `must be a finite number from ${min} to ${max}`);
  }
  return value;
}

export function canonicalBcp47(value: unknown, field = 'language'): string {
  const tag = requiredString(value, field, PHASE9_LIMITS.languageTagChars, { activeContent: false });
  const parts = tag.split('-');
  if (!/^[A-Za-z]{2,3}$/u.test(parts[0]) || parts.some((part) => !/^[A-Za-z0-9]{2,8}$/u.test(part))) {
    throw new Phase9ContractError(field, 'must be a supported BCP 47-shaped language tag');
  }
  return parts.map((part, index) => {
    if (index === 0) return part.toLowerCase();
    if (part.length === 4 && /^[A-Za-z]+$/u.test(part)) return `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`;
    if ((part.length === 2 && /^[A-Za-z]+$/u.test(part)) || /^\d{3}$/u.test(part)) return part.toUpperCase();
    return part.toLowerCase();
  }).join('-');
}

export function utf8ByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function assertRawPayloadWithinLimit(value: unknown, field = 'raw_payload'): void {
  const bytes = utf8ByteLength(value);
  if (bytes > PHASE9_LIMITS.rawPayloadBytes) {
    throw new Phase9ContractError(field, `exceeds ${PHASE9_LIMITS.rawPayloadBytes} bytes`);
  }
}

export function parseQuantity(value: unknown): number {
  return boundedInteger(value, 'quantity', 1, PHASE9_LIMITS.quantity);
}

export function parsePrivateInventoryPrice(value: unknown): number {
  return boundedInteger(value, 'price_paise', 0, PHASE9_LIMITS.moneyMinor);
}

export function parsePublicationPrice(value: unknown): number {
  return boundedInteger(value, 'price_paise', 1, PHASE9_LIMITS.moneyMinor);
}

export function parseIdempotencyKey(value: unknown): string {
  return requiredString(value, 'idempotency_key', PHASE9_LIMITS.idempotencyKeyChars, {
    activeContent: false,
    pattern: /^[A-Za-z0-9._:-]{16,128}$/u,
  });
}

export function parseCommandId(value: unknown): string {
  return requiredString(value, 'command_id', PHASE9_LIMITS.commandIdChars, {
    activeContent: false,
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
  });
}

export function assertNoForbiddenTelemetryFields(value: unknown, field = 'telemetry'): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if ((PHASE9_FORBIDDEN_TELEMETRY_FIELDS as readonly string[]).includes(key) || isPrivacySensitiveKey(key)) {
      throw new Phase9ContractError(`${field}.${key}`, 'forbidden telemetry field');
    }
    assertNoForbiddenTelemetryFields(nested, `${field}.${key}`);
  }
}
import { PHASE9_FORBIDDEN_TELEMETRY_FIELDS, PHASE9_LIMITS } from '../contracts/registers';
import { isPrivacySensitiveKey } from '../contracts/privacy';
