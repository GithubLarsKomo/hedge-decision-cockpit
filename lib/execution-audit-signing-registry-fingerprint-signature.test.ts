import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  serializeExecutionAuditSigningRegistryFingerprintSignature,
  signExecutionAuditSigningRegistryFingerprint,
  verifyExecutionAuditSigningRegistryFingerprintSignature
} from './execution-audit-signing-registry-fingerprint-signature';

function createKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString()
  };
}

test('signs and verifies an unchanged registry fingerprint', () => {
  const keys = createKeys();
  const fingerprint = '{"schemaVersion":"1.0","registrySha256":"abc"}\n';
  const signature = signExecutionAuditSigningRegistryFingerprint(
    fingerprint,
    keys.privateKeyPem,
    'registry-governance-key-1',
    '2026-07-31T22:00:00+02:00'
  );

  assert.equal(signature.algorithm, 'Ed25519');
  assert.equal(signature.keyId, 'registry-governance-key-1');
  assert.equal(signature.signedAt, '2026-07-31T20:00:00.000Z');
  assert.equal(verifyExecutionAuditSigningRegistryFingerprintSignature(fingerprint, signature, keys.publicKeyPem), true);
  assert.equal(serializeExecutionAuditSigningRegistryFingerprintSignature(signature).endsWith('\n'), true);
});

test('rejects changed fingerprints and unrelated public keys', () => {
  const signer = createKeys();
  const other = createKeys();
  const signature = signExecutionAuditSigningRegistryFingerprint('fingerprint', signer.privateKeyPem, 'key-1');

  assert.equal(verifyExecutionAuditSigningRegistryFingerprintSignature('changed', signature, signer.publicKeyPem), false);
  assert.equal(verifyExecutionAuditSigningRegistryFingerprintSignature('fingerprint', signature, other.publicKeyPem), false);
});

test('rejects invalid metadata and non-Ed25519 keys', () => {
  const keys = createKeys();
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rsaPrivate = rsa.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const signature = signExecutionAuditSigningRegistryFingerprint('fingerprint', keys.privateKeyPem, 'key-1');

  assert.throws(() => signExecutionAuditSigningRegistryFingerprint('fingerprint', keys.privateKeyPem, '  '), /keyId/);
  assert.throws(() => signExecutionAuditSigningRegistryFingerprint('fingerprint', keys.privateKeyPem, 'key-1', 'invalid'), /signedAt/);
  assert.throws(() => signExecutionAuditSigningRegistryFingerprint('fingerprint', rsaPrivate, 'key-1'), /Ed25519/);
  assert.throws(
    () => verifyExecutionAuditSigningRegistryFingerprintSignature(
      'fingerprint',
      { ...signature, algorithm: 'RSA' as 'Ed25519' },
      keys.publicKeyPem
    ),
    /algorithm/
  );
});
