import { readFile } from 'node:fs/promises';
import process from 'node:process';
import {
  parseExecutionAuditEvidenceManifest,
  verifyExecutionAuditEvidence
} from '../lib/execution-audit-evidence';

async function main() {
  const [, , csvPath, manifestPath] = process.argv;

  if (!csvPath || !manifestPath) {
    console.error('Usage: npm run verify:audit-evidence -- <audit.csv> <manifest.json>');
    process.exitCode = 2;
    return;
  }

  try {
    const [csv, manifestContent] = await Promise.all([
      readFile(csvPath, 'utf8'),
      readFile(manifestPath, 'utf8')
    ]);
    const manifest = parseExecutionAuditEvidenceManifest(manifestContent);
    const result = await verifyExecutionAuditEvidence(csv, manifest);

    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Audit evidence verification failed.');
    process.exitCode = 2;
  }
}

void main();
