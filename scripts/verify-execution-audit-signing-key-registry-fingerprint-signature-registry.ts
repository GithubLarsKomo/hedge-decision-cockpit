import { readFile } from 'node:fs/promises';
import process from 'node:process';
import {
  parseExecutionAuditSigningRegistryFingerprintSignature,
  verifyExecutionAuditSigningRegistryFingerprintSignature
} from '../lib/execution-audit-signing-registry-fingerprint-signature';
import {
  parseTrustedExecutionAuditSigningKeyRegistry,
  resolveTrustedExecutionAuditSigningKey
} from '../lib/execution-audit-evidence-trusted-keys';

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
    const signature = parseExecutionAuditSigningRegistryFingerprintSignature(signatureContent);
    const registry = parseTrustedExecutionAuditSigningKeyRegistry(registryContent);
    const trustedKey = resolveTrustedExecutionAuditSigningKey(registry, signature.keyId, signature.signedAt);
    const valid = verifyExecutionAuditSigningRegistryFingerprintSignature(
      fingerprintContent,
      signature,
      trustedKey.publicKeyPem
    );

    console.log(
      JSON.stringify({
        valid,
        trusted: true,
        keyId: signature.keyId,
        signedAt: signature.signedAt,
        activeFrom: trustedKey.activeFrom,
        revokedAt: trustedKey.revokedAt ?? null
      })
    );
    process.exitCode = valid ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Registry-backed fingerprint signature verification failed.');
    process.exitCode = 2;
  }
}

void main();
