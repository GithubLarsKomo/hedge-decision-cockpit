import { readFileSync } from 'node:fs';
import { buildMonthlyDecisionReport, stableSerializeMonthlyDecisionReport } from '../lib/monthly-decision-report';
import type { HedgeContext } from '../lib/portfolio-decision-variants';
import type { MonthlyPortfolioInput } from '../lib/portfolio-snapshot-generator';

const args = process.argv.slice(2);
const inputPath = args[0];

if (!inputPath) {
  console.error(
    'Usage: npm run run:monthly-decision-report -- <monthly-input.json> [hedge-context.json] [--gpo-target <gpo-target.json>] [--etf-mapping <etf-mapping.json>] [--hedge <hedge-context.json>]'
  );
  process.exit(2);
}

function parseOptionalPaths(values: string[]): {
  hedgePath?: string;
  gpoTargetPath?: string;
  etfMappingPath?: string;
} {
  let hedgePath: string | undefined;
  let gpoTargetPath: string | undefined;
  let etfMappingPath: string | undefined;

  for (let index = 1; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--gpo-target' || value === '--etf-mapping' || value === '--hedge') {
      const path = values[index + 1];
      if (!path) throw new Error(`${value} requires a file path.`);
      if (value === '--gpo-target') gpoTargetPath = path;
      if (value === '--etf-mapping') etfMappingPath = path;
      if (value === '--hedge') hedgePath = path;
      index += 1;
      continue;
    }

    if (!hedgePath) {
      hedgePath = value;
      continue;
    }

    throw new Error(`Unexpected argument: ${value}`);
  }

  return { hedgePath, gpoTargetPath, etfMappingPath };
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function main(): Promise<void> {
  const { hedgePath, gpoTargetPath, etfMappingPath } = parseOptionalPaths(args);
  const input = readJson(inputPath) as MonthlyPortfolioInput;
  const hedgeContext = hedgePath ? (readJson(hedgePath) as HedgeContext) : undefined;
  const preprocessing = gpoTargetPath || etfMappingPath
    ? {
        gpoTargetAllocation: gpoTargetPath ? readJson(gpoTargetPath) : undefined,
        etfMapping: etfMappingPath ? readJson(etfMappingPath) : undefined
      }
    : undefined;

  const report = await buildMonthlyDecisionReport(input, hedgeContext, preprocessing);
  process.stdout.write(`${stableSerializeMonthlyDecisionReport(report)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
