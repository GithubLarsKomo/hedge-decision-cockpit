import { readFile } from 'node:fs/promises';
import { prisma } from '../lib/prisma';
import { importMarketSnapshotCsv } from '../lib/market-snapshot-csv';
import { persistMarketSnapshots } from '../lib/market-snapshot-store';

async function main() {
  const [, , filePath, source, delimiterArg] = process.argv;
  if (!filePath || !source) {
    throw new Error('Usage: npm run import:market-snapshots -- <file.csv> <source> [comma|semicolon|tab]');
  }

  const delimiter = delimiterArg === 'semicolon' ? ';' : delimiterArg === 'tab' ? '\t' : ',';
  const csv = await readFile(filePath, 'utf8');
  const snapshots = importMarketSnapshotCsv(csv, { source, delimiter });
  const result = await persistMarketSnapshots(prisma, snapshots);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
