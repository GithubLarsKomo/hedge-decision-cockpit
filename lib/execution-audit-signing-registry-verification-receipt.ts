import { createHash } from 'node:crypto';
import { verifyExecutionAuditSigningRegistryChain } from './execution-audit-signing-registry-chain';

export type ExecutionAuditSigningRegistryVerificationReceipt = {
  schemaVersion: '1.0';
  verifiedAt: string;
  valid: true;
  registrySha256: string;
  fingerprintSha256: string;
  signatureSha256: string;
  trustRegistrySha256: string;
  signingKeyId: string;
  signedAt: string;
};

function sha256(content: string) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function createExecutionAuditSigningRegistryVerificationReceipt(
  registryContent: string,
  fingerprintContent: string,
  signatureContent: string,
  trustRegistryContent: string,
  verifiedAt = new Date().toISOString()
): ExecutionAuditSigningRegistryVerificationReceipt {
  const timestamp = Date.parse(verifiedAt);
  if (!Number.isFinite(timestamp)) throw new Error('verifiedAt must be a valid timestamp.');
  const verification = verifyExecutionAuditSigningRegistryChain(
    registryContent,
    fingerprintContent,
    signatureContent,
    trustRegistryContent
  );
  if (!verification.valid) throw new Error('Cannot create a receipt for an invalid audit signing registry chain.');

  return {
    schemaVersion: '1.0',
    verifiedAt: new Date(timestamp).toISOString(),
    valid: true,
    registrySha256: sha256(registryContent),
    fingerprintSha256: sha256(fingerprintContent),
    signatureSha256: sha256(signatureContent),
    trustRegistrySha256: sha256(trustRegistryContent),
    signingKeyId: verification.signature.keyId,
    signedAt: verification.signature.signedAt
  };
}

export function serializeExecutionAuditSigningRegistryVerificationReceipt(
  receipt: ExecutionAuditSigningRegistryVerificationReceipt
) {
  return `${JSON.stringify(receipt, null, 2)}\n`;
}
