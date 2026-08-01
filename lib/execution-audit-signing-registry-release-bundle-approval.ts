import { parseTrustedExecutionAuditSigningKeyRegistry } from './execution-audit-evidence-trusted-keys';
import {
  createExecutionAuditSigningRegistryReleaseBundleVerificationReceipt,
  serializeExecutionAuditSigningRegistryReleaseBundleVerificationReceipt
} from './execution-audit-signing-registry-release-bundle-verification-receipt';
import {
  serializeExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignature,
  signExecutionAuditSigningRegistryReleaseBundleVerificationReceipt,
  verifyExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignatureWithRegistry
} from './execution-audit-signing-registry-release-bundle-verification-receipt-signature';

export function approveExecutionAuditSigningRegistryReleaseBundle(
  input: {
    manifestContent: string;
    manifestSignatureContent: string;
    trustedKeysContent: string;
    registryContent: string;
    fingerprintContent: string;
    signatureContent: string;
    trustRegistryContent: string;
  },
  privateKeyPem: string,
  keyId: string,
  verifiedAt = new Date().toISOString(),
  signedAt = verifiedAt
) {
  const receipt = createExecutionAuditSigningRegistryReleaseBundleVerificationReceipt(input, verifiedAt);
  const receiptContent = serializeExecutionAuditSigningRegistryReleaseBundleVerificationReceipt(receipt);
  const signature = signExecutionAuditSigningRegistryReleaseBundleVerificationReceipt(
    receiptContent,
    privateKeyPem,
    keyId,
    signedAt
  );
  const signatureContent = serializeExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignature(signature);
  const verification = verifyExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignatureWithRegistry(
    receiptContent,
    signature,
    parseTrustedExecutionAuditSigningKeyRegistry(input.trustedKeysContent)
  );
  if (!verification.valid) throw new Error('Generated release bundle approval signature did not verify.');

  return { receipt, receiptContent, signature, signatureContent, verification };
}
