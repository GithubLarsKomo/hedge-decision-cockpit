import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

type CliOptions = {
  envFile: string;
  keepLegacyRunning: boolean;
  allowEmptySource: boolean;
};

type Row = Record<string, unknown>;

type TableSpec = {
  table: string;
  delegate: string;
  columns: string[];
  jsonColumns?: string[];
  dateColumns?: string[];
  booleanColumns?: string[];
};

const TABLES: TableSpec[] = [
  {
    table: 'Decision',
    delegate: 'decision',
    columns: [
      'id', 'createdAt', 'observedAt', 'source', 'inputFingerprint', 'ruleVersion',
      'triggeredRulesJson', 'ndxNow', 'ndxHigh2y', 'ndxDrawdownPct', 'vixNow',
      'vixPercentile', 'action', 'severity', 'recommendation', 'portfolioMarketValueEur',
      'hedgeMarketValueEur', 'hedgeUnrealizedGainEur', 'hedgeCoveragePercent', 'notes'
    ],
    jsonColumns: ['triggeredRulesJson'],
    dateColumns: ['createdAt', 'observedAt']
  },
  {
    table: 'ImportedPortfolioSnapshot',
    delegate: 'importedPortfolioSnapshot',
    columns: [
      'id', 'createdAt', 'snapshotId', 'revision', 'asOf', 'generatedAt', 'schemaVersion',
      'strategyName', 'strategyVersion', 'inputFingerprint', 'payloadJson'
    ],
    jsonColumns: ['payloadJson'],
    dateColumns: ['createdAt', 'asOf', 'generatedAt']
  },
  {
    table: 'EtfMappingArtifact',
    delegate: 'etfMappingArtifact',
    columns: [
      'id', 'createdAt', 'mappingVersion', 'effectiveDate', 'mappingFingerprint',
      'schemaVersion', 'payloadJson'
    ],
    jsonColumns: ['payloadJson'],
    dateColumns: ['createdAt', 'effectiveDate']
  },
  {
    table: 'EtfMappingReviewRecord',
    delegate: 'etfMappingReviewRecord',
    columns: [
      'id', 'createdAt', 'recordFingerprint', 'schemaVersion', 'currentMappingVersion',
      'currentMappingFingerprint', 'candidateMappingVersion', 'candidateMappingFingerprint',
      'outcome', 'reviewer', 'reviewedAt', 'rationale', 'payloadJson'
    ],
    jsonColumns: ['payloadJson'],
    dateColumns: ['createdAt', 'reviewedAt']
  },
  {
    table: 'MonthlyRunCompletion',
    delegate: 'monthlyRunCompletion',
    columns: [
      'id', 'createdAt', 'completedAt', 'completionFingerprint', 'snapshotFingerprint',
      'decisionId', 'mappingReviewFingerprint', 'actor', 'rationale'
    ],
    dateColumns: ['createdAt', 'completedAt']
  },
  {
    table: 'MarketSnapshot',
    delegate: 'marketSnapshot',
    columns: [
      'id', 'createdAt', 'observedAt', 'source', 'contentHash', 'ndxClose',
      'ndxReferenceHigh', 'ndxDrawdownPercent', 'vixClose', 'vxnClose',
      'riskFreeRate', 'dividendYield'
    ],
    dateColumns: ['createdAt', 'observedAt']
  },
  {
    table: 'PortfolioSnapshot',
    delegate: 'portfolioSnapshot',
    columns: ['id', 'decisionId', 'createdAt', 'marketValueEur', 'targetHedgePercent'],
    dateColumns: ['createdAt']
  },
  {
    table: 'HedgePositionSnapshot',
    delegate: 'hedgePositionSnapshot',
    columns: [
      'id', 'decisionId', 'createdAt', 'underlying', 'instrumentDescription', 'quantity',
      'strike', 'expiry', 'marketValueEur', 'unrealizedGainEur'
    ],
    dateColumns: ['createdAt', 'expiry']
  },
  {
    table: 'ExecutionAuditRecord',
    delegate: 'executionAuditRecord',
    columns: [
      'id', 'decisionId', 'recommendationId', 'recommendedStrategy', 'recommendedContracts',
      'decidedAt', 'approvalDecision', 'approvalActorId', 'approvalRecordedAt', 'approvalReason',
      'executionStatus', 'executionActorId', 'executionRecordedAt', 'executedStrategy',
      'executedContracts', 'averagePrice', 'strategyChanged', 'contractQuantityChanged',
      'notFullyExecuted', 'deviationReason', 'createdAt'
    ],
    dateColumns: ['decidedAt', 'approvalRecordedAt', 'executionRecordedAt', 'createdAt'],
    booleanColumns: ['strategyChanged', 'contractQuantityChanged', 'notFullyExecuted']
  }
];

