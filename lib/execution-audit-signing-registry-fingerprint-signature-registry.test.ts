import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  signExecutionAuditSigningRegistryFingerprint,
  verifyExecutionAuditSigningRegistryFingerprintSignature
} from './execution-audit-signing-registry-fingerprint-signature';
import {
  resolveTrustedExecutionAuditSigningKey,
  type TrustedExecutionAuditSigningKeyRegistry
} from './execution-audit-evidence-trusted-keys';

function createKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString()
  };
}

test('trusted registry resolves the signing key and verifies the fingerprint signature', () => {
  const keys = createKeyPair();
  const signedAt = '2026-07-31T20:00:00.000Z';
  const fingerprint = '{"registrySha256":"abc"}\n';
  const signature = signExecutionAuditSigningRegistryFingerprint(
    fingerprint,
    keys.privateKeyPem,
    'governance-2026',
    signedAt
  );
  const registry: TrustedExecutionAuditSigningKeyRegistry = {
    schemaVersion: '1.0',
    keys: [{ keyId: 'governance-2026', publicKeyPem: keys.publicKeyPem, activeFrom: '2026-01-01T00:00:00Z' }]
  };

  const trustedKey = resolveTrustedExecutionAuditSigningKey(registry, signature.keyId, signature.signedAt);
  assert.equal(
    verifyExecutionAuditSigningRegistryFingerprintSignature(fingerprint, signature, trustedKey.publicKeyPem),
    true
  );
});

test('registry rejects a fingerprint signature made after key revocation', () => {
  const keys = createKeyPair();
  const signature = signExecutionAuditSigningRegistryFingerprint(
    '{"registrySha256":"abc"}\n',
    keys.privateKeyPem,
    'retired-key',
    '2026-07-31T20:00:00Z'
  );
  const registry: TrustedExecutionAuditSigningKeyRegistry = {
    schemaVersion: '1.0',
    keys: [
      {
        keyId: 'retired-key',
        publicKeyPem: keys.publicKeyPem,
        activeFrom: '2026-01-01T00:00:00Z',
        revokedAt: '2026-07-01T00:00:00Z'
      }
    ]
  };

  assert.throws(
    () => resolveTrustedExecutionAuditSigningKey(registry, signature.keyId, signature.signedAt),
    /revoked at signedAt/
  );
});
