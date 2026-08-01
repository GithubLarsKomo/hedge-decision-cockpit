import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { serializeTrustedExecutionAuditSigningKeyRegistry, type TrustedExecutionAuditSigningKeyRegistry } from './execution-audit-evidence-trusted-keys';
import { createExecutionAuditSigningRegistryFingerprint, serializeExecutionAuditSigningRegistryFingerprint } from './execution-audit-signing-registry-fingerprint';
import { serializeExecutionAuditSigningRegistryFingerprintSignature, signExecutionAuditSigningRegistryFingerprint } from './execution-audit-signing-registry-fingerprint-signature';
import { createExecutionAuditSigningRegistryVerificationReceipt } from './execution-audit-signing-registry-verification-receipt';

function keys() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString()
  };
}

test('creates a deterministic receipt for a valid trust chain', () => {
  const registryKey = keys();
  const signer = keys();
  const registry: TrustedExecutionAuditSigningKeyRegistry = {
    schemaVersion: '1.0',
    keys: [{ keyId: 'audit-key-1', publicKeyPem: registryKey.publicKeyPem, activeFrom: '2026-01-01T00:00:00Z' }]
  };
  const trustRegistry: TrustedExecutionAuditSigningKeyRegistry = {
    schemaVersion: '1.0',
    keys: [{ keyId: 'governance-key-1', publicKeyPem: signer.publicKeyPem, activeFrom: '2026-01-01T00:00:00Z' }]
  };
  const registryContent = serializeTrustedExecutionAuditSigningKeyRegistry(registry);
  const fingerprintContent = serializeExecutionAuditSigningRegistryFingerprint(createExecutionAuditSigningRegistryFingerprint(registry));
  const signatureContent = serializeExecutionAuditSigningRegistryFingerprintSignature(
    signExecutionAuditSigningRegistryFingerprint(fingerprintContent, signer.privateKeyPem, 'governance-key-1', '2026-07-31T20:00:00Z')
  );

  const receipt = createExecutionAuditSigningRegistryVerificationReceipt(
    registryContent,
    fingerprintContent,
    signatureContent,
    serializeTrustedExecutionAuditSigningKeyRegistry(trustRegistry),
    '2026-08-01T00:00:00Z'
  );

  assert.equal(receipt.valid, true);
  assert.equal(receipt.signingKeyId, 'governance-key-1');
  assert.equal(receipt.verifiedAt, '2026-08-01T00:00:00.000Z');
  assert.match(receipt.registrySha256, /^[a-f0-9]{64}$/);
});
