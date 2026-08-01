import { readFile } from 'node:fs/promises';
import { verifyExecutionAuditSigningRegistryReleaseManifest } from '../lib/execution-audit-signing-registry-release-manifest-verification';

const [manifestPath, registryPath, fingerprintPath, signaturePath, trustRegistryPath] = process.argv.slice(2);

if (!manifestPath || !registryPath || !fingerprintPath || !signaturePath || !trustRegistryPath) {
  console.error('Usage: verify release manifest against manifest, registry, fingerprint, signature and trust registry files.');
  process.exitCode = 2;
} else {
  Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(registryPath, 'utf8'),
    readFile(fingerprintPath, 'utf8'),
    readFile(signaturePath, 'utf8'),
    readFile(trustRegistryPath, 'utf8')
  ])
    .then(([manifestContent, registryContent, fingerprintContent, signatureContent, trustRegistryContent]) => {
      const result = verifyExecutionAuditSigningRegistryReleaseManifest({
        manifestContent,
        registryContent,
        fingerprintContent,
        signatureContent,
        trustRegistryContent
      });
      process.stdout.write(`${JSON.stringify(result)}\n`);
      process.exitCode = result.valid ? 0 : 1;
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : 'Release manifest verification failed.');
      process.exitCode = 2;
    });
}
