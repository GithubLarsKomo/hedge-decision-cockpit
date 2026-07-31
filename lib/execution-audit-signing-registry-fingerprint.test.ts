import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  createExecutionAuditSigningRegistryFingerprint,
  serializeExecutionAuditSigningRegistryFingerprint
} from './execution-audit-signing-registry-fingerprint';

function publicKeyPem() {
  const { publicKey } = generateKeyPairSync('ed25519');
  return publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

test('registry fingerprint is deterministic across input order and timestamp formats', () => {
  const firstKey = publicKeyPem();
  const secondKey = publicKeyPem();
  const first = createExecutionAuditSigningRegistryFingerprint({
    schemaVersion: '1.0',
    keys: [
      { keyId: 'key-b', publicKeyPem: secondKey, activeFrom: '2026-02-01T00:00:00Z' },
      { keyId: 'key-a', publicKeyPem: firstKey, activeFrom: '2026-01-01T01:00:00+01:00' }
    ]
  });
  const second = createExecutionAuditSigningRegistryFingerprint({
    schemaVersion: '1.0',
    keys: [
      { keyId: 'key-a', publicKeyPem: firstKey, activeFrom: '2026-01-01T00:00:00.000Z' },
      { keyId: 'key-b', publicKeyPem: secondKey, activeFrom: '2026-02-01T00:00:00.000Z' }
    ]
  });

  assert.deepEqual(first, second);
  assert.equal(first.keyCount, 2);
  assert.deepEqual(first.keyIds, ['key-a', 'key-b']);
  assert.match(first.registrySha256, /^[a-f0-9]{64}$/);
  assert.match(serializeExecutionAuditSigningRegistryFingerprint(first), /"algorithm": "SHA-256"/);
});

test('registry fingerprint changes when trust metadata changes', () => {
  const key = publicKeyPem();
  const active = createExecutionAuditSigningRegistryFingerprint({
    schemaVersion: '1.0',
    keys: [{ keyId: 'key-a', publicKeyPem: key, activeFrom: '2026-01-01T00:00:00Z' }]
  });
  const revoked = createExecutionAuditSigningRegistryFingerprint({
    schemaVersion: '1.0',
    keys: [{
      keyId: 'key-a',
      publicKeyPem: key,
      activeFrom: '2026-01-01T00:00:00Z',
      revokedAt: '2026-06-01T00:00:00Z'
    }]
  });

  assert.notEqual(active.registrySha256, revoked.registrySha256);
});
