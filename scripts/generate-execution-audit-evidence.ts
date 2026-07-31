import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import {
  buildExecutionAuditEvidenceManifest,
  countExecutionAuditCsvRecords,
  serializeExecutionAuditEvidenceManifest
} from '../lib/execution-audit-evidence';

async function main() {
  const [, , csvPath, manifestPath] = process.argv;

  if (!csvPath || !manifestPath) {
    console.error('Usage: npm run generate:audit-evidence -- <audit.csv> <manifest.json>');
    process.exitCode = 2;
    return;
  }

  try {
    const csv = await readFile(csvPath, 'utf8');
    const recordCount = countExecutionAuditCsvRecords(csv);
    const manifest = await buildExecutionAuditEvidenceManifest(csv, recordCount);

    await writeFile(manifestPath, serializeExecutionAuditEvidenceManifest(manifest), 'utf8');
    console.log(JSON.stringify(manifest, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Audit evidence manifest generation failed.');
    process.exitCode = 2;
  }
}

void main();
