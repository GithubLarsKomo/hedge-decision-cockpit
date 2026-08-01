import { readFileSync } from 'node:fs';
import { buildMonthlyDecisionReport, stableSerializeMonthlyDecisionReport } from '../lib/monthly-decision-report';
import type { HedgeContext } from '../lib/portfolio-decision-variants';

const [inputPath, hedgePath] = process.argv.slice(2);

if (!inputPath) {
  console.error('Usage: npm run run:monthly-decision-report -- <monthly-input.json> [hedge-context.json]');
  process.exit(2);
}

async function main(): Promise<void> {
  const input = JSON.parse(readFileSync(inputPath, 'utf8'));
  const hedgeContext = hedgePath
    ? (JSON.parse(readFileSync(hedgePath, 'utf8')) as HedgeContext)
    : undefined;

  const report = await buildMonthlyDecisionReport(input, hedgeContext);
  process.stdout.write(`${stableSerializeMonthlyDecisionReport(report)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
