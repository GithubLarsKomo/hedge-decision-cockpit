import {
  verifyExecutionAuditSigningRegistryFingerprint,
  type ExecutionAuditSigningRegistryFingerprint
} from './execution-audit-signing-registry-fingerprint';
import {
  verifyExecutionAuditSigningRegistryFingerprintSignatureWithRegistry
} from './execution-audit-signing-registry-fingerprint-signature-registry';
import type { ExecutionAuditSigningRegistryFingerprintSignature } from './execution-audit-signing-registry-fingerprint-signature';
import type { TrustedExecutionAuditSigningKeyRegistry } from './execution-audit-evidence-trusted-keys';

export function verifyExecutionAuditSigningRegistryRelease(
  registry: TrustedExecutionAuditSigningKeyRegistry,
  fingerprintContent: string,
  fingerprint: ExecutionAuditSigningRegistryFingerprint,
  signature: ExecutionAuditSigningRegistryFingerprintSignature,
  trustedSigningKeys: TrustedExecutionAuditSigningKeyRegistry
) {
  const fingerprintResult = verifyExecutionAuditSigningRegistryFingerprint(registry, fingerprint);
  const signatureResult = verifyExecutionAuditSigningRegistryFingerprintSignatureWithRegistry(
    fingerprintContent,
    signature,
    trustedSigningKeys
  );

  return {
    valid: fingerprintResult.valid && signatureResult.valid,
    registryFingerprintValid: fingerprintResult.valid,
    fingerprintSignatureValid: signatureResult.valid,
    actualFingerprint: fingerprintResult.actual,
    expectedFingerprint: fingerprintResult.expected,
    signingKey: {
      keyId: signatureResult.keyId,
      signedAt: signatureResult.signedAt,
      activeFrom: signatureResult.activeFrom,
      ...(signatureResult.revokedAt ? { revokedAt: signatureResult.revokedAt } : {})
    }
  };
}
