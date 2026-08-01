import {
  resolveTrustedExecutionAuditSigningKey,
  type TrustedExecutionAuditSigningKeyRegistry
} from './execution-audit-evidence-trusted-keys';
import {
  verifyExecutionAuditSigningRegistryReleaseManifestSignature,
  type ExecutionAuditSigningRegistryReleaseManifestSignature
} from './execution-audit-signing-registry-release-manifest-signature';

export function verifyExecutionAuditSigningRegistryReleaseManifestSignatureWithRegistry(
  manifestContent: string,
  signature: ExecutionAuditSigningRegistryReleaseManifestSignature,
  registry: TrustedExecutionAuditSigningKeyRegistry
) {
  const key = resolveTrustedExecutionAuditSigningKey(registry, signature.keyId, signature.signedAt);
  return {
    valid: verifyExecutionAuditSigningRegistryReleaseManifestSignature(
      manifestContent,
      signature,
      key.publicKeyPem
    ),
    keyId: key.keyId,
    signedAt: signature.signedAt,
    activeFrom: key.activeFrom,
    ...(key.revokedAt ? { revokedAt: key.revokedAt } : {})
  };
}
