import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import {
  createExecutionAuditSigningRegistryVerificationReceipt,
  serializeExecutionAuditSigningRegistryVerificationReceipt
} from '../lib/execution-audit-signing-registry-verification-receipt';

async function main() {
  const [, , registryPath, fingerprintPath, signaturePath, trustRegistryPath, receiptPath] = process.argv;
  if (!registryPath || !fingerprintPath || !signaturePath || !trustRegistryPath || !receiptPath) {
    console.error('Usage: npm run create:audit-signing-registry-verification-receipt -- <registry.json> <fingerprint.json> <signature.json> <trust-registry.json> <receipt.json>');
    process.exitCode = 2;
    return;
  }
  try {
    const [registry, fingerprint, signature, trustRegistry] = await Promise.all([
      readFile(registryPath, 'utf8'),
      readFile(fingerprintPath, 'utf8'),
      readFile(signaturePath, 'utf8'),
      readFile(trustRegistryPath, 'utf8')
    ]);
    const receipt = createExecutionAuditSigningRegistryVerificationReceipt(registry, fingerprint, signature, trustRegistry);
    await writeFile(receiptPath, serializeExecutionAuditSigningRegistryVerificationReceipt(receipt), { encoding: 'utf8', flag: 'wx' });
    console.log(JSON.stringify(receipt));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Verification receipt creation failed.');
    process.exitCode = 2;
  }
}

void main();
