import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { verifyExecutionAuditSigningRegistryReleaseBundle } from '../lib/execution-audit-signing-registry-release-bundle-verification';

async function main() {
  const [
    manifestPath,
    manifestSignaturePath,
    trustedKeysPath,
    registryPath,
    fingerprintPath,
    signaturePath,
    trustRegistryPath
  ] = process.argv.slice(2);

  if (
    !manifestPath || !manifestSignaturePath || !trustedKeysPath || !registryPath ||
    !fingerprintPath || !signaturePath || !trustRegistryPath
  ) {
    console.error('Usage: verify signed release bundle from manifest, manifest signature, trusted keys, registry, fingerprint, signature and trust registry files.');
    process.exitCode = 2;
    return;
  }

  try {
    const [
      manifestContent,
      manifestSignatureContent,
      trustedKeysContent,
      registryContent,
      fingerprintContent,
      signatureContent,
      trustRegistryContent
    ] = await Promise.all([
      readFile(manifestPath, 'utf8'),
      readFile(manifestSignaturePath, 'utf8'),
      readFile(trustedKeysPath, 'utf8'),
      readFile(registryPath, 'utf8'),
      readFile(fingerprintPath, 'utf8'),
      readFile(signaturePath, 'utf8'),
      readFile(trustRegistryPath, 'utf8')
    ]);

    const result = verifyExecutionAuditSigningRegistryReleaseBundle({
      manifestContent,
      manifestSignatureContent,
      trustedKeysContent,
      registryContent,
      fingerprintContent,
      signatureContent,
      trustRegistryContent
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Release bundle verification failed.');
    process.exitCode = 2;
  }
}

void main();
