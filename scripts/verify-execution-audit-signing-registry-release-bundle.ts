import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { verifyExecutionAuditSigningRegistryReleaseBundle } from '../lib/execution-audit-signing-registry-release-bundle';

async function main() {
  const [, , registryPath, fingerprintPath, signaturePath, trustedKeysPath] = process.argv;
  if (!registryPath || !fingerprintPath || !signaturePath || !trustedKeysPath) {
    console.error(
      'Usage: npm run verify:audit-signing-registry-release-bundle -- <registry.json> <fingerprint.json> <signature.json> <trusted-keys.json>'
    );
    process.exitCode = 2;
    return;
  }

  try {
    const [registryContent, fingerprintContent, signatureContent, trustedKeysContent] = await Promise.all([
      readFile(registryPath, 'utf8'),
      readFile(fingerprintPath, 'utf8'),
      readFile(signaturePath, 'utf8'),
      readFile(trustedKeysPath, 'utf8')
    ]);
    const result = verifyExecutionAuditSigningRegistryReleaseBundle({
      registryContent,
      fingerprintContent,
      signatureContent,
      trustedKeysContent
    });
    console.log(JSON.stringify(result));
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Registry release bundle verification failed.');
    process.exitCode = 2;
  }
}

void main();
