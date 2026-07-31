import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  serializeTrustedExecutionAuditSigningKeyRegistry,
  type TrustedExecutionAuditSigningKeyRegistry
} from './execution-audit-evidence-trusted-keys';
import {
  createExecutionAuditSigningRegistryFingerprint,
  serializeExecutionAuditSigningRegistryFingerprint
} from './execution-audit-signing-registry-fingerprint';
import {
  serializeExecutionAuditSigningRegistryFingerprintSignature,
  signExecutionAuditSigningRegistryFingerprint
} from './execution-audit-signing-registry-fingerprint-signature';
import { verifyExecutionAuditSigningRegistryReleaseBundle } from './execution-audit-signing-registry-release-bundle';

function fixture() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const registry: TrustedExecutionAuditSigningKeyRegistry = {
    schemaVersion: '1.0',
    keys: [{ keyId: 'release-2026', publicKeyPem, activeFrom: '2026-01-01T00:00:00Z' }]
  };
  const registryContent = serializeTrustedExecutionAuditSigningKeyRegistry(registry);
  const fingerprintContent = serializeExecutionAuditSigningRegistryFingerprint(
    createExecutionAuditSigningRegistryFingerprint(registry)
  );
  const signatureContent = serializeExecutionAuditSigningRegistryFingerprintSignature(
    signExecutionAuditSigningRegistryFingerprint(
      fingerprintContent,
      privateKeyPem,
      'release-2026',
      '2026-07-31T20:00:00Z'
    )
  );
  return { registryContent, fingerprintContent, signatureContent, trustedKeysContent: registryContent };
}

test('verifies a complete trusted registry release bundle', () => {
  const result = verifyExecutionAuditSigningRegistryReleaseBundle(fixture());
  assert.deepEqual(result, {
    valid: true,
    registryValid: true,
    signatureValid: true,
    keyId: 'release-2026',
    signedAt: '2026-07-31T20:00:00.000Z'
  });
});

test('rejects a registry that no longer matches its fingerprint', () => {
  const input = fixture();
  const registry = JSON.parse(input.registryContent);
  registry.keys[0].activeFrom = '2026-02-01T00:00:00Z';
  const result = verifyExecutionAuditSigningRegistryReleaseBundle({
    ...input,
    registryContent: `${JSON.stringify(registry, null, 2)}\n`
  });
  assert.equal(result.valid, false);
  assert.equal(result.registryValid, false);
  assert.equal(result.signatureValid, false);
});

test('rejects a fingerprint with a tampered signature', () => {
  const input = fixture();
  const signature = JSON.parse(input.signatureContent);
  signature.signatureBase64 = `${signature.signatureBase64.slice(0, -2)}AA`;
  const result = verifyExecutionAuditSigningRegistryReleaseBundle({
    ...input,
    signatureContent: `${JSON.stringify(signature, null, 2)}\n`
  });
  assert.equal(result.valid, false);
  assert.equal(result.registryValid, true);
  assert.equal(result.signatureValid, false);
});
