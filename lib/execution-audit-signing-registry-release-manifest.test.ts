import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createExecutionAuditSigningRegistryReleaseManifest,
  serializeExecutionAuditSigningRegistryReleaseManifest
} from './execution-audit-signing-registry-release-manifest';

const input = {
  registryContent: '{"registry":1}\n',
  fingerprintContent: '{"fingerprint":1}\n',
  signatureContent: '{"signature":1}\n',
  trustRegistryContent: '{"trust":1}\n'
};

test('creates a deterministic manifest for all release files', () => {
  const first = createExecutionAuditSigningRegistryReleaseManifest(input);
  const second = createExecutionAuditSigningRegistryReleaseManifest(input);

  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, '1.0');
  assert.equal(first.algorithm, 'SHA-256');
  assert.deepEqual(first.files.map(file => file.name), [
    'registry',
    'fingerprint',
    'signature',
    'trustRegistry'
  ]);
  for (const file of first.files) {
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.ok(file.byteLength > 0);
  }
  assert.equal(serializeExecutionAuditSigningRegistryReleaseManifest(first).endsWith('\n'), true);
});

test('changes only the affected entry when one release file changes', () => {
  const original = createExecutionAuditSigningRegistryReleaseManifest(input);
  const changed = createExecutionAuditSigningRegistryReleaseManifest({
    ...input,
    signatureContent: '{"signature":2}\n'
  });

  assert.equal(original.files[0].sha256, changed.files[0].sha256);
  assert.equal(original.files[1].sha256, changed.files[1].sha256);
  assert.notEqual(original.files[2].sha256, changed.files[2].sha256);
  assert.equal(original.files[3].sha256, changed.files[3].sha256);
});
