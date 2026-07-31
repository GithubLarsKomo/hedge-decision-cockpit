import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { parseTrustedExecutionAuditSigningKeyRegistry } from '../lib/execution-audit-evidence-trusted-keys';
import { parseExecutionAuditSigningRegistryFingerprintSignature } from '../lib/execution-audit-signing-registry-fingerprint-signature';
import { verifyExecutionAuditSigningRegistryFingerprintSignatureWithRegistry } from '../lib/execution-audit-signing-registry-fingerprint-signature-registry';

async function main() {
  const [, , fingerprintPath, signaturePath, registryPath] = process.argv;
  if (!fingerprintPath || !signaturePath || !registryPath) {
    console.error(
      'Usage: npm run verify:audit-signing-registry-fingerprint-signature-registry -- <fingerprint.json> <signature.json> <trusted-keys.json>'
    );
    process.exitCode = 2;
    return;
  }

  try {
    const [fingerprintContent, signatureContent, registryContent] = await Promise.all([
      readFile(fingerprintPath, 'utf8'),
      readFile(signaturePath, 'utf8'),
      readFile(registryPath, 'utf8')
    ]);
    const result = verifyExecutionAuditSigningRegistryFingerprintSignatureWithRegistry(
      fingerprintContent,
      parseExecutionAuditSigningRegistryFingerprintSignature(signatureContent),
      parseTrustedExecutionAuditSigningKeyRegistry(registryContent)
    );
    console.log(JSON.stringify(result));
    if (!result.valid) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Registry-backed signature verification failed.');
    process.exitCode = 2;
  }
}

void main();
