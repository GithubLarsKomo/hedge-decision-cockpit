import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  serializeExecutionAuditEvidenceSignature,
  signExecutionAuditEvidenceManifest,
  verifyExecutionAuditEvidenceManifestSignature
} from './execution-audit-evidence-signature';

function createKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString()
  };
}

test('signs and verifies an unchanged manifest', () => {
  const keys = createKeys();
  const manifest = '{"schemaVersion":"1.0","csvSha256":"abc"}\n';
  const signature = signExecutionAuditEvidenceManifest(
    manifest,
    keys.privateKeyPem,
    'governance-key-1',
    '2026-07-31T18:00:00+02:00'
  );

  assert.equal(signature.algorithm, 'Ed25519');
  assert.equal(signature.keyId, 'governance-key-1');
  assert.equal(signature.signedAt, '2026-07-31T16:00:00.000Z');
  assert.equal(verifyExecutionAuditEvidenceManifestSignature(manifest, signature, keys.publicKeyPem), true);
  assert.equal(serializeExecutionAuditEvidenceSignature(signature).endsWith('\n'), true);
});

test('rejects changed manifests and unrelated public keys', () => {
  const signer = createKeys();
  const other = createKeys();
  const signature = signExecutionAuditEvidenceManifest('manifest', signer.privateKeyPem, 'key-1');

  assert.equal(verifyExecutionAuditEvidenceManifestSignature('changed', signature, signer.publicKeyPem), false);
  assert.equal(verifyExecutionAuditEvidenceManifestSignature('manifest', signature, other.publicKeyPem), false);
});

test('rejects invalid metadata and non-Ed25519 keys', () => {
  const keys = createKeys();
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rsaPrivate = rsa.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const signature = signExecutionAuditEvidenceManifest('manifest', keys.privateKeyPem, 'key-1');

  assert.throws(() => signExecutionAuditEvidenceManifest('manifest', keys.privateKeyPem, '  '), /keyId/);
  assert.throws(() => signExecutionAuditEvidenceManifest('manifest', keys.privateKeyPem, 'key-1', 'invalid'), /signedAt/);
  assert.throws(() => signExecutionAuditEvidenceManifest('manifest', rsaPrivate, 'key-1'), /Ed25519/);
  assert.throws(
    () => verifyExecutionAuditEvidenceManifestSignature('manifest', { ...signature, algorithm: 'RSA' as 'Ed25519' }, keys.publicKeyPem),
    /algorithm/
  );
});
