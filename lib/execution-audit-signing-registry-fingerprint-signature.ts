import {
  serializeExecutionAuditEvidenceSignature,
  signExecutionAuditEvidenceManifest,
  verifyExecutionAuditEvidenceManifestSignature,
  type ExecutionAuditEvidenceSignature
} from './execution-audit-evidence-signature';
import {
  serializeExecutionAuditSigningRegistryFingerprint,
  type ExecutionAuditSigningRegistryFingerprint
} from './execution-audit-signing-registry-fingerprint';

export type ExecutionAuditSigningRegistryFingerprintSignature = ExecutionAuditEvidenceSignature;

export function signExecutionAuditSigningRegistryFingerprint(
  fingerprint: ExecutionAuditSigningRegistryFingerprint,
  privateKeyPem: string,
  keyId: string,
  signedAt?: string
): ExecutionAuditSigningRegistryFingerprintSignature {
  const content = serializeExecutionAuditSigningRegistryFingerprint(fingerprint);
  return signExecutionAuditEvidenceManifest(content, privateKeyPem, keyId, signedAt);
}

export function verifyExecutionAuditSigningRegistryFingerprintSignature(
  fingerprint: ExecutionAuditSigningRegistryFingerprint,
  signature: ExecutionAuditSigningRegistryFingerprintSignature,
  publicKeyPem: string
) {
  const content = serializeExecutionAuditSigningRegistryFingerprint(fingerprint);
  return verifyExecutionAuditEvidenceManifestSignature(content, signature, publicKeyPem);
}

export function serializeExecutionAuditSigningRegistryFingerprintSignature(
  signature: ExecutionAuditSigningRegistryFingerprintSignature
) {
  return serializeExecutionAuditEvidenceSignature(signature);
}
