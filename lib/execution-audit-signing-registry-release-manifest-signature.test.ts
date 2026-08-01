import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  parseExecutionAuditSigningRegistryReleaseManifestSignature,
  serializeExecutionAuditSigningRegistryReleaseManifestSignature,
  signExecutionAuditSigningRegistryReleaseManifest,
  verifyExecutionAuditSigningRegistryReleaseManifestSignature
} from './execution-audit-signing-registry-release-manifest-signature';

function createKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString()
  };
}

test('signs and verifies an unchanged release manifest', () => {
  const keys = createKeys();
  const manifest = '{"schemaVersion":"1.0","algorithm":"SHA-256","files":[]}\n';
  const signature = signExecutionAuditSigningRegistryReleaseManifest(
    manifest,
    keys.privateKeyPem,
    'release-governance-key-1',
    '2026-08-01T03:45:00+02:00'
  );
  assert.equal(signature.signedAt, '2026-08-01T01:45:00.000Z');
  assert.equal(verifyExecutionAuditSigningRegistryReleaseManifestSignature(manifest, signature, keys.publicKeyPem), true);
  const serialized = serializeExecutionAuditSigningRegistryReleaseManifestSignature(signature);
  assert.deepEqual(parseExecutionAuditSigningRegistryReleaseManifestSignature(serialized), signature);
});

test('rejects changed manifests and unrelated public keys', () => {
  const signer = createKeys();
  const other = createKeys();
  const signature = signExecutionAuditSigningRegistryReleaseManifest('manifest', signer.privateKeyPem, 'key-1');
  assert.equal(verifyExecutionAuditSigningRegistryReleaseManifestSignature('changed', signature, signer.publicKeyPem), false);
  assert.equal(verifyExecutionAuditSigningRegistryReleaseManifestSignature('manifest', signature, other.publicKeyPem), false);
});

test('rejects invalid metadata and non-Ed25519 keys', () => {
  const keys = createKeys();
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rsaPrivate = rsa.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  assert.throws(() => signExecutionAuditSigningRegistryReleaseManifest('manifest', keys.privateKeyPem, '  '), /keyId/);
  assert.throws(() => signExecutionAuditSigningRegistryReleaseManifest('manifest', keys.privateKeyPem, 'key-1', 'invalid'), /signedAt/);
  assert.throws(() => signExecutionAuditSigningRegistryReleaseManifest('manifest', rsaPrivate, 'key-1'), /Ed25519/);
  assert.throws(() => parseExecutionAuditSigningRegistryReleaseManifestSignature('{"schemaVersion":"2.0"}'), /schemaVersion/);
});
