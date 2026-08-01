import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { verifyArchivedReleaseApproval } from '../lib/execution-audit-signing-registry-archived-release-approval-verification';

async function main() {
  const [, , receiptPath, receiptSignaturePath, trustedKeysPath] = process.argv;
  if (!receiptPath || !receiptSignaturePath || !trustedKeysPath) {
    console.error(
      'Usage: npm run verify:audit-signing-registry-archived-release-approval -- <receipt.json> <receipt-signature.json> <trusted-keys.json>'
    );
    process.exitCode = 2;
    return;
  }

  try {
    const [receiptContent, receiptSignatureContent, trustedKeysContent] = await Promise.all([
      readFile(receiptPath, 'utf8'),
      readFile(receiptSignaturePath, 'utf8'),
      readFile(trustedKeysPath, 'utf8')
    ]);
    const result = verifyArchivedReleaseApproval({ receiptContent, receiptSignatureContent, trustedKeysContent });
    console.log(JSON.stringify(result));
    if (!result.valid) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Archived release approval verification failed.');
    process.exitCode = 2;
  }
}

void main();
