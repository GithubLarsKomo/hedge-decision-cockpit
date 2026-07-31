import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildExecutionAuditEvidenceManifest,
  serializeExecutionAuditEvidenceManifest,
  sha256Hex
} from './execution-audit-evidence';

test('creates deterministic SHA-256 hashes', async () => {
  assert.equal(
    await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
});

test('builds a normalized evidence manifest', async () => {
  const manifest = await buildExecutionAuditEvidenceManifest(
    'decisionId\n"42"',
    1,
    '2026-07-31T10:00:00+02:00'
  );

  assert.equal(manifest.schemaVersion, '1.0');
  assert.equal(manifest.generatedAt, '2026-07-31T08:00:00.000Z');
  assert.equal(manifest.recordCount, 1);
  assert.equal(manifest.csvByteLength, 15);
  assert.match(manifest.csvSha256, /^[a-f0-9]{64}$/);
});

test('serializes with stable formatting and trailing newline', async () => {
  const manifest = await buildExecutionAuditEvidenceManifest('', 0, '2026-07-31T08:00:00.000Z');
  const serialized = serializeExecutionAuditEvidenceManifest(manifest);

  assert.equal(serialized.endsWith('\n'), true);
  assert.deepEqual(JSON.parse(serialized), manifest);
});

test('rejects invalid manifest metadata', async () => {
  await assert.rejects(() => buildExecutionAuditEvidenceManifest('', -1), /recordCount/);
  await assert.rejects(() => buildExecutionAuditEvidenceManifest('', 0, 'invalid'), /generatedAt/);
});
