import { readFile } from 'node:fs/promises';
import process from 'node:process';
import {
  parseTrustedExecutionAuditSigningKeyRegistry,
  serializeTrustedExecutionAuditSigningKeyRegistry
} from '../lib/execution-audit-evidence-trusted-keys';

async function main() {
  const [, , registryPath] = process.argv;
  if (!registryPath) {
    console.error('Usage: npm run validate:audit-signing-registry -- <registry.json>');
    process.exitCode = 2;
    return;
  }

  try {
    const content = await readFile(registryPath, 'utf8');
    const registry = parseTrustedExecutionAuditSigningKeyRegistry(content);
    const normalized = serializeTrustedExecutionAuditSigningKeyRegistry(registry);
    console.log(JSON.stringify({
      valid: true,
      schemaVersion: registry.schemaVersion,
      keyCount: registry.keys.length,
      keyIds: registry.keys.map(key => key.keyId),
      normalizedSha256Input: normalized
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Trusted signing key registry validation failed.');
    process.exitCode = 2;
  }
}

void main();
