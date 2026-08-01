import { readFile, writeFile } from 'node:fs/promises';
import {
  serializeExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignature,
  signExecutionAuditSigningRegistryReleaseBundleVerificationReceipt
} from '../lib/execution-audit-signing-registry-release-bundle-verification-receipt-signature';

const [receiptPath, privateKeyPath, keyId, outputPath] = process.argv.slice(2);
if (!receiptPath || !privateKeyPath || !keyId || !outputPath) {
  console.error('Usage: sign bundle receipt <receipt.json> <private-key.pem> <key-id> <output.json>');
  process.exitCode = 2;
} else {
  Promise.all([readFile(receiptPath, 'utf8'), readFile(privateKeyPath, 'utf8')])
    .then(async ([receiptContent, privateKeyPem]) => {
      const signature = signExecutionAuditSigningRegistryReleaseBundleVerificationReceipt(receiptContent, privateKeyPem, keyId);
      await writeFile(outputPath, serializeExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignature(signature), { flag: 'wx' });
      process.stdout.write(`${JSON.stringify(signature)}\n`);
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : 'Bundle receipt signing failed.');
      process.exitCode = 2;
    });
}
