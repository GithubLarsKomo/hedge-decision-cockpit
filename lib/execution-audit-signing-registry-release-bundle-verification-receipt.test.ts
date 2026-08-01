import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { createExecutionAuditSigningRegistryReleaseManifest, serializeExecutionAuditSigningRegistryReleaseManifest } from './execution-audit-signing-registry-release-manifest';
import { serializeExecutionAuditSigningRegistryReleaseManifestSignature, signExecutionAuditSigningRegistryReleaseManifest } from './execution-audit-signing-registry-release-manifest-signature';
import { createExecutionAuditSigningRegistryReleaseBundleVerificationReceipt, serializeExecutionAuditSigningRegistryReleaseBundleVerificationReceipt } from './execution-audit-signing-registry-release-bundle-verification-receipt';

function createFixture() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
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
      privateKeyPem,
      'release-governance-1',
      '2026-08-01T03:00:00Z'
    )
  );
  const trustedKeysContent = `${JSON.stringify({
    schemaVersion: '1.0',
    keys: [{
      keyId: 'release-governance-1',
      publicKeyPem,
      activeFrom: '2026-01-01T00:00:00Z'
    }]
  })}\n`;
  return { manifestContent, manifestSignatureContent, trustedKeysContent, ...files };
}

test('creates a deterministic receipt for a valid signed release bundle', () => {
  const fixture = createFixture();
  const receipt = createExecutionAuditSigningRegistryReleaseBundleVerificationReceipt(
    fixture,
    '2026-08-01T05:00:00+02:00'
  );
  assert.equal(receipt.valid, true);
  assert.equal(receipt.verifiedAt, '2026-08-01T03:00:00.000Z');
  assert.equal(receipt.manifestSigningKeyId, 'release-governance-1');
  assert.match(receipt.manifestSha256, /^[a-f0-9]{64}$/);
  assert.match(receipt.trustedKeysSha256, /^[a-f0-9]{64}$/);
  assert.equal(serializeExecutionAuditSigningRegistryReleaseBundleVerificationReceipt(receipt).endsWith('\n'), true);
});

test('rejects invalid bundles and invalid verification timestamps', () => {
  const fixture = createFixture();
  assert.throws(
    () => createExecutionAuditSigningRegistryReleaseBundleVerificationReceipt({
      ...fixture,
      registryContent: '{"registry":2}\n'
    }),
    /invalid signed release bundle/
  );
  assert.throws(
    () => createExecutionAuditSigningRegistryReleaseBundleVerificationReceipt(fixture, 'invalid'),
    /verifiedAt/
  );
});
