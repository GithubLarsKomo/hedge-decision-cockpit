import { readFile, writeFile } from 'node:fs/promises';
import {
  serializeExecutionAuditSigningRegistryReleaseManifestSignature,
  signExecutionAuditSigningRegistryReleaseManifest
} from '../lib/execution-audit-signing-registry-release-manifest-signature';

const [manifestPath, privateKeyPath, keyId, outputPath, signedAt] = process.argv.slice(2);

if (!manifestPath || !privateKeyPath || !keyId || !outputPath) {
  console.error('Usage: sign release manifest with manifest, private key, keyId, output path and optional signedAt.');
  process.exitCode = 2;
} else {
  Promise.all([readFile(manifestPath, 'utf8'), readFile(privateKeyPath, 'utf8')])
    .then(async ([manifestContent, privateKeyPem]) => {
      const signature = signExecutionAuditSigningRegistryReleaseManifest(
        manifestContent,
        privateKeyPem,
        keyId,
        signedAt
      );
      const serialized = serializeExecutionAuditSigningRegistryReleaseManifestSignature(signature);
      await writeFile(outputPath, serialized, { encoding: 'utf8', flag: 'wx' });
      process.stdout.write(serialized);
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : 'Release manifest signing failed.');
      process.exitCode = 2;
    });
}
