import { readFile } from 'node:fs/promises';
import process from 'node:process';
import {
  parseExecutionAuditSigningRegistryFingerprint,
  verifyExecutionAuditSigningRegistryFingerprint
} from '../lib/execution-audit-signing-registry-fingerprint';
import { parseTrustedExecutionAuditSigningKeyRegistry } from '../lib/execution-audit-evidence-trusted-keys';

async function main() {
  const [, , registryPath, fingerprintPath] = process.argv;
  if (!registryPath || !fingerprintPath) {
    console.error('Usage: npm run verify:audit-signing-registry-fingerprint -- <registry.json> <fingerprint.json>');
    process.exitCode = 2;
    return;
  }

  try {
    const [registryContent, fingerprintContent] = await Promise.all([
      readFile(registryPath, 'utf8'),
      readFile(fingerprintPath, 'utf8')
    ]);
    const registry = parseTrustedExecutionAuditSigningKeyRegistry(registryContent);
    const expected = parseExecutionAuditSigningRegistryFingerprint(fingerprintContent);
    const result = verifyExecutionAuditSigningRegistryFingerprint(registry, expected);
    console.log(JSON.stringify(result));
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Registry fingerprint verification failed.');
    process.exitCode = 2;
  }
}

void main();
