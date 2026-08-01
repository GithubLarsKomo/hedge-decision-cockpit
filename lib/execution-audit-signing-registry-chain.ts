import {
  parseTrustedExecutionAuditSigningKeyRegistry
} from './execution-audit-evidence-trusted-keys';
import {
  parseExecutionAuditSigningRegistryFingerprint,
  verifyExecutionAuditSigningRegistryFingerprint
} from './execution-audit-signing-registry-fingerprint';
import {
  parseExecutionAuditSigningRegistryFingerprintSignature
} from './execution-audit-signing-registry-fingerprint-signature';
import {
  verifyExecutionAuditSigningRegistryFingerprintSignatureWithRegistry
} from './execution-audit-signing-registry-fingerprint-signature-registry';

export function verifyExecutionAuditSigningRegistryChain(
  registryContent: string,
  fingerprintContent: string,
  signatureContent: string,
  trustRegistryContent: string
) {
  const registry = parseTrustedExecutionAuditSigningKeyRegistry(registryContent);
  const fingerprint = parseExecutionAuditSigningRegistryFingerprint(fingerprintContent);
  const signature = parseExecutionAuditSigningRegistryFingerprintSignature(signatureContent);
  const trustRegistry = parseTrustedExecutionAuditSigningKeyRegistry(trustRegistryContent);

  const fingerprintVerification = verifyExecutionAuditSigningRegistryFingerprint(registry, fingerprint);
  const signatureVerification = verifyExecutionAuditSigningRegistryFingerprintSignatureWithRegistry(
    fingerprintContent,
    signature,
    trustRegistry
  );

  return {
    valid: fingerprintVerification.valid && signatureVerification.valid,
    fingerprint: fingerprintVerification,
    signature: signatureVerification
  };
}
