import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  serializeExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignature,
  signExecutionAuditSigningRegistryReleaseBundleVerificationReceipt
} from './execution-audit-signing-registry-release-bundle-verification-receipt-signature';
import { verifyArchivedReleaseApproval } from './execution-audit-signing-registry-archived-release-approval-verification';

function fixture() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const receipt = {
    schemaVersion: '1.0', verifiedAt: '2026-08-01T04:00:00.000Z', valid: true,
    manifestSha256: 'a'.repeat(64), manifestSignatureSha256: 'b'.repeat(64),
    trustedKeysSha256: 'c'.repeat(64), registrySha256: 'd'.repeat(64),
    fingerprintSha256: 'e'.repeat(64), signatureSha256: 'f'.repeat(64),
    trustRegistrySha256: '0'.repeat(64), manifestSigningKeyId: 'manifest-1',
    manifestSignedAt: '2026-08-01T03:00:00.000Z'
  };
  const receiptContent = `${JSON.stringify(receipt, null, 2)}\n`;
  const signature = signExecutionAuditSigningRegistryReleaseBundleVerificationReceipt(
    receiptContent,
    privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    'approval-1',
    '2026-08-01T04:01:00.000Z'
  );
  const trustedKeysContent = JSON.stringify({
    schemaVersion: '1.0',
    keys: [{
      keyId: 'approval-1',
      publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
      activeFrom: '2026-01-01T00:00:00.000Z'
    }]
  });
  return {
    receiptContent,
    receiptSignatureContent: serializeExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignature(signature),
    trustedKeysContent
  };
}

test('verifies a structurally valid archived approval pair', () => {
  const result = verifyArchivedReleaseApproval(fixture());
  assert.equal(result.valid, true);
  assert.equal(result.signature.keyId, 'approval-1');
});

test('returns invalid for a modified archived receipt', () => {
  const input = fixture();
  input.receiptContent = input.receiptContent.replace('manifest-1', 'manifest-2');
  assert.equal(verifyArchivedReleaseApproval(input).valid, false);
});

test('rejects malformed archived receipt digests', () => {
  const input = fixture();
  input.receiptContent = input.receiptContent.replace('a'.repeat(64), 'not-a-digest');
  assert.throws(() => verifyArchivedReleaseApproval(input), /manifestSha256/);
});
