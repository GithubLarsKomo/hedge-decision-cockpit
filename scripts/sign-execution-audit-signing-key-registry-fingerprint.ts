import { readFile } from 'node:fs/promises';
import process from 'node:process';
import {
  serializeExecutionAuditSigningRegistryFingerprintSignature,
  signExecutionAuditSigningRegistryFingerprint
} from '../lib/execution-audit-signing-registry-fingerprint-signature';
import { parseExecutionAuditSigningRegistryFingerprint } from '../lib/execution-audit-signing-registry-fingerprint';

async function main() {
  const [, , fingerprintPath, privateKeyPath, keyId, signedAt] = process.argv;
  if (!fingerprintPath || !privateKeyPath || !keyId) {
    console.error(
      'Usage: npm run sign:audit-signing-registry-fingerprint -- <fingerprint.json> <private-key.pem> <key-id> [signed-at]'
    );
    process.exitCode = 2;
    return;
  }

  try {
    const [fingerprintContent, privateKeyPem] = await Promise.all([
      readFile(fingerprintPath, 'utf8'),
      readFile(privateKeyPath, 'utf8')
    ]);
    const fingerprint = parseExecutionAuditSigningRegistryFingerprint(fingerprintContent);
    const signature = signExecutionAuditSigningRegistryFingerprint(
      fingerprint,
      privateKeyPem,
      keyId,
      signedAt
    );
    process.stdout.write(serializeExecutionAuditSigningRegistryFingerprintSignature(signature));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Registry fingerprint signing failed.');
    process.exitCode = 2;
  }
}

void main();
