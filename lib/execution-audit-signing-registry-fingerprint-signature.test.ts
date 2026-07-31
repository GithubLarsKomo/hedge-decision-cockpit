import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  serializeExecutionAuditSigningRegistryFingerprintSignature,
  signExecutionAuditSigningRegistryFingerprint,
  verifyExecutionAuditSigningRegistryFingerprintSignature
} from './execution-audit-signing-registry-fingerprint-signature';
import type { ExecutionAuditSigningRegistryFingerprint } from './execution-audit-signing-registry-fingerprint';

function createKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString()
  };
}

const fingerprint: ExecutionAuditSigningRegistryFingerprint = {
  schemaVersion: '1.0',
  algorithm: 'SHA-256',
  registrySha256: 'a'.repeat(64),
  registryByteLength: 512,
  keyCount: 2,
  keyIds: ['key-a', 'key-b']
};

test('signs and verifies a registry fingerprint', () => {
  const keys = createKeys();
  const signature = signExecutionAuditSigningRegistryFingerprint(
    fingerprint,
    keys.privateKeyPem,
    'governance-key-1',
    '2026-07-31T22:00:00+02:00'
  );

  assert.equal(signature.keyId, 'governance-key-1');
  assert.equal(signature.signedAt, '2026-07-31T20:00:00.000Z');
  assert.equal(verifyExecutionAuditSigningRegistryFingerprintSignature(fingerprint, signature, keys.publicKeyPem), true);
  assert.equal(serializeExecutionAuditSigningRegistryFingerprintSignature(signature).endsWith('\n'), true);
});

test('rejects changed fingerprints and unrelated public keys', () => {
  const signer = createKeys();
  const other = createKeys();
  const signature = signExecutionAuditSigningRegistryFingerprint(fingerprint, signer.privateKeyPem, 'key-1');

  assert.equal(
    verifyExecutionAuditSigningRegistryFingerprintSignature(
      { ...fingerprint, registrySha256: 'b'.repeat(64) },
      signature,
      signer.publicKeyPem
    ),
    false
  );
  assert.equal(verifyExecutionAuditSigningRegistryFingerprintSignature(fingerprint, signature, other.publicKeyPem), false);
});
