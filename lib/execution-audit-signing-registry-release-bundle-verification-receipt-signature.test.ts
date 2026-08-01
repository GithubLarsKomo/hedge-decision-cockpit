import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  signExecutionAuditSigningRegistryReleaseBundleVerificationReceipt,
  verifyExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignatureWithRegistry
} from './execution-audit-signing-registry-release-bundle-verification-receipt-signature';

function createKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString()
  };
}

test('signs and verifies an unchanged bundle verification receipt with a trusted key', () => {
  const keys = createKeys();
  const receipt = '{"schemaVersion":"1.0","valid":true}\n';
  const signature = signExecutionAuditSigningRegistryReleaseBundleVerificationReceipt(
    receipt, keys.privateKeyPem, 'bundle-receipt-key-1', '2026-08-01T03:30:00Z'
  );
  const result = verifyExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignatureWithRegistry(
    receipt,
    signature,
    { schemaVersion: '1.0', keys: [{ keyId: 'bundle-receipt-key-1', publicKeyPem: keys.publicKeyPem, activeFrom: '2026-01-01T00:00:00Z' }] }
  );
  assert.equal(result.valid, true);
  assert.equal(result.keyId, 'bundle-receipt-key-1');
});

test('rejects changed receipts and revoked keys', () => {
  const keys = createKeys();
  const signature = signExecutionAuditSigningRegistryReleaseBundleVerificationReceipt(
    'receipt', keys.privateKeyPem, 'key-1', '2026-08-01T03:30:00Z'
  );
  const registry = { schemaVersion: '1.0' as const, keys: [{ keyId: 'key-1', publicKeyPem: keys.publicKeyPem, activeFrom: '2026-01-01T00:00:00Z' }] };
  assert.equal(verifyExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignatureWithRegistry('changed', signature, registry).valid, false);
  assert.throws(() => verifyExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignatureWithRegistry('receipt', signature, {
    schemaVersion: '1.0', keys: [{ ...registry.keys[0], revokedAt: '2026-07-01T00:00:00Z' }]
  }), /revoked/);
});
