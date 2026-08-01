import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createExecutionAuditSigningRegistryReleaseManifest,
  serializeExecutionAuditSigningRegistryReleaseManifest
} from './execution-audit-signing-registry-release-manifest';
import {
  parseExecutionAuditSigningRegistryReleaseManifest,
  verifyExecutionAuditSigningRegistryReleaseManifest
} from './execution-audit-signing-registry-release-manifest-verification';

const files = {
  registryContent: '{"registry":1}\n',
  fingerprintContent: '{"fingerprint":1}\n',
  signatureContent: '{"signature":1}\n',
  trustRegistryContent: '{"trust":1}\n'
};

const manifestContent = serializeExecutionAuditSigningRegistryReleaseManifest(
  createExecutionAuditSigningRegistryReleaseManifest(files)
);

test('verifies an unchanged release bundle', () => {
  const result = verifyExecutionAuditSigningRegistryReleaseManifest({ manifestContent, ...files });
  assert.equal(result.valid, true);
  assert.deepEqual(result.mismatches, []);
});

test('reports only the changed release file', () => {
  const result = verifyExecutionAuditSigningRegistryReleaseManifest({
    manifestContent,
    ...files,
    signatureContent: '{"signature":2}\n'
  });
  assert.equal(result.valid, false);
  assert.equal(result.mismatches.length, 1);
  assert.equal(result.mismatches[0].name, 'signature');
});

test('rejects malformed manifests', () => {
  assert.throws(
    () => parseExecutionAuditSigningRegistryReleaseManifest('{"schemaVersion":"2.0"}'),
    /Unsupported release manifest/
  );
});
