import {
  resolveTrustedExecutionAuditSigningKey,
  type TrustedExecutionAuditSigningKeyRegistry
} from './execution-audit-evidence-trusted-keys';
import {
  verifyExecutionAuditSigningRegistryFingerprintSignature,
  type ExecutionAuditSigningRegistryFingerprintSignature
} from './execution-audit-signing-registry-fingerprint-signature';

export function verifyExecutionAuditSigningRegistryFingerprintSignatureWithRegistry(
  fingerprintContent: string,
  signature: ExecutionAuditSigningRegistryFingerprintSignature,
  registry: TrustedExecutionAuditSigningKeyRegistry
) {
  const key = resolveTrustedExecutionAuditSigningKey(registry, signature.keyId, signature.signedAt);
  return {
    valid: verifyExecutionAuditSigningRegistryFingerprintSignature(
      fingerprintContent,
      signature,
      key.publicKeyPem
    ),
    keyId: key.keyId,
    signedAt: signature.signedAt,
    activeFrom: key.activeFrom,
    ...(key.revokedAt ? { revokedAt: key.revokedAt } : {})
  };
}
