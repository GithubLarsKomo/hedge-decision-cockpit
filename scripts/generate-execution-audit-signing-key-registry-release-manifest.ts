import { readFile } from 'node:fs/promises';
import {
  createExecutionAuditSigningRegistryReleaseManifest,
  serializeExecutionAuditSigningRegistryReleaseManifest
} from '../lib/execution-audit-signing-registry-release-manifest';

const [registryPath, fingerprintPath, signaturePath, trustRegistryPath] = process.argv.slice(2);

if (!registryPath || !fingerprintPath || !signaturePath || !trustRegistryPath) {
  console.error('Usage: generate release manifest from registry, fingerprint, signature and trust registry files.');
  process.exitCode = 2;
} else {
  Promise.all([
    readFile(registryPath, 'utf8'),
    readFile(fingerprintPath, 'utf8'),
    readFile(signaturePath, 'utf8'),
    readFile(trustRegistryPath, 'utf8')
  ])
    .then(([registryContent, fingerprintContent, signatureContent, trustRegistryContent]) => {
      process.stdout.write(
        serializeExecutionAuditSigningRegistryReleaseManifest(
          createExecutionAuditSigningRegistryReleaseManifest({
            registryContent,
            fingerprintContent,
            signatureContent,
            trustRegistryContent
          })
        )
      );
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : 'Release manifest generation failed.');
      process.exitCode = 2;
    });
}
