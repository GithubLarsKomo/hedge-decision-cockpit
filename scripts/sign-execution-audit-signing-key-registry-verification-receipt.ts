import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import {
  serializeExecutionAuditSigningRegistryVerificationReceiptSignature,
  signExecutionAuditSigningRegistryVerificationReceipt
} from '../lib/execution-audit-signing-registry-verification-receipt-signature';

async function main() {
  const [, , receiptPath, privateKeyPath, keyId, signaturePath] = process.argv;
  if (!receiptPath || !privateKeyPath || !keyId || !signaturePath) {
    console.error('Usage: npm run sign:audit-signing-registry-verification-receipt -- <receipt.json> <private-key.pem> <key-id> <signature.json>');
    process.exitCode = 2;
    return;
  }
  try {
    const [receiptContent, privateKeyPem] = await Promise.all([
      readFile(receiptPath, 'utf8'),
      readFile(privateKeyPath, 'utf8')
    ]);
    const signature = signExecutionAuditSigningRegistryVerificationReceipt(receiptContent, privateKeyPem, keyId);
    await writeFile(signaturePath, serializeExecutionAuditSigningRegistryVerificationReceiptSignature(signature), {
      encoding: 'utf8',
      flag: 'wx'
    });
    console.log(JSON.stringify(signature));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Verification receipt signing failed.');
    process.exitCode = 2;
  }
}

void main();
