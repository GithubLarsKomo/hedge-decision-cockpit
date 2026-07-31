import { readFile } from 'node:fs/promises';
import process from 'node:process';
import {
  parseExecutionAuditSigningRegistryFingerprintSignature,
  verifyExecutionAuditSigningRegistryFingerprintSignature
} from '../lib/execution-audit-signing-registry-fingerprint-signature';

async function main() {
  const [, , fingerprintPath, signaturePath, publicKeyPath] = process.argv;
  if (!fingerprintPath || !signaturePath || !publicKeyPath) {
    console.error('Usage: npm run verify:audit-signing-registry-fingerprint-signature -- <fingerprint.json> <signature.json> <public-key.pem>');
    process.exitCode = 2;
    return;
  }

  try {
    const [fingerprintContent, signatureContent, publicKeyPem] = await Promise.all([
      readFile(fingerprintPath, 'utf8'),
      readFile(signaturePath, 'utf8'),
      readFile(publicKeyPath, 'utf8')
    ]);
    const signature = parseExecutionAuditSigningRegistryFingerprintSignature(signatureContent);
    const valid = verifyExecutionAuditSigningRegistryFingerprintSignature(fingerprintContent, signature, publicKeyPem);
    console.log(JSON.stringify({ valid, keyId: signature.keyId, signedAt: signature.signedAt }));
    process.exitCode = valid ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Registry fingerprint signature verification failed.');
    process.exitCode = 2;
  }
}

void main();
