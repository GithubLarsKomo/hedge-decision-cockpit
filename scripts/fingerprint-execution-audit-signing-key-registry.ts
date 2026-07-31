import { readFile } from 'node:fs/promises';
import process from 'node:process';
import {
  createExecutionAuditSigningRegistryFingerprint,
  serializeExecutionAuditSigningRegistryFingerprint
} from '../lib/execution-audit-signing-registry-fingerprint';
import { parseTrustedExecutionAuditSigningKeyRegistry } from '../lib/execution-audit-evidence-trusted-keys';

async function main() {
  const [, , registryPath] = process.argv;
  if (!registryPath) {
    console.error('Usage: npm run fingerprint:audit-signing-registry -- <registry.json>');
    process.exitCode = 2;
    return;
  }

  try {
    const registryContent = await readFile(registryPath, 'utf8');
    const registry = parseTrustedExecutionAuditSigningKeyRegistry(registryContent);
    const fingerprint = createExecutionAuditSigningRegistryFingerprint(registry);
    process.stdout.write(serializeExecutionAuditSigningRegistryFingerprint(fingerprint));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Audit signing registry fingerprint failed.');
    process.exitCode = 2;
  }
}

void main();
