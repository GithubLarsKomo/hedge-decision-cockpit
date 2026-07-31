import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  serializeExecutionAuditEvidenceSignature,
  signExecutionAuditEvidenceManifest
} from './execution-audit-evidence-signature';
import { serializeTrustedExecutionAuditSigningKeyRegistry } from './execution-audit-evidence-trusted-keys';

function runVerifier(args: string[]) {
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/verify-execution-audit-evidence-signature-registry.ts', ...args],
    { cwd: process.cwd(), encoding: 'utf8' }
  );
}

test('verifies a signature only when the registry trusts the key at signedAt', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'audit-registry-cli-'));
  const manifestPath = join(directory, 'manifest.json');
  const signaturePath = join(directory, 'signature.json');
  const registryPath = join(directory, 'trusted-keys.json');
  const manifest = '{"schemaVersion":"1.0"}\n';
  const signedAt = '2026-07-31T18:00:00.000Z';
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const signature = signExecutionAuditEvidenceManifest(manifest, privateKeyPem, 'audit-2026', signedAt);
  const registry = serializeTrustedExecutionAuditSigningKeyRegistry({
    schemaVersion: '1.0',
    keys: [{ keyId: 'audit-2026', publicKeyPem, activeFrom: '2026-01-01T00:00:00.000Z' }]
  });

  await Promise.all([
    writeFile(manifestPath, manifest, 'utf8'),
    writeFile(signaturePath, serializeExecutionAuditEvidenceSignature(signature), 'utf8'),
    writeFile(registryPath, registry, 'utf8')
  ]);

  const result = runVerifier([manifestPath, signaturePath, registryPath]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    valid: true,
    trusted: true,
    keyId: 'audit-2026',
    signedAt,
    activeFrom: '2026-01-01T00:00:00.000Z',
    revokedAt: null
  });
});

test('rejects unknown and revoked signing keys as usage errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'audit-registry-cli-'));
  const manifestPath = join(directory, 'manifest.json');
  const signaturePath = join(directory, 'signature.json');
  const registryPath = join(directory, 'trusted-keys.json');
  const manifest = '{}\n';
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const signature = signExecutionAuditEvidenceManifest(
    manifest,
    privateKeyPem,
    'revoked-key',
    '2026-07-31T18:00:00.000Z'
  );

  await Promise.all([
    writeFile(manifestPath, manifest, 'utf8'),
    writeFile(signaturePath, serializeExecutionAuditEvidenceSignature(signature), 'utf8'),
    writeFile(
      registryPath,
      serializeTrustedExecutionAuditSigningKeyRegistry({
        schemaVersion: '1.0',
        keys: [
          {
            keyId: 'revoked-key',
            publicKeyPem,
            activeFrom: '2026-01-01T00:00:00.000Z',
            revokedAt: '2026-07-01T00:00:00.000Z'
          }
        ]
      }),
      'utf8'
    )
  ]);

  const revoked = runVerifier([manifestPath, signaturePath, registryPath]);
  assert.equal(revoked.status, 2);
  assert.match(revoked.stderr, /revoked/i);

  const unknownSignature = signExecutionAuditEvidenceManifest(
    manifest,
    privateKeyPem,
    'unknown-key',
    '2026-06-01T00:00:00.000Z'
  );
  await writeFile(signaturePath, serializeExecutionAuditEvidenceSignature(unknownSignature), 'utf8');
  const unknown = runVerifier([manifestPath, signaturePath, registryPath]);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /unknown signing keyId/i);
});
