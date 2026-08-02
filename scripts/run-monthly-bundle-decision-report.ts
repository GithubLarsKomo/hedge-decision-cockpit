import { readFileSync } from 'node:fs';
import {
  buildMonthlyBundleDecisionReport,
  stableSerializeMonthlyBundleDecisionReport
} from '../lib/monthly-bundle-decision-report';

const args = process.argv.slice(2);

if (args.length !== 1) {
  console.error('Usage: npm run run:monthly-bundle-decision-report -- <monthly-run-bundle.json>');
  process.exit(2);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function main(): Promise<void> {
  const report = await buildMonthlyBundleDecisionReport(readJson(args[0]));
  process.stdout.write(`${stableSerializeMonthlyBundleDecisionReport(report)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
