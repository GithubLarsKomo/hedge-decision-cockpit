import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import {
  serializeExecutionAuditSigningRegistryFingerprintSignature,
  signExecutionAuditSigningRegistryFingerprint
} from '../lib/execution-audit-signing-registry-fingerprint-signature';

async function main() {
  const [, , fingerprintPath, privateKeyPath, keyId, signaturePath] = process.argv;
  if (!fingerprintPath || !privateKeyPath || !keyId || !signaturePath) {
    console.error('Usage: npm run sign:audit-signing-registry-fingerprint -- <fingerprint.json> <private-key.pem> <key-id> <signature.json>');
    process.exitCode = 2;
    return;
  }

  try {
    const [fingerprintContent, privateKeyPem] = await Promise.all([
      readFile(fingerprintPath, 'utf8'),
      readFile(privateKeyPath, 'utf8')
    ]);
    const signature = signExecutionAuditSigningRegistryFingerprint(fingerprintContent, privateKeyPem, keyId);
    await writeFile(signaturePath, serializeExecutionAuditSigningRegistryFingerprintSignature(signature), {
      encoding: 'utf8',
      flag: 'wx'
    });
    console.log(JSON.stringify(signature));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Registry fingerprint signing failed.');
    process.exitCode = 2;
  }
}

void main();