const INSERT_BATCH_SIZE = 25;
const HOST_SQLITE_URL = 'file:../data/hedge.db';

function usage(): string {
  return `Usage: npm run migrate:mariadb-to-sqlite -- [options]\n\nOptions:\n  --env-file <path>       Environment file (default: .env.docker)\n  --keep-legacy-running   Leave the migration-only MariaDB container running\n  --allow-empty-source    Allow migration from an entirely empty legacy database\n  --help                  Show this help\n`;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    envFile: '.env.docker',
    keepLegacyRunning: false,
    allowEmptySource: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--keep-legacy-running') {
      options.keepLegacyRunning = true;
      continue;
    }
    if (arg === '--allow-empty-source') {
      options.allowEmptySource = true;
      continue;
    }
    if (arg === '--env-file') {
      const next = args[index + 1];
      if (!next) throw new Error('Missing value after --env-file.');
      options.envFile = next;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
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
  if (!existsSync(filePath)) throw new Error(`Environment file not found: ${filePath}`);
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

function run(command: string, args: string[], options: { input?: string; quiet?: boolean } = {}) {
  const result = spawnSync(command, args, {
    input: options.input,
    encoding: 'utf8',
    env: process.env,
    shell: false,
    maxBuffer: 64 * 1024 * 1024,
    stdio: options.quiet ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'inherit', 'inherit']
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return typeof result.stdout === 'string' ? result.stdout : '';
}

function prismaCliPath(): string {
  return path.resolve('node_modules', 'prisma', 'build', 'index.js');
}

function composeArgs(envFile: string): string[] {
  return ['compose', '--env-file', envFile, '--profile', 'migration'];
}

function jsonObjectSql(spec: TableSpec): string {
  const pairs = spec.columns.map(column => `'${column}', \`${column}\``).join(', ');
  return `SELECT JSON_OBJECT(${pairs}) FROM \`${spec.table}\` ORDER BY \`id\`;`;
}

function parseJsonLines(text: string, table: string): Row[] {
  if (!text.trim()) return [];
  return text
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as Row;
      } catch (error) {
        throw new Error(`Could not parse ${table} row ${index + 1}: ${error instanceof Error ? error.message : error}`);
      }
    });
}

