import { readFile } from 'node:fs/promises';
import {
  parseExecutionAuditSigningRegistryReleaseManifestSignature,
  verifyExecutionAuditSigningRegistryReleaseManifestSignature
} from '../lib/execution-audit-signing-registry-release-manifest-signature';

const [manifestPath, signaturePath, publicKeyPath] = process.argv.slice(2);

if (!manifestPath || !signaturePath || !publicKeyPath) {
  console.error('Usage: verify release manifest signature with manifest, signature and public key files.');
  process.exitCode = 2;
} else {
  Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(signaturePath, 'utf8'),
    readFile(publicKeyPath, 'utf8')
  ])
    .then(([manifestContent, signatureContent, publicKeyPem]) => {
      const signature = parseExecutionAuditSigningRegistryReleaseManifestSignature(signatureContent);
      const valid = verifyExecutionAuditSigningRegistryReleaseManifestSignature(
        manifestContent,
        signature,
        publicKeyPem
      );
      process.stdout.write(`${JSON.stringify({ valid, keyId: signature.keyId, signedAt: signature.signedAt })}\n`);
      process.exitCode = valid ? 0 : 1;
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : 'Release manifest signature verification failed.');
      process.exitCode = 2;
    });
}
