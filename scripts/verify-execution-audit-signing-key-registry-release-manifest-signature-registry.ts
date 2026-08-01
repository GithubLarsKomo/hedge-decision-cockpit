import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { parseTrustedExecutionAuditSigningKeyRegistry } from '../lib/execution-audit-evidence-trusted-keys';
import { parseExecutionAuditSigningRegistryReleaseManifestSignature } from '../lib/execution-audit-signing-registry-release-manifest-signature';
import { verifyExecutionAuditSigningRegistryReleaseManifestSignatureWithRegistry } from '../lib/execution-audit-signing-registry-release-manifest-signature-registry';

async function main() {
  const [, , manifestPath, signaturePath, registryPath] = process.argv;
  if (!manifestPath || !signaturePath || !registryPath) {
    console.error(
      'Usage: npm run verify:audit-signing-registry-release-manifest-signature-registry -- <manifest.json> <signature.json> <trusted-keys.json>'
    );
    process.exitCode = 2;
    return;
  }

  try {
    const [manifestContent, signatureContent, registryContent] = await Promise.all([
      readFile(manifestPath, 'utf8'),
      readFile(signaturePath, 'utf8'),
      readFile(registryPath, 'utf8')
    ]);
    const result = verifyExecutionAuditSigningRegistryReleaseManifestSignatureWithRegistry(
      manifestContent,
      parseExecutionAuditSigningRegistryReleaseManifestSignature(signatureContent),
      parseTrustedExecutionAuditSigningKeyRegistry(registryContent)
    );
    console.log(JSON.stringify(result));
    if (!result.valid) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Registry-backed manifest signature verification failed.');
    process.exitCode = 2;
  }
}

void main();