function normalizeRow(row: Row, spec: TableSpec): Row {
  const result: Row = { ...row };

  for (const column of spec.jsonColumns ?? []) {
    const value = result[column];
    if (typeof value === 'string') result[column] = JSON.parse(value);
  }

  for (const column of spec.dateColumns ?? []) {
    const value = result[column];
    if (value == null) continue;
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid ${spec.table}.${column} date: ${String(value)}`);
    result[column] = parsed;
  }

  for (const column of spec.booleanColumns ?? []) {
    const value = result[column];
    if (value == null) continue;
    result[column] = value === true || value === 1 || value === '1';
  }

  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const envFile = path.resolve(options.envFile);
  const inheritedDatabaseUrl = process.env.DATABASE_URL;
  await loadEnvFile(envFile);
  await mkdir(path.resolve('data'), { recursive: true });

  // .env.docker belongs to the container runtime. A stale/container-only DATABASE_URL
  // in that file must never redirect the host migration away from ./data/hedge.db.
  process.env.DATABASE_URL = inheritedDatabaseUrl || HOST_SQLITE_URL;

  const prismaCli = prismaCliPath();
  if (!existsSync(prismaCli)) {
    throw new Error('Prisma CLI not installed. Run npm install first.');
  }

  console.log('Generating SQLite Prisma client and applying the SQLite schema...');
  run(process.execPath, [prismaCli, 'generate'], { quiet: true });
  run(process.execPath, [prismaCli, 'db', 'push', '--skip-generate'], { quiet: true });

  const dockerArgs = composeArgs(envFile);
  console.log('Starting migration-only legacy MariaDB service...');
  run('docker', [...dockerArgs, 'up', '-d', '--wait', 'legacy-db']);

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const db = prisma as unknown as Record<string, {
    count(): Promise<number>;
    createMany(args: { data: Row[] }): Promise<{ count: number }>;
  }>;

  try {
    const targetCounts: Record<string, number> = {};
    for (const spec of TABLES) targetCounts[spec.table] = await db[spec.delegate].count();
    const nonEmptyTargets = Object.entries(targetCounts).filter(([, count]) => count > 0);
    if (nonEmptyTargets.length > 0) {
      throw new Error(
        `Target SQLite database is not empty: ${nonEmptyTargets.map(([table, count]) => `${table}=${count}`).join(', ')}. `
        + 'Back up and remove data/hedge.db before retrying the one-time migration.'
      );
    }

    const sourceRows = new Map<string, Row[]>();
    let sourceTotal = 0;

    for (const spec of TABLES) {
      const shell = 'exec mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" --batch --skip-column-names --raw';
      const output = run(
        'docker',
        [...dockerArgs, 'exec', '-T', 'legacy-db', 'sh', '-lc', shell],
        { input: `${jsonObjectSql(spec)}\n`, quiet: true }
      );
      const rows = parseJsonLines(output, spec.table).map(row => normalizeRow(row, spec));
      sourceRows.set(spec.table, rows);
      sourceTotal += rows.length;
      console.log(`${spec.table}: ${rows.length} source rows`);
    }

    if (sourceTotal === 0 && !options.allowEmptySource) {
      throw new Error(
        'Legacy MariaDB appears completely empty. Migration stopped to avoid silently using a newly-created empty legacy volume. '
        + 'If an empty source is intentional, rerun with --allow-empty-source.'
      );
    }

    for (const spec of TABLES) {
      const rows = sourceRows.get(spec.table) ?? [];
      for (let offset = 0; offset < rows.length; offset += INSERT_BATCH_SIZE) {
        const batch = rows.slice(offset, offset + INSERT_BATCH_SIZE);
        await db[spec.delegate].createMany({ data: batch });
      }
    }

    const verification: Record<string, { source: number; sqlite: number }> = {};
    for (const spec of TABLES) {
      const source = sourceRows.get(spec.table)?.length ?? 0;
      const sqlite = await db[spec.delegate].count();
      verification[spec.table] = { source, sqlite };
      if (source !== sqlite) throw new Error(`Verification failed for ${spec.table}: source=${source}, sqlite=${sqlite}.`);
    }

    console.log('\nMigration verified:');
    console.log(JSON.stringify(verification, null, 2));
    console.log(`SQLite target: ${process.env.DATABASE_URL}`);
    console.log('The legacy MariaDB volume has not been deleted. Keep it until you have verified the cockpit manually.');
  } finally {
    await prisma.$disconnect();
    if (!options.keepLegacyRunning) {
      console.log('Stopping migration-only legacy MariaDB service...');
      run('docker', [...dockerArgs, 'stop', 'legacy-db']);
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
