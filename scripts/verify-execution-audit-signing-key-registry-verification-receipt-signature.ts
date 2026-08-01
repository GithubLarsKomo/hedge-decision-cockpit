import { readFile } from 'node:fs/promises';
import process from 'node:process';
import {
  parseExecutionAuditSigningRegistryVerificationReceiptSignature,
  verifyExecutionAuditSigningRegistryVerificationReceiptSignature
} from '../lib/execution-audit-signing-registry-verification-receipt-signature';

async function main() {
  const [, , receiptPath, signaturePath, publicKeyPath] = process.argv;
  if (!receiptPath || !signaturePath || !publicKeyPath) {
    console.error('Usage: npm run verify:audit-signing-registry-verification-receipt-signature -- <receipt.json> <signature.json> <public-key.pem>');
    process.exitCode = 2;
    return;
  }
  try {
    const [receiptContent, signatureContent, publicKeyPem] = await Promise.all([
      readFile(receiptPath, 'utf8'),
      readFile(signaturePath, 'utf8'),
      readFile(publicKeyPath, 'utf8')
    ]);
    const signature = parseExecutionAuditSigningRegistryVerificationReceiptSignature(signatureContent);
    const valid = verifyExecutionAuditSigningRegistryVerificationReceiptSignature(receiptContent, signature, publicKeyPem);
    console.log(JSON.stringify({ valid, keyId: signature.keyId, signedAt: signature.signedAt }));
    process.exitCode = valid ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Verification receipt signature verification failed.');
    process.exitCode = 2;
  }
}

void main();
