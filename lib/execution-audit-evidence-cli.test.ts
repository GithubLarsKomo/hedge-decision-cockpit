import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const scriptPaths = {
  'generate:audit-evidence': 'scripts/generate-execution-audit-evidence.ts',
  'verify:audit-evidence': 'scripts/verify-execution-audit-evidence.ts'
} as const;

function runCli(script: keyof typeof scriptPaths, args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', scriptPaths[script], ...args], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
}

test('generator and verifier complete a valid audit evidence round trip', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'audit-evidence-cli-'));
  const csvPath = join(directory, 'audit.csv');
  const manifestPath = join(directory, 'audit.manifest.json');
  const csv = '\ufeffdecisionId,status\r\n42,EXECUTED\r\n';

  await writeFile(csvPath, csv, 'utf8');

  const generated = runCli('generate:audit-evidence', [csvPath, manifestPath]);
  assert.equal(generated.status, 0, generated.stderr);

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    recordCount: number;
    csvByteLength: number;
    csvSha256: string;
  };
  assert.equal(manifest.recordCount, 1);
  assert.equal(manifest.csvByteLength, Buffer.byteLength(csv, 'utf8'));
  assert.match(manifest.csvSha256, /^[a-f0-9]{64}$/);

  const verified = runCli('verify:audit-evidence', [csvPath, manifestPath]);
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(JSON.parse(verified.stdout).valid, true);
});

test('verifier reports integrity changes with exit code 1', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'audit-evidence-cli-'));
  const csvPath = join(directory, 'audit.csv');
  const manifestPath = join(directory, 'audit.manifest.json');

  await writeFile(csvPath, 'decisionId,status\n42,EXECUTED\n', 'utf8');
  const generated = runCli('generate:audit-evidence', [csvPath, manifestPath]);
  assert.equal(generated.status, 0, generated.stderr);

  await writeFile(csvPath, 'decisionId,status\n42,REJECTED\n', 'utf8');
  const verified = runCli('verify:audit-evidence', [csvPath, manifestPath]);

  assert.equal(verified.status, 1, verified.stderr);
  const result = JSON.parse(verified.stdout) as { valid: boolean; hashMatches: boolean };
  assert.equal(result.valid, false);
  assert.equal(result.hashMatches, false);
});

test('generator protects an existing manifest unless force is explicit', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'audit-evidence-cli-'));
  const csvPath = join(directory, 'audit.csv');
  const manifestPath = join(directory, 'audit.manifest.json');

  await writeFile(csvPath, 'decisionId,status\n42,EXECUTED\n', 'utf8');
  assert.equal(runCli('generate:audit-evidence', [csvPath, manifestPath]).status, 0);

  const protectedRun = runCli('generate:audit-evidence', [csvPath, manifestPath]);
  assert.equal(protectedRun.status, 2);
  assert.match(protectedRun.stderr, /already exists/i);

  const forcedRun = runCli('generate:audit-evidence', [csvPath, manifestPath, '--force']);
  assert.equal(forcedRun.status, 0, forcedRun.stderr);
});
