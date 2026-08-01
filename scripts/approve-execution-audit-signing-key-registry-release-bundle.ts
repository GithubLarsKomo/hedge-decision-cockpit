import { open, readFile, unlink } from 'node:fs/promises';
import { approveExecutionAuditSigningRegistryReleaseBundle } from '../lib/execution-audit-signing-registry-release-bundle-approval';

const [manifestPath, manifestSignaturePath, trustedKeysPath, registryPath, fingerprintPath, signaturePath, trustRegistryPath, privateKeyPath, keyId, receiptPath, receiptSignaturePath] = process.argv.slice(2);

if (!manifestPath || !manifestSignaturePath || !trustedKeysPath || !registryPath || !fingerprintPath || !signaturePath || !trustRegistryPath || !privateKeyPath || !keyId || !receiptPath || !receiptSignaturePath) {
  console.error('Usage: approve release bundle with seven bundle inputs, private key, keyId, receipt output and signature output.');
  process.exitCode = 2;
} else {
  Promise.all([
    readFile(manifestPath, 'utf8'), readFile(manifestSignaturePath, 'utf8'), readFile(trustedKeysPath, 'utf8'),
    readFile(registryPath, 'utf8'), readFile(fingerprintPath, 'utf8'), readFile(signaturePath, 'utf8'),
    readFile(trustRegistryPath, 'utf8'), readFile(privateKeyPath, 'utf8')
  ]).then(async ([manifestContent, manifestSignatureContent, trustedKeysContent, registryContent, fingerprintContent, signatureContent, trustRegistryContent, privateKeyPem]) => {
    const result = approveExecutionAuditSigningRegistryReleaseBundle({
      manifestContent, manifestSignatureContent, trustedKeysContent, registryContent,
      fingerprintContent, signatureContent, trustRegistryContent
    }, privateKeyPem, keyId);

    let receiptCreated = false;
    try {
      const receiptFile = await open(receiptPath, 'wx');
      await receiptFile.writeFile(result.receiptContent, 'utf8');
      await receiptFile.close();
      receiptCreated = true;
      const signatureFile = await open(receiptSignaturePath, 'wx');
      await signatureFile.writeFile(result.signatureContent, 'utf8');
      await signatureFile.close();
    } catch (error) {
      if (receiptCreated) await unlink(receiptPath).catch(() => undefined);
      throw error;
    }

    process.stdout.write(`${JSON.stringify({ valid: true, receiptPath, receiptSignaturePath, verification: result.verification })}\n`);
  }).catch(error => {
    console.error(error instanceof Error ? error.message : 'Release bundle approval failed.');
    process.exitCode = 2;
  });
}
