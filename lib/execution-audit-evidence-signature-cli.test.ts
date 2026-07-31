import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function runScript(script: string, args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
}

test('signs and verifies an audit evidence manifest through the CLI', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'audit-signature-cli-'));
  const manifestPath = join(directory, 'manifest.json');
  const privateKeyPath = join(directory, 'private.pem');
  const publicKeyPath = join(directory, 'public.pem');
  const signaturePath = join(directory, 'signature.json');
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');

  await Promise.all([
    writeFile(manifestPath, '{"schemaVersion":"1.0"}\n', 'utf8'),
    writeFile(privateKeyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), 'utf8'),
    writeFile(publicKeyPath, publicKey.export({ type: 'spki', format: 'pem' }), 'utf8')
  ]);

  const signed = runScript('scripts/sign-execution-audit-evidence.ts', [
    manifestPath,
    privateKeyPath,
    'governance-key-1',
    signaturePath
  ]);
  assert.equal(signed.status, 0, signed.stderr);
  assert.equal(JSON.parse(signed.stdout).keyId, 'governance-key-1');
  assert.equal(JSON.parse(await readFile(signaturePath, 'utf8')).algorithm, 'Ed25519');

  const verified = runScript('scripts/verify-execution-audit-evidence-signature.ts', [
    manifestPath,
    signaturePath,
    publicKeyPath
  ]);
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(JSON.parse(verified.stdout).valid, true);

  await writeFile(manifestPath, '{"schemaVersion":"2.0"}\n', 'utf8');
  const tampered = runScript('scripts/verify-execution-audit-evidence-signature.ts', [
    manifestPath,
    signaturePath,
    publicKeyPath
  ]);
  assert.equal(tampered.status, 1, tampered.stderr);
  assert.equal(JSON.parse(tampered.stdout).valid, false);
});
