import { readFile, writeFile } from 'node:fs/promises';
import { createExecutionAuditSigningRegistryReleaseBundleVerificationReceipt, serializeExecutionAuditSigningRegistryReleaseBundleVerificationReceipt } from '../lib/execution-audit-signing-registry-release-bundle-verification-receipt';

const [manifestPath, manifestSignaturePath, trustedKeysPath, registryPath, fingerprintPath, signaturePath, trustRegistryPath, outputPath] = process.argv.slice(2);

if (!manifestPath || !manifestSignaturePath || !trustedKeysPath || !registryPath || !fingerprintPath || !signaturePath || !trustRegistryPath || !outputPath) {
  console.error('Usage: create release bundle verification receipt from manifest, manifest signature, trusted keys, registry, fingerprint, signature and trust registry files.');
  process.exitCode = 2;
} else {
  Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(manifestSignaturePath, 'utf8'),
    readFile(trustedKeysPath, 'utf8'),
    readFile(registryPath, 'utf8'),
    readFile(fingerprintPath, 'utf8'),
    readFile(signaturePath, 'utf8'),
    readFile(trustRegistryPath, 'utf8')
  ])
    .then(([manifestContent, manifestSignatureContent, trustedKeysContent, registryContent, fingerprintContent, signatureContent, trustRegistryContent]) => {
      const receipt = createExecutionAuditSigningRegistryReleaseBundleVerificationReceipt({
        manifestContent,
        manifestSignatureContent,
        trustedKeysContent,
        registryContent,
        fingerprintContent,
        signatureContent,
        trustRegistryContent
      });
      return writeFile(
        outputPath,
        serializeExecutionAuditSigningRegistryReleaseBundleVerificationReceipt(receipt),
        { encoding: 'utf8', flag: 'wx' }
      ).then(() => process.stdout.write(`${JSON.stringify(receipt)}\n`));
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : 'Release bundle verification receipt creation failed.');
      process.exitCode = 2;
    });
}
