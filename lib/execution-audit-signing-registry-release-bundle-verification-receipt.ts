import { createHash } from 'node:crypto';
import { verifyExecutionAuditSigningRegistryReleaseBundle } from './execution-audit-signing-registry-release-bundle-verification';

export type ExecutionAuditSigningRegistryReleaseBundleVerificationReceipt = {
  schemaVersion: '1.0';
  verifiedAt: string;
  valid: true;
  manifestSha256: string;
  manifestSignatureSha256: string;
  trustedKeysSha256: string;
  registrySha256: string;
  fingerprintSha256: string;
  signatureSha256: string;
  trustRegistrySha256: string;
  manifestSigningKeyId: string;
  manifestSignedAt: string;
};

function sha256(content: string) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function createExecutionAuditSigningRegistryReleaseBundleVerificationReceipt(
  input: {
    manifestContent: string;
    manifestSignatureContent: string;
    trustedKeysContent: string;
    registryContent: string;
    fingerprintContent: string;
    signatureContent: string;
    trustRegistryContent: string;
  },
  verifiedAt = new Date().toISOString()
): ExecutionAuditSigningRegistryReleaseBundleVerificationReceipt {
  const timestamp = Date.parse(verifiedAt);
  if (!Number.isFinite(timestamp)) throw new Error('verifiedAt must be a valid timestamp.');

  const verification = verifyExecutionAuditSigningRegistryReleaseBundle(input);
  if (!verification.valid) {
    throw new Error('Cannot create a receipt for an invalid signed release bundle.');
  }

  return {
    schemaVersion: '1.0',
    verifiedAt: new Date(timestamp).toISOString(),
    valid: true,
    manifestSha256: sha256(input.manifestContent),
    manifestSignatureSha256: sha256(input.manifestSignatureContent),
    trustedKeysSha256: sha256(input.trustedKeysContent),
    registrySha256: sha256(input.registryContent),
    fingerprintSha256: sha256(input.fingerprintContent),
    signatureSha256: sha256(input.signatureContent),
    trustRegistrySha256: sha256(input.trustRegistryContent),
    manifestSigningKeyId: verification.manifestSignature.keyId,
    manifestSignedAt: verification.manifestSignature.signedAt
  };
}

export function serializeExecutionAuditSigningRegistryReleaseBundleVerificationReceipt(
  receipt: ExecutionAuditSigningRegistryReleaseBundleVerificationReceipt
) {
  return `${JSON.stringify(receipt, null, 2)}\n`;
}
