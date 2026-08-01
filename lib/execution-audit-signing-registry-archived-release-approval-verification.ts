import { parseTrustedExecutionAuditSigningKeyRegistry } from './execution-audit-evidence-trusted-keys';
import {
  parseExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignature,
  verifyExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignatureWithRegistry
} from './execution-audit-signing-registry-release-bundle-verification-receipt-signature';

const SHA256 = /^[a-f0-9]{64}$/;

export type ArchivedReleaseApprovalReceipt = {
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

export function parseArchivedReleaseApprovalReceipt(content: string): ArchivedReleaseApprovalReceipt {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Archived release approval receipt must contain valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Archived release approval receipt must be a JSON object.');
  }
  const receipt = parsed as Record<string, unknown>;
  if (receipt.schemaVersion !== '1.0') throw new Error('Unsupported archived release approval receipt schemaVersion.');
  if (receipt.valid !== true) throw new Error('Archived release approval receipt must record valid=true.');
  for (const field of ['verifiedAt', 'manifestSignedAt']) {
    if (typeof receipt[field] !== 'string' || !Number.isFinite(Date.parse(receipt[field] as string))) {
      throw new Error(`${field} must be a valid timestamp.`);
    }
  }
  if (typeof receipt.manifestSigningKeyId !== 'string' || !receipt.manifestSigningKeyId.trim()) {
    throw new Error('manifestSigningKeyId must not be empty.');
  }
  for (const field of [
    'manifestSha256', 'manifestSignatureSha256', 'trustedKeysSha256', 'registrySha256',
    'fingerprintSha256', 'signatureSha256', 'trustRegistrySha256'
  ]) {
    if (typeof receipt[field] !== 'string' || !SHA256.test(receipt[field] as string)) {
      throw new Error(`${field} must be a lowercase SHA-256 digest.`);
    }
  }
  return receipt as ArchivedReleaseApprovalReceipt;
}

export function verifyArchivedReleaseApproval(input: {
  receiptContent: string;
  receiptSignatureContent: string;
  trustedKeysContent: string;
}) {
  const receipt = parseArchivedReleaseApprovalReceipt(input.receiptContent);
  const signature = parseExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignature(
    input.receiptSignatureContent
  );
  const verification = verifyExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignatureWithRegistry(
    input.receiptContent,
    signature,
    parseTrustedExecutionAuditSigningKeyRegistry(input.trustedKeysContent)
  );
  return { valid: verification.valid, receipt, signature: verification };
}
