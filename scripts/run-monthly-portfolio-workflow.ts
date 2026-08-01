import { readFile } from 'node:fs/promises';
import { runMonthlyPortfolioWorkflow } from '../lib/monthly-portfolio-workflow';
import { monthlyPortfolioInputSchema } from '../lib/portfolio-snapshot-generator';

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Usage: npm run run:monthly-portfolio -- <monthly-input.json>');
  }

  const raw = await readFile(inputPath, 'utf8');
  const input = monthlyPortfolioInputSchema.parse(JSON.parse(raw));
  const result = await runMonthlyPortfolioWorkflow(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
