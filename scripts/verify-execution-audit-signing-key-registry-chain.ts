import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { verifyExecutionAuditSigningRegistryChain } from '../lib/execution-audit-signing-registry-chain';

async function main() {
  const [, , registryPath, fingerprintPath, signaturePath, trustRegistryPath] = process.argv;
  if (!registryPath || !fingerprintPath || !signaturePath || !trustRegistryPath) {
    console.error(
      'Usage: npm run verify:audit-signing-registry-chain -- <registry.json> <fingerprint.json> <signature.json> <trust-registry.json>'
    );
    process.exitCode = 2;
    return;
  }

  try {
    const [registryContent, fingerprintContent, signatureContent, trustRegistryContent] = await Promise.all([
      readFile(registryPath, 'utf8'),
      readFile(fingerprintPath, 'utf8'),
      readFile(signaturePath, 'utf8'),
      readFile(trustRegistryPath, 'utf8')
    ]);
    const result = verifyExecutionAuditSigningRegistryChain(
      registryContent,
      fingerprintContent,
      signatureContent,
      trustRegistryContent
    );
    console.log(JSON.stringify(result));
    if (!result.valid) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Audit signing registry chain verification failed.');
    process.exitCode = 2;
  }
}

void main();
