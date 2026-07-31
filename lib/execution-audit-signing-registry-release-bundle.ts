import {
  parseTrustedExecutionAuditSigningKeyRegistry,
  resolveTrustedExecutionAuditSigningKey
} from './execution-audit-evidence-trusted-keys';
import {
  parseExecutionAuditSigningRegistryFingerprint,
  verifyExecutionAuditSigningRegistryFingerprint
} from './execution-audit-signing-registry-fingerprint';
import {
  parseExecutionAuditSigningRegistryFingerprintSignature,
  verifyExecutionAuditSigningRegistryFingerprintSignature
} from './execution-audit-signing-registry-fingerprint-signature';

export function verifyExecutionAuditSigningRegistryReleaseBundle(input: {
  registryContent: string;
  fingerprintContent: string;
  signatureContent: string;
  trustedKeysContent: string;
}) {
  const registry = parseTrustedExecutionAuditSigningKeyRegistry(input.registryContent);
  const fingerprint = parseExecutionAuditSigningRegistryFingerprint(input.fingerprintContent);
  const fingerprintVerification = verifyExecutionAuditSigningRegistryFingerprint(registry, fingerprint);
  if (!fingerprintVerification.valid) {
    return {
      valid: false,
      registryValid: false,
      signatureValid: false,
      keyId: null,
      signedAt: null
    };
  }

  const signature = parseExecutionAuditSigningRegistryFingerprintSignature(input.signatureContent);
  const trustedKeys = parseTrustedExecutionAuditSigningKeyRegistry(input.trustedKeysContent);
  const trustedKey = resolveTrustedExecutionAuditSigningKey(trustedKeys, signature.keyId, signature.signedAt);
  const signatureValid = verifyExecutionAuditSigningRegistryFingerprintSignature(
    input.fingerprintContent,
    signature,
    trustedKey.publicKeyPem
  );

  return {
    valid: signatureValid,
    registryValid: true,
    signatureValid,
    keyId: signature.keyId,
    signedAt: signature.signedAt
  };
}
