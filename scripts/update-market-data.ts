import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

type CliOptions = {
  envFile: string;
  observationStart?: string;
  observationEnd?: string;
  hedgeCoveragePercent?: number | null;
  createDecision: boolean;
};

const HOST_SQLITE_URL = 'file:../data/hedge.db';

function usage(): string {
  return `Usage: npm run update:market-data -- [options]\n\nOptions:\n  --env-file <path>          Environment file (default: .env.docker)\n  --start <YYYY-MM-DD>       Explicit FRED observation start\n  --end <YYYY-MM-DD>         Explicit FRED observation end\n  --decision                 Also create/replay the latest hedge decision\n  --hedge-coverage <percent> Create a decision with this hedge coverage\n  --help                     Show this help\n\nWithout --start/--end the canonical overlapping ten-day FRED sync is used.\nBy default only market data is synchronized; --decision opts into decision creation.\n`;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { envFile: '.env.docker', createDecision: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--decision') {
      options.createDecision = true;
      continue;
    }

    const next = args[index + 1];
    if (!next) throw new Error(`Missing value after ${arg}.`);
    index += 1;

    if (arg === '--env-file') options.envFile = next;
    else if (arg === '--start') options.observationStart = next;
    else if (arg === '--end') options.observationEnd = next;
    else if (arg === '--hedge-coverage') {
      const value = Number(next);
      if (!Number.isFinite(value) || value < 0 || value > 1000) {
        throw new Error('--hedge-coverage must be a number between 0 and 1000.');
      }
      options.hedgeCoveragePercent = value;
      options.createDecision = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2
    && ((trimmed.startsWith('"') && trimmed.endsWith('"'))
      || (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function loadEnvFile(filePath: string): Promise<void> {
  if (!existsSync(filePath)) return;
  const text = await readFile(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = unquote(line.slice(separator + 1));
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const envFile = path.resolve(options.envFile);
  const inheritedDatabaseUrl = process.env.DATABASE_URL;
  await loadEnvFile(envFile);

  await mkdir(path.resolve('data'), { recursive: true });
  // Ignore any Docker-only DATABASE_URL that may be present in the env file.
  process.env.DATABASE_URL = inheritedDatabaseUrl || HOST_SQLITE_URL;

  if (!process.env.FRED_API_KEY?.trim()) {
    throw new Error(`FRED_API_KEY is required. Add it to ${envFile} or the process environment.`);
  }

  const [{ runMarketDataUpdate }, { prisma }] = await Promise.all([
    import('../lib/market-data-update'),
    import('../lib/prisma')
  ]);

  try {
    const result = await runMarketDataUpdate({
      ...(options.observationStart ? { observationStart: options.observationStart } : {}),
      ...(options.observationEnd ? { observationEnd: options.observationEnd } : {}),
      hedgeCoveragePercent: options.hedgeCoveragePercent ?? null,
      createDecision: options.createDecision
    });

    console.log(JSON.stringify(result, null, 2));
    if (result.decision && options.hedgeCoveragePercent == null) {
      console.error('Note: hedge coverage was not supplied; the decision uses the existing market-context-only NULL semantics.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
