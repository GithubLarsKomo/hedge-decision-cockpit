import { readFile } from 'node:fs/promises';
import process from 'node:process';
import {
  parseExecutionAuditEvidenceSignature,
  verifyExecutionAuditEvidenceManifestSignature
} from '../lib/execution-audit-evidence-signature';
import {
  parseTrustedExecutionAuditSigningKeyRegistry,
  resolveTrustedExecutionAuditSigningKey
} from '../lib/execution-audit-evidence-trusted-keys';

async function main() {
  const [, , manifestPath, signaturePath, registryPath] = process.argv;
  if (!manifestPath || !signaturePath || !registryPath) {
    console.error(
      'Usage: npm run verify:audit-evidence-signature-registry -- <manifest.json> <signature.json> <trusted-keys.json>'
    );
    process.exitCode = 2;
    return;
  }

  try {
    const [manifestContent, signatureContent, registryContent] = await Promise.all([
      readFile(manifestPath, 'utf8'),
      readFile(signaturePath, 'utf8'),
      readFile(registryPath, 'utf8')
    ]);
    const signature = parseExecutionAuditEvidenceSignature(signatureContent);
    const registry = parseTrustedExecutionAuditSigningKeyRegistry(registryContent);
    const trustedKey = resolveTrustedExecutionAuditSigningKey(registry, signature.keyId, signature.signedAt);
    const valid = verifyExecutionAuditEvidenceManifestSignature(
      manifestContent,
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
    console.error(error instanceof Error ? error.message : 'Registry-backed signature verification failed.');
    process.exitCode = 2;
  }
}

void main();
