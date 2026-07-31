import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import {
  buildExecutionAuditEvidenceManifest,
  countExecutionAuditCsvRecords,
  serializeExecutionAuditEvidenceManifest
} from '../lib/execution-audit-evidence';

function parseArguments(args: string[]) {
  const force = args.includes('--force');
  const positional = args.filter(argument => argument !== '--force');
  const [csvPath, manifestPath] = positional;

  return { csvPath, manifestPath, force };
}

async function main() {
  const { csvPath, manifestPath, force } = parseArguments(process.argv.slice(2));

  if (!csvPath || !manifestPath) {
    console.error(
      'Usage: npm run generate:audit-evidence -- <audit.csv> <manifest.json> [--force]'
    );
    process.exitCode = 2;
    return;
  }

  try {
    const csv = await readFile(csvPath, 'utf8');
    const recordCount = countExecutionAuditCsvRecords(csv);
    const manifest = await buildExecutionAuditEvidenceManifest(csv, recordCount);

    await writeFile(manifestPath, serializeExecutionAuditEvidenceManifest(manifest), {
      encoding: 'utf8',
      flag: force ? 'w' : 'wx'
    });
    console.log(JSON.stringify(manifest, null, 2));
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'EEXIST'
    ) {
      console.error('Manifest already exists. Re-run with --force to overwrite it.');
    } else {
      console.error(error instanceof Error ? error.message : 'Audit evidence manifest generation failed.');
    }
    process.exitCode = 2;
  }
}

void main();
