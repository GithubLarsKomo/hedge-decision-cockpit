import { readFile } from 'node:fs/promises';
import { parseTrustedExecutionAuditSigningKeyRegistry } from '../lib/execution-audit-evidence-trusted-keys';
import {
  parseExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignature,
  verifyExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignatureWithRegistry
} from '../lib/execution-audit-signing-registry-release-bundle-verification-receipt-signature';

const [receiptPath, signaturePath, trustedKeysPath] = process.argv.slice(2);
if (!receiptPath || !signaturePath || !trustedKeysPath) {
  console.error('Usage: verify signed bundle receipt <receipt.json> <signature.json> <trusted-keys.json>');
  process.exitCode = 2;
} else {
  Promise.all([readFile(receiptPath, 'utf8'), readFile(signaturePath, 'utf8'), readFile(trustedKeysPath, 'utf8')])
    .then(([receiptContent, signatureContent, trustedKeysContent]) => {
      const result = verifyExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignatureWithRegistry(
        receiptContent,
        parseExecutionAuditSigningRegistryReleaseBundleVerificationReceiptSignature(signatureContent),
        parseTrustedExecutionAuditSigningKeyRegistry(trustedKeysContent)
      );
      process.stdout.write(`${JSON.stringify(result)}\n`);
      process.exitCode = result.valid ? 0 : 1;
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : 'Bundle receipt signature verification failed.');
      process.exitCode = 2;
    });
}
