import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { createExecutionAuditSigningRegistryReleaseManifest, serializeExecutionAuditSigningRegistryReleaseManifest } from './execution-audit-signing-registry-release-manifest';
import { signExecutionAuditSigningRegistryReleaseManifest, serializeExecutionAuditSigningRegistryReleaseManifestSignature } from './execution-audit-signing-registry-release-manifest-signature';
import { approveExecutionAuditSigningRegistryReleaseBundle } from './execution-audit-signing-registry-release-bundle-approval';

function keys() {
  const pair = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: pair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: pair.publicKey.export({ format: 'pem', type: 'spki' }).toString()
  };
}

function fixture() {
  const manifestSigner = keys();
  const approver = keys();
  const files = {
    registryContent: '{"registry":1}\n', fingerprintContent: '{"fingerprint":1}\n',
    signatureContent: '{"signature":1}\n', trustRegistryContent: '{"trust":1}\n'
  };
  const manifestContent = serializeExecutionAuditSigningRegistryReleaseManifest(createExecutionAuditSigningRegistryReleaseManifest(files));
  const manifestSignatureContent = serializeExecutionAuditSigningRegistryReleaseManifestSignature(
    signExecutionAuditSigningRegistryReleaseManifest(manifestContent, manifestSigner.privateKeyPem, 'manifest-key', '2026-08-01T03:00:00Z')
  );
  const trustedKeysContent = JSON.stringify({ schemaVersion: '1.0', keys: [
    { keyId: 'manifest-key', publicKeyPem: manifestSigner.publicKeyPem, activeFrom: '2026-01-01T00:00:00Z' },
    { keyId: 'approval-key', publicKeyPem: approver.publicKeyPem, activeFrom: '2026-01-01T00:00:00Z' }
  ] });
  return { input: { ...files, manifestContent, manifestSignatureContent, trustedKeysContent }, approver };
}

test('creates, signs and verifies one approval result', () => {
  const { input, approver } = fixture();
  const result = approveExecutionAuditSigningRegistryReleaseBundle(input, approver.privateKeyPem, 'approval-key', '2026-08-01T04:00:00Z');
  assert.equal(result.receipt.valid, true);
  assert.equal(result.signature.keyId, 'approval-key');
  assert.equal(result.verification.valid, true);
  assert.equal(result.receiptContent.endsWith('\n'), true);
  assert.equal(result.signatureContent.endsWith('\n'), true);
});

test('does not approve manipulated bundles', () => {
  const { input, approver } = fixture();
  assert.throws(() => approveExecutionAuditSigningRegistryReleaseBundle(
    { ...input, registryContent: '{"registry":2}\n' }, approver.privateKeyPem, 'approval-key'
  ), /invalid signed release bundle/);
});

test('rejects approval keys outside their trust window', () => {
  const { input, approver } = fixture();
  const registry = JSON.parse(input.trustedKeysContent);
  registry.keys[1].revokedAt = '2026-07-01T00:00:00Z';
  assert.throws(() => approveExecutionAuditSigningRegistryReleaseBundle(
    { ...input, trustedKeysContent: JSON.stringify(registry) }, approver.privateKeyPem, 'approval-key', '2026-08-01T04:00:00Z'
  ), /revoked/);
});
