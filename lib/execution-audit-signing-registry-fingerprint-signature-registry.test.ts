import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { signExecutionAuditSigningRegistryFingerprint } from './execution-audit-signing-registry-fingerprint-signature';
import { verifyExecutionAuditSigningRegistryFingerprintSignatureWithRegistry } from './execution-audit-signing-registry-fingerprint-signature-registry';

function createKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString()
  };
}

test('verifies a fingerprint with a trusted active key', () => {
  const keys = createKeys();
  const fingerprint = '{"registrySha256":"abc"}\n';
  const signature = signExecutionAuditSigningRegistryFingerprint(
    fingerprint,
    keys.privateKeyPem,
    'registry-governance-1',
    '2026-07-31T20:00:00Z'
  );
  const result = verifyExecutionAuditSigningRegistryFingerprintSignatureWithRegistry(
    fingerprint,
    signature,
    {
      schemaVersion: '1.0',
      keys: [{ keyId: 'registry-governance-1', publicKeyPem: keys.publicKeyPem, activeFrom: '2026-01-01T00:00:00Z' }]
    }
  );
  assert.equal(result.valid, true);
  assert.equal(result.keyId, 'registry-governance-1');
});

test('rejects unknown, not-yet-active and revoked signing keys', () => {
  const keys = createKeys();
  const fingerprint = 'fingerprint';
  const signature = signExecutionAuditSigningRegistryFingerprint(
    fingerprint,
    keys.privateKeyPem,
    'registry-governance-1',
    '2026-07-31T20:00:00Z'
  );
  const baseKey = { keyId: 'registry-governance-1', publicKeyPem: keys.publicKeyPem };

  assert.throws(
    () => verifyExecutionAuditSigningRegistryFingerprintSignatureWithRegistry(fingerprint, signature, {
      schemaVersion: '1.0', keys: [{ ...baseKey, keyId: 'other', activeFrom: '2026-01-01T00:00:00Z' }]
    }),
    /Unknown signing keyId/
  );
  assert.throws(
    () => verifyExecutionAuditSigningRegistryFingerprintSignatureWithRegistry(fingerprint, signature, {
      schemaVersion: '1.0', keys: [{ ...baseKey, activeFrom: '2026-08-01T00:00:00Z' }]
    }),
    /not active/
  );
  assert.throws(
    () => verifyExecutionAuditSigningRegistryFingerprintSignatureWithRegistry(fingerprint, signature, {
      schemaVersion: '1.0', keys: [{ ...baseKey, activeFrom: '2026-01-01T00:00:00Z', revokedAt: '2026-07-01T00:00:00Z' }]
    }),
    /revoked/
  );
});

test('returns invalid for changed fingerprint content', () => {
  const keys = createKeys();
  const signature = signExecutionAuditSigningRegistryFingerprint('original', keys.privateKeyPem, 'key-1');
  const result = verifyExecutionAuditSigningRegistryFingerprintSignatureWithRegistry('changed', signature, {
    schemaVersion: '1.0',
    keys: [{ keyId: 'key-1', publicKeyPem: keys.publicKeyPem, activeFrom: '2020-01-01T00:00:00Z' }]
  });
  assert.equal(result.valid, false);
});
