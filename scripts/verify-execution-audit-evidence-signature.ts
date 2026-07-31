import { readFile } from 'node:fs/promises';
import process from 'node:process';
import {
  parseExecutionAuditEvidenceSignature,
  verifyExecutionAuditEvidenceManifestSignature
} from '../lib/execution-audit-evidence-signature';

async function main() {
  const [, , manifestPath, signaturePath, publicKeyPath] = process.argv;
  if (!manifestPath || !signaturePath || !publicKeyPath) {
    console.error(
      'Usage: npm run verify:audit-evidence-signature -- <manifest.json> <signature.json> <public-key.pem>'
    );
    process.exitCode = 2;
    return;
  }

  try {
    const [manifestContent, signatureContent, publicKeyPem] = await Promise.all([
      readFile(manifestPath, 'utf8'),
      readFile(signaturePath, 'utf8'),
      readFile(publicKeyPath, 'utf8')
    ]);
    const signature = parseExecutionAuditEvidenceSignature(signatureContent);
    const valid = verifyExecutionAuditEvidenceManifestSignature(manifestContent, signature, publicKeyPem);
    console.log(JSON.stringify({ valid, keyId: signature.keyId, signedAt: signature.signedAt }));
    process.exitCode = valid ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Audit evidence signature verification failed.');
    process.exitCode = 2;
  }
}

void main();
