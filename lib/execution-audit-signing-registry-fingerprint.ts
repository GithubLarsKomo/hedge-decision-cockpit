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

export function serializeExecutionAuditSigningRegistryFingerprint(
  fingerprint: ExecutionAuditSigningRegistryFingerprint
) {
  return `${JSON.stringify(fingerprint, null, 2)}\n`;
}
