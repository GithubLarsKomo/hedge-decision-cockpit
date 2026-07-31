import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import {
  serializeExecutionAuditEvidenceSignature,
  signExecutionAuditEvidenceManifest
} from '../lib/execution-audit-evidence-signature';

async function main() {
  const [, , manifestPath, privateKeyPath, keyId, signaturePath] = process.argv;
  if (!manifestPath || !privateKeyPath || !keyId || !signaturePath) {
    console.error(
      'Usage: npm run sign:audit-evidence -- <manifest.json> <private-key.pem> <key-id> <signature.json>'
    );
    process.exitCode = 2;
    return;
  }

  try {
    const [manifestContent, privateKeyPem] = await Promise.all([
      readFile(manifestPath, 'utf8'),
      readFile(privateKeyPath, 'utf8')
    ]);
    const signature = signExecutionAuditEvidenceManifest(manifestContent, privateKeyPem, keyId);
    await writeFile(signaturePath, serializeExecutionAuditEvidenceSignature(signature), {
      encoding: 'utf8',
      flag: 'wx'
    });
    console.log(JSON.stringify(signature));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Audit evidence signing failed.');
    process.exitCode = 2;
  }
}

void main();
