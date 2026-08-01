import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generatePortfolioSnapshot } from '../lib/portfolio-snapshot-generator';

function usage(): never {
  console.error('Usage: tsx scripts/generate-portfolio-snapshot.ts <input.json> <output.json>');
  process.exit(2);
}

const [, , inputArg, outputArg] = process.argv;
if (!inputArg || !outputArg) usage();

try {
  const inputPath = resolve(inputArg);
  const outputPath = resolve(outputArg);
  const input = JSON.parse(readFileSync(inputPath, 'utf8'));
  const snapshot = generatePortfolioSnapshot(input);
  writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`${snapshot.snapshot_id} r${snapshot.revision} ${snapshot.input_fingerprint}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
