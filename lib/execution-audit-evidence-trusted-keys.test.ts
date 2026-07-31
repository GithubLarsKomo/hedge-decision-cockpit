import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  normalizeTrustedExecutionAuditSigningKeyRegistry,
  parseTrustedExecutionAuditSigningKeyRegistry,
  resolveTrustedExecutionAuditSigningKey,
  serializeTrustedExecutionAuditSigningKeyRegistry
} from './execution-audit-evidence-trusted-keys';

function ed25519PublicKey() {
  return generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

test('normalizes and deterministically sorts trusted Ed25519 keys', () => {
  const registry = normalizeTrustedExecutionAuditSigningKeyRegistry({
    schemaVersion: '1.0',
    keys: [
      { keyId: 'key-b', publicKeyPem: ed25519PublicKey(), activeFrom: '2026-08-01T10:00:00+02:00' },
      { keyId: 'key-a', publicKeyPem: ed25519PublicKey(), activeFrom: '2026-07-01T00:00:00Z' }
    ]
  });

  assert.deepEqual(registry.keys.map(key => key.keyId), ['key-a', 'key-b']);
  assert.equal(registry.keys[1]?.activeFrom, '2026-08-01T08:00:00.000Z');
  assert.equal(registry.keys.every(key => key.publicKeyPem.endsWith('\n')), true);
});

test('resolves a key only inside its active trust window', () => {
  const registry = {
    schemaVersion: '1.0' as const,
    keys: [{
      keyId: 'quarterly-2026-q3',
      publicKeyPem: ed25519PublicKey(),
      activeFrom: '2026-07-01T00:00:00Z',
      revokedAt: '2026-10-01T00:00:00Z'
    }]
  };

  assert.equal(
    resolveTrustedExecutionAuditSigningKey(registry, 'quarterly-2026-q3', '2026-09-30T23:59:59Z').keyId,
    'quarterly-2026-q3'
  );
  assert.throws(
    () => resolveTrustedExecutionAuditSigningKey(registry, 'quarterly-2026-q3', '2026-06-30T23:59:59Z'),
    /not active/
  );
  assert.throws(
    () => resolveTrustedExecutionAuditSigningKey(registry, 'quarterly-2026-q3', '2026-10-01T00:00:00Z'),
    /revoked/
  );
  assert.throws(() => resolveTrustedExecutionAuditSigningKey(registry, 'unknown', '2026-08-01T00:00:00Z'), /Unknown/);
});

test('rejects duplicate identifiers, invalid windows and non-Ed25519 keys', () => {
  const publicKeyPem = ed25519PublicKey();
  assert.throws(
    () => normalizeTrustedExecutionAuditSigningKeyRegistry({
      schemaVersion: '1.0',
      keys: [
        { keyId: 'same', publicKeyPem, activeFrom: '2026-01-01T00:00:00Z' },
        { keyId: 'same', publicKeyPem, activeFrom: '2026-02-01T00:00:00Z' }
      ]
    }),
    /Duplicate/
  );
  assert.throws(
    () => normalizeTrustedExecutionAuditSigningKeyRegistry({
      schemaVersion: '1.0',
      keys: [{ keyId: 'bad-window', publicKeyPem, activeFrom: '2026-02-01T00:00:00Z', revokedAt: '2026-01-01T00:00:00Z' }]
    }),
    /later than/
  );
  const rsaPublicKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey
    .export({ type: 'spki', format: 'pem' }).toString();
  assert.throws(
    () => normalizeTrustedExecutionAuditSigningKeyRegistry({
      schemaVersion: '1.0',
      keys: [{ keyId: 'rsa', publicKeyPem: rsaPublicKey, activeFrom: '2026-01-01T00:00:00Z' }]
    }),
    /Ed25519/
  );
});

test('parses and serializes a registry with stable formatting', () => {
  const source = {
    schemaVersion: '1.0' as const,
    keys: [{ keyId: 'key-1', publicKeyPem: ed25519PublicKey(), activeFrom: '2026-01-01T00:00:00Z' }]
  };
  const serialized = serializeTrustedExecutionAuditSigningKeyRegistry(source);

  assert.equal(serialized.endsWith('\n'), true);
  assert.deepEqual(parseTrustedExecutionAuditSigningKeyRegistry(serialized), JSON.parse(serialized));
  assert.throws(() => parseTrustedExecutionAuditSigningKeyRegistry('{'), /valid JSON/);
  assert.throws(() => parseTrustedExecutionAuditSigningKeyRegistry('[]'), /JSON object/);
});
