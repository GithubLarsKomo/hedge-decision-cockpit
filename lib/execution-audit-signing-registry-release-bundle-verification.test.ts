import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  createExecutionAuditSigningRegistryReleaseManifest,
  serializeExecutionAuditSigningRegistryReleaseManifest
} from './execution-audit-signing-registry-release-manifest';
import {
  serializeExecutionAuditSigningRegistryReleaseManifestSignature,
  signExecutionAuditSigningRegistryReleaseManifest
} from './execution-audit-signing-registry-release-manifest-signature';
import { verifyExecutionAuditSigningRegistryReleaseBundle } from './execution-audit-signing-registry-release-bundle-verification';

function fixture() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const files = {
    registryContent: '{"registry":1}\n',
    fingerprintContent: '{"fingerprint":1}\n',
    signatureContent: '{"signature":1}\n',
    trustRegistryContent: '{"trust":1}\n'
  };
  const manifestContent = serializeExecutionAuditSigningRegistryReleaseManifest(
    createExecutionAuditSigningRegistryReleaseManifest(files)
  );
  const manifestSignatureContent = serializeExecutionAuditSigningRegistryReleaseManifestSignature(
    signExecutionAuditSigningRegistryReleaseManifest(
      manifestContent,
      privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
      'release-key-1',
      '2026-08-01T02:00:00Z'
    )
  );
  const trustedKeysContent = JSON.stringify({
    schemaVersion: '1.0',
    keys: [{
      keyId: 'release-key-1',
      publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
      activeFrom: '2026-01-01T00:00:00Z'
    }]
  });
  return { ...files, manifestContent, manifestSignatureContent, trustedKeysContent };
}

test('verifies an unchanged signed release bundle atomically', () => {
  const result = verifyExecutionAuditSigningRegistryReleaseBundle(fixture());
  assert.equal(result.valid, true);
  assert.equal(result.manifest.valid, true);
  assert.equal(result.manifestSignature.valid, true);
});

test('rejects changed bundle files while preserving signature result', () => {
  const input = fixture();
  const result = verifyExecutionAuditSigningRegistryReleaseBundle({
    ...input,
    signatureContent: '{"signature":2}\n'
  });
  assert.equal(result.valid, false);
  assert.equal(result.manifest.valid, false);
  assert.equal(result.manifestSignature.valid, true);
});

test('rejects a changed manifest signature', () => {
  const input = fixture();
  const signature = JSON.parse(input.manifestSignatureContent);
  signature.signatureBase64 = `${signature.signatureBase64.slice(0, -2)}AA`;
  const result = verifyExecutionAuditSigningRegistryReleaseBundle({
    ...input,
    manifestSignatureContent: JSON.stringify(signature)
  });
  assert.equal(result.valid, false);
  assert.equal(result.manifest.valid, true);
  assert.equal(result.manifestSignature.valid, false);
});
