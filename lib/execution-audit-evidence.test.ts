import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildExecutionAuditEvidenceManifest,
  serializeExecutionAuditEvidenceManifest,
  sha256Hex,
  verifyExecutionAuditEvidence
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

test('verifies an unchanged CSV against its manifest', async () => {
  const csv = '\ufeffdecisionId,status\r\n42,EXECUTED\r\n';
  const manifest = await buildExecutionAuditEvidenceManifest(csv, 1, '2026-07-31T08:00:00.000Z');
  const result = await verifyExecutionAuditEvidence(csv, manifest);

  assert.equal(result.valid, true);
  assert.equal(result.hashMatches, true);
  assert.equal(result.byteLengthMatches, true);
  assert.equal(result.expectedSha256, result.actualSha256);
  assert.equal(result.expectedByteLength, result.actualByteLength);
});

test('reports hash and byte-length mismatches for changed CSV content', async () => {
  const manifest = await buildExecutionAuditEvidenceManifest('decisionId\n42', 1);
  const result = await verifyExecutionAuditEvidence('decisionId\n43', manifest);

  assert.equal(result.valid, false);
  assert.equal(result.hashMatches, false);
  assert.equal(result.byteLengthMatches, true);
});

test('rejects malformed or unsupported manifests before verification', async () => {
  const valid = await buildExecutionAuditEvidenceManifest('', 0);

  await assert.rejects(
    () => verifyExecutionAuditEvidence('', { ...valid, schemaVersion: '2.0' as '1.0' }),
    /schemaVersion/
  );
  await assert.rejects(
    () => verifyExecutionAuditEvidence('', { ...valid, csvSha256: 'ABC' }),
    /csvSha256/
  );
  await assert.rejects(
    () => verifyExecutionAuditEvidence('', { ...valid, csvByteLength: -1 }),
    /csvByteLength/
  );
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
