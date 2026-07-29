import { MarketSnapshotInput, NormalizedMarketSnapshot, normalizeMarketSnapshotBatch } from './market-snapshot';

export type CsvImportOptions = {
  source: string;
  delimiter?: ',' | ';' | '\t';
};

const REQUIRED_COLUMNS = ['observedAt', 'ndxClose', 'ndxReferenceHigh'] as const;
const OPTIONAL_COLUMNS = ['vixClose', 'vxnClose', 'riskFreeRate', 'dividendYield'] as const;

type ColumnName = (typeof REQUIRED_COLUMNS)[number] | (typeof OPTIONAL_COLUMNS)[number];

function parseLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }

  if (quoted) {
    throw new Error('CSV contains an unterminated quoted field.');
  }

  values.push(value.trim());
  return values;
}

function requiredNumber(value: string, column: string, row: number): number {
  if (!value) {
    throw new Error(`Missing ${column} in CSV row ${row}.`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${column} in CSV row ${row}.`);
  }

  return parsed;
}

function optionalNumber(value: string, column: string, row: number): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${column} in CSV row ${row}.`);
  }

  return parsed;
}

function stripByteOrderMark(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

export function importMarketSnapshotCsv(
  csv: string,
  options: CsvImportOptions
): NormalizedMarketSnapshot[] {
  const source = options.source.trim();
  if (!source) {
    throw new Error('CSV import source is required.');
  }

  const delimiter = options.delimiter ?? ',';
  const lines = stripByteOrderMark(csv)
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('CSV must contain a header and at least one data row.');
  }

  const headers = parseLine(lines[0], delimiter);
  const positions = new Map<string, number>();
  headers.forEach((header, index) => {
    if (positions.has(header)) {
      throw new Error(`Duplicate CSV column: ${header}.`);
    }
    positions.set(header, index);
  });

  for (const required of REQUIRED_COLUMNS) {
    if (!positions.has(required)) {
      throw new Error(`Missing required CSV column: ${required}.`);
    }
  }

  const inputs: MarketSnapshotInput[] = lines.slice(1).map((line, index) => {
    const row = index + 2;
    const fields = parseLine(line, delimiter);
    if (fields.length !== headers.length) {
      throw new Error(
        `CSV row ${row} has ${fields.length} fields; expected ${headers.length}.`
      );
    }

    const get = (column: ColumnName): string => {
      const position = positions.get(column);
      return position == null ? '' : fields[position];
    };

    return {
      observedAt: get('observedAt'),
      source,
      ndxClose: requiredNumber(get('ndxClose'), 'ndxClose', row),
      ndxReferenceHigh: requiredNumber(get('ndxReferenceHigh'), 'ndxReferenceHigh', row),
      vixClose: optionalNumber(get('vixClose'), 'vixClose', row),
      vxnClose: optionalNumber(get('vxnClose'), 'vxnClose', row),
      riskFreeRate: optionalNumber(get('riskFreeRate'), 'riskFreeRate', row),
      dividendYield: optionalNumber(get('dividendYield'), 'dividendYield', row)
    };
  });

  return normalizeMarketSnapshotBatch(inputs);
}
