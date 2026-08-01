import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  serializeExecutionAuditSigningRegistryVerificationReceiptSignature,
  signExecutionAuditSigningRegistryVerificationReceipt,
  verifyExecutionAuditSigningRegistryVerificationReceiptSignature
} from './execution-audit-signing-registry-verification-receipt-signature';

function createKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString()
  };
}

test('signs and verifies an unchanged verification receipt', () => {
  const keys = createKeys();
  const receipt = '{"schemaVersion":"1.0","valid":true}\n';
  const signature = signExecutionAuditSigningRegistryVerificationReceipt(
    receipt,
    keys.privateKeyPem,
    'receipt-governance-key-1',
    '2026-08-01T00:40:00+02:00'
  );
  assert.equal(signature.signedAt, '2026-07-31T22:40:00.000Z');
  assert.equal(verifyExecutionAuditSigningRegistryVerificationReceiptSignature(receipt, signature, keys.publicKeyPem), true);
  assert.equal(serializeExecutionAuditSigningRegistryVerificationReceiptSignature(signature).endsWith('\n'), true);
});

test('rejects changed receipts and unrelated public keys', () => {
  const signer = createKeys();
  const other = createKeys();
  const signature = signExecutionAuditSigningRegistryVerificationReceipt('receipt', signer.privateKeyPem, 'key-1');
  assert.equal(verifyExecutionAuditSigningRegistryVerificationReceiptSignature('changed', signature, signer.publicKeyPem), false);
  assert.equal(verifyExecutionAuditSigningRegistryVerificationReceiptSignature('receipt', signature, other.publicKeyPem), false);
});

test('rejects invalid metadata and non-Ed25519 keys', () => {
  const keys = createKeys();
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rsaPrivate = rsa.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  assert.throws(() => signExecutionAuditSigningRegistryVerificationReceipt('receipt', keys.privateKeyPem, '  '), /keyId/);
  assert.throws(() => signExecutionAuditSigningRegistryVerificationReceipt('receipt', keys.privateKeyPem, 'key-1', 'invalid'), /signedAt/);
  assert.throws(() => signExecutionAuditSigningRegistryVerificationReceipt('receipt', rsaPrivate, 'key-1'), /Ed25519/);
});
