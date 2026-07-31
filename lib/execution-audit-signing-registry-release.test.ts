import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  createExecutionAuditSigningRegistryFingerprint,
  serializeExecutionAuditSigningRegistryFingerprint
} from './execution-audit-signing-registry-fingerprint';
import { signExecutionAuditSigningRegistryFingerprint } from './execution-audit-signing-registry-fingerprint-signature';
import { verifyExecutionAuditSigningRegistryRelease } from './execution-audit-signing-registry-release';
import type { TrustedExecutionAuditSigningKeyRegistry } from './execution-audit-evidence-trusted-keys';

function createKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString()
  };
}

function createRegistry(publicKeyPem: string): TrustedExecutionAuditSigningKeyRegistry {
  return {
    schemaVersion: '1.0',
    keys: [{ keyId: 'audit-key-1', publicKeyPem, activeFrom: '2026-01-01T00:00:00Z' }]
  };
}

test('verifies registry content, fingerprint signature and trusted signing key together', () => {
  const auditKeys = createKeys();
  const governanceKeys = createKeys();
  const registry = createRegistry(auditKeys.publicKeyPem);
  const fingerprint = createExecutionAuditSigningRegistryFingerprint(registry);
  const fingerprintContent = serializeExecutionAuditSigningRegistryFingerprint(fingerprint);
  const signature = signExecutionAuditSigningRegistryFingerprint(
    fingerprintContent,
    governanceKeys.privateKeyPem,
    'governance-key-1',
    '2026-07-31T20:00:00Z'
  );
  const trustedSigningKeys: TrustedExecutionAuditSigningKeyRegistry = {
    schemaVersion: '1.0',
    keys: [{
      keyId: 'governance-key-1',
      publicKeyPem: governanceKeys.publicKeyPem,
      activeFrom: '2026-01-01T00:00:00Z'
    }]
  };

  const result = verifyExecutionAuditSigningRegistryRelease(
    registry,
    fingerprintContent,
    fingerprint,
    signature,
    trustedSigningKeys
  );

  assert.equal(result.valid, true);
  assert.equal(result.registryFingerprintValid, true);
  assert.equal(result.fingerprintSignatureValid, true);
  assert.equal(result.signingKey.keyId, 'governance-key-1');
});

test('reports an invalid release when registry content no longer matches the signed fingerprint', () => {
  const auditKeys = createKeys();
  const otherAuditKeys = createKeys();
  const governanceKeys = createKeys();
  const registry = createRegistry(auditKeys.publicKeyPem);
  const fingerprint = createExecutionAuditSigningRegistryFingerprint(registry);
  const fingerprintContent = serializeExecutionAuditSigningRegistryFingerprint(fingerprint);
  const signature = signExecutionAuditSigningRegistryFingerprint(
    fingerprintContent,
    governanceKeys.privateKeyPem,
    'governance-key-1',
    '2026-07-31T20:00:00Z'
  );
  const changedRegistry = createRegistry(otherAuditKeys.publicKeyPem);
  const trustedSigningKeys: TrustedExecutionAuditSigningKeyRegistry = {
    schemaVersion: '1.0',
    keys: [{
      keyId: 'governance-key-1',
      publicKeyPem: governanceKeys.publicKeyPem,
      activeFrom: '2026-01-01T00:00:00Z'
    }]
  };

  const result = verifyExecutionAuditSigningRegistryRelease(
    changedRegistry,
    fingerprintContent,
    fingerprint,
    signature,
    trustedSigningKeys
  );

  assert.equal(result.valid, false);
  assert.equal(result.registryFingerprintValid, false);
  assert.equal(result.fingerprintSignatureValid, true);
});
