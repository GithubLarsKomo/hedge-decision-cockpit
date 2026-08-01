import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { signExecutionAuditSigningRegistryReleaseManifest } from './execution-audit-signing-registry-release-manifest-signature';
import { verifyExecutionAuditSigningRegistryReleaseManifestSignatureWithRegistry } from './execution-audit-signing-registry-release-manifest-signature-registry';

function createKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString()
  };
}

test('verifies a manifest with a trusted active key', () => {
  const keys = createKeys();
  const manifest = '{"schemaVersion":"1.0","algorithm":"SHA-256","files":[]}\n';
  const signature = signExecutionAuditSigningRegistryReleaseManifest(
    manifest,
    keys.privateKeyPem,
    'release-governance-1',
    '2026-08-01T01:00:00Z'
  );
  const result = verifyExecutionAuditSigningRegistryReleaseManifestSignatureWithRegistry(
    manifest,
    signature,
    {
      schemaVersion: '1.0',
      keys: [{
        keyId: 'release-governance-1',
        publicKeyPem: keys.publicKeyPem,
        activeFrom: '2026-01-01T00:00:00Z'
      }]
    }
  );
  assert.equal(result.valid, true);
  assert.equal(result.keyId, 'release-governance-1');
});

test('rejects unknown, not-yet-active and revoked signing keys', () => {
  const keys = createKeys();
  const manifest = 'manifest';
  const signature = signExecutionAuditSigningRegistryReleaseManifest(
    manifest,
    keys.privateKeyPem,
    'release-governance-1',
    '2026-08-01T01:00:00Z'
  );
  const baseKey = { keyId: 'release-governance-1', publicKeyPem: keys.publicKeyPem };

  assert.throws(
    () => verifyExecutionAuditSigningRegistryReleaseManifestSignatureWithRegistry(manifest, signature, {
      schemaVersion: '1.0',
      keys: [{ ...baseKey, keyId: 'other', activeFrom: '2026-01-01T00:00:00Z' }]
    }),
    /Unknown signing keyId/
  );
  assert.throws(
    () => verifyExecutionAuditSigningRegistryReleaseManifestSignatureWithRegistry(manifest, signature, {
      schemaVersion: '1.0',
      keys: [{ ...baseKey, activeFrom: '2026-08-02T00:00:00Z' }]
    }),
    /not active/
  );
  assert.throws(
    () => verifyExecutionAuditSigningRegistryReleaseManifestSignatureWithRegistry(manifest, signature, {
      schemaVersion: '1.0',
      keys: [{ ...baseKey, activeFrom: '2026-01-01T00:00:00Z', revokedAt: '2026-07-01T00:00:00Z' }]
    }),
    /revoked/
  );
});

test('returns invalid for changed manifest content', () => {
  const keys = createKeys();
  const signature = signExecutionAuditSigningRegistryReleaseManifest('original', keys.privateKeyPem, 'key-1');
  const result = verifyExecutionAuditSigningRegistryReleaseManifestSignatureWithRegistry('changed', signature, {
    schemaVersion: '1.0',
    keys: [{ keyId: 'key-1', publicKeyPem: keys.publicKeyPem, activeFrom: '2020-01-01T00:00:00Z' }]
  });
  assert.equal(result.valid, false);
});
