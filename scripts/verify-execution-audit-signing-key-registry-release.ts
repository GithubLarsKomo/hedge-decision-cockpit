import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { parseTrustedExecutionAuditSigningKeyRegistry } from '../lib/execution-audit-evidence-trusted-keys';
import { parseExecutionAuditSigningRegistryFingerprint } from '../lib/execution-audit-signing-registry-fingerprint';
import { parseExecutionAuditSigningRegistryFingerprintSignature } from '../lib/execution-audit-signing-registry-fingerprint-signature';
import { verifyExecutionAuditSigningRegistryRelease } from '../lib/execution-audit-signing-registry-release';

async function main() {
  const [, , registryPath, fingerprintPath, signaturePath, trustedSigningKeysPath] = process.argv;
  if (!registryPath || !fingerprintPath || !signaturePath || !trustedSigningKeysPath) {
    console.error(
      'Usage: npm run verify:audit-signing-registry-release -- <registry.json> <fingerprint.json> <signature.json> <trusted-signing-keys.json>'
    );
    process.exitCode = 2;
    return;
  }

  try {
    const [registryContent, fingerprintContent, signatureContent, trustedSigningKeysContent] = await Promise.all([
      readFile(registryPath, 'utf8'),
      readFile(fingerprintPath, 'utf8'),
      readFile(signaturePath, 'utf8'),
      readFile(trustedSigningKeysPath, 'utf8')
    ]);
    const result = verifyExecutionAuditSigningRegistryRelease(
      parseTrustedExecutionAuditSigningKeyRegistry(registryContent),
      fingerprintContent,
      parseExecutionAuditSigningRegistryFingerprint(fingerprintContent),
      parseExecutionAuditSigningRegistryFingerprintSignature(signatureContent),
      parseTrustedExecutionAuditSigningKeyRegistry(trustedSigningKeysContent)
    );
    console.log(JSON.stringify(result));
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Audit signing registry release verification failed.');
    process.exitCode = 2;
  }
}

void main();
