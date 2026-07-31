import { createHash } from 'node:crypto';
import {
  parseTrustedExecutionAuditSigningKeyRegistry,
  serializeTrustedExecutionAuditSigningKeyRegistry,
  type TrustedExecutionAuditSigningKeyRegistry
} from './execution-audit-evidence-trusted-keys';

export type ExecutionAuditSigningRegistryFingerprint = {
  schemaVersion: '1.0';
  algorithm: 'SHA-256';
  registrySha256: string;
  registryByteLength: number;
  keyCount: number;
  keyIds: string[];
};

function assertFingerprint(value: ExecutionAuditSigningRegistryFingerprint) {
  if (value.schemaVersion !== '1.0') throw new Error('Unsupported registry fingerprint schemaVersion.');
  if (value.algorithm !== 'SHA-256') throw new Error('Unsupported registry fingerprint algorithm.');
  if (!/^[a-f0-9]{64}$/.test(value.registrySha256)) throw new Error('registrySha256 must be a lowercase SHA-256 digest.');
  if (!Number.isSafeInteger(value.registryByteLength) || value.registryByteLength < 0) {
    throw new Error('registryByteLength must be a non-negative integer.');
  }
  if (!Number.isSafeInteger(value.keyCount) || value.keyCount < 1) throw new Error('keyCount must be a positive integer.');
  if (!Array.isArray(value.keyIds) || value.keyIds.length !== value.keyCount) {
    throw new Error('keyIds must match keyCount.');
  }
  if (value.keyIds.some((keyId, index) => !keyId.trim() || (index > 0 && value.keyIds[index - 1].localeCompare(keyId) >= 0))) {
    throw new Error('keyIds must be unique, non-empty and sorted.');
  }
}

export function createExecutionAuditSigningRegistryFingerprint(
  registry: TrustedExecutionAuditSigningKeyRegistry
): ExecutionAuditSigningRegistryFingerprint {
  const canonicalRegistry = serializeTrustedExecutionAuditSigningKeyRegistry(registry);
  const normalized = parseTrustedExecutionAuditSigningKeyRegistry(canonicalRegistry);

  return {
    schemaVersion: '1.0',
    algorithm: 'SHA-256',
    registrySha256: createHash('sha256').update(canonicalRegistry, 'utf8').digest('hex'),
    registryByteLength: Buffer.byteLength(canonicalRegistry, 'utf8'),
    keyCount: normalized.keys.length,
    keyIds: normalized.keys.map(key => key.keyId)
  };
}

export function parseExecutionAuditSigningRegistryFingerprint(content: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Registry fingerprint must contain valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Registry fingerprint must be a JSON object.');
  }
  const fingerprint = parsed as ExecutionAuditSigningRegistryFingerprint;
  assertFingerprint(fingerprint);
  return fingerprint;
}

export function verifyExecutionAuditSigningRegistryFingerprint(
  registry: TrustedExecutionAuditSigningKeyRegistry,
  expected: ExecutionAuditSigningRegistryFingerprint
) {
  assertFingerprint(expected);
  const actual = createExecutionAuditSigningRegistryFingerprint(registry);
  return {
    valid:
      actual.registrySha256 === expected.registrySha256 &&
      actual.registryByteLength === expected.registryByteLength &&
      actual.keyCount === expected.keyCount &&
      actual.keyIds.every((keyId, index) => keyId === expected.keyIds[index]),
    actual,
    expected
  };
}

export function serializeExecutionAuditSigningRegistryFingerprint(
  fingerprint: ExecutionAuditSigningRegistryFingerprint
) {
  assertFingerprint(fingerprint);
  return `${JSON.stringify(fingerprint, null, 2)}\n`;
}
