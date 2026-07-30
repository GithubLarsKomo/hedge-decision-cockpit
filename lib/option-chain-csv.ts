import { createHash } from 'node:crypto';

export type OptionType = 'call' | 'put';

export type OptionChainObservation = {
  observedAt: string;
  expiry: string;
  source: string;
  underlyingSymbol: string;
  underlyingPrice: number;
  optionType: OptionType;
  strike: number;
  bid: number | null;
  ask: number | null;
  last: number | null;
  impliedVolatility: number | null;
  openInterest: number | null;
  volume: number | null;
  contentHash: string;
};

export type OptionChainCsvOptions = {
  source: string;
  delimiter?: ',' | ';' | '\t';
};

const REQUIRED_COLUMNS = [
  'observedAt',
  'expiry',
  'underlyingSymbol',
  'underlyingPrice',
  'optionType',
  'strike'
] as const;

const OPTIONAL_COLUMNS = ['bid', 'ask', 'last', 'impliedVolatility', 'openInterest', 'volume'] as const;
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

  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  values.push(value.trim());
  return values;
}

function stripByteOrderMark(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function parseDate(value: string, column: string, row: number): string {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`Invalid ${column} in CSV row ${row}.`);
  return date.toISOString();
}

function requiredNumber(value: string, column: string, row: number): number {
  const parsed = Number(value);
  if (!value || !Number.isFinite(parsed)) throw new Error(`Invalid ${column} in CSV row ${row}.`);
  return parsed;
}

function optionalNumber(value: string, column: string, row: number): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${column} in CSV row ${row}.`);
  return parsed;
}

function nonNegative(value: number | null, column: string, row: number): number | null {
  if (value != null && value < 0) throw new Error(`${column} must not be negative in CSV row ${row}.`);
  return value;
}

function hashObservation(value: Omit<OptionChainObservation, 'contentHash'>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function importOptionChainCsv(
  csv: string,
  options: OptionChainCsvOptions
): OptionChainObservation[] {
  const source = options.source.trim();
  if (!source) throw new Error('CSV import source is required.');

  const delimiter = options.delimiter ?? ',';
  const lines = stripByteOrderMark(csv).split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) throw new Error('CSV must contain a header and at least one data row.');

  const headers = parseLine(lines[0], delimiter);
  const positions = new Map<string, number>();
  headers.forEach((header, index) => {
    if (positions.has(header)) throw new Error(`Duplicate CSV column: ${header}.`);
    positions.set(header, index);
  });
  for (const required of REQUIRED_COLUMNS) {
    if (!positions.has(required)) throw new Error(`Missing required CSV column: ${required}.`);
  }

  const observations = lines.slice(1).map((line, index) => {
    const row = index + 2;
    const fields = parseLine(line, delimiter);
    if (fields.length !== headers.length) {
      throw new Error(`CSV row ${row} has ${fields.length} fields; expected ${headers.length}.`);
    }
    const get = (column: ColumnName): string => {
      const position = positions.get(column);
      return position == null ? '' : fields[position];
    };

    const optionType = get('optionType').toLowerCase();
    if (optionType !== 'call' && optionType !== 'put') {
      throw new Error(`Invalid optionType in CSV row ${row}.`);
    }

    const base: Omit<OptionChainObservation, 'contentHash'> = {
      observedAt: parseDate(get('observedAt'), 'observedAt', row),
      expiry: parseDate(get('expiry'), 'expiry', row),
      source,
      underlyingSymbol: get('underlyingSymbol').trim().toUpperCase(),
      underlyingPrice: requiredNumber(get('underlyingPrice'), 'underlyingPrice', row),
      optionType,
      strike: requiredNumber(get('strike'), 'strike', row),
      bid: nonNegative(optionalNumber(get('bid'), 'bid', row), 'bid', row),
      ask: nonNegative(optionalNumber(get('ask'), 'ask', row), 'ask', row),
      last: nonNegative(optionalNumber(get('last'), 'last', row), 'last', row),
      impliedVolatility: nonNegative(
        optionalNumber(get('impliedVolatility'), 'impliedVolatility', row),
        'impliedVolatility',
        row
      ),
      openInterest: nonNegative(optionalNumber(get('openInterest'), 'openInterest', row), 'openInterest', row),
      volume: nonNegative(optionalNumber(get('volume'), 'volume', row), 'volume', row)
    };

    if (!base.underlyingSymbol) throw new Error(`Invalid underlyingSymbol in CSV row ${row}.`);
    if (base.underlyingPrice <= 0) throw new Error(`underlyingPrice must be positive in CSV row ${row}.`);
    if (base.strike <= 0) throw new Error(`strike must be positive in CSV row ${row}.`);
    if (base.ask != null && base.bid != null && base.ask < base.bid) {
      throw new Error(`ask must be greater than or equal to bid in CSV row ${row}.`);
    }
    if (new Date(base.expiry).getTime() <= new Date(base.observedAt).getTime()) {
      throw new Error(`expiry must be after observedAt in CSV row ${row}.`);
    }

    return { ...base, contentHash: hashObservation(base) };
  });

  observations.sort((left, right) =>
    left.observedAt.localeCompare(right.observedAt) ||
    left.expiry.localeCompare(right.expiry) ||
    left.optionType.localeCompare(right.optionType) ||
    left.strike - right.strike
  );

  const keys = new Set<string>();
  for (const observation of observations) {
    const key = [
      observation.source,
      observation.observedAt,
      observation.expiry,
      observation.underlyingSymbol,
      observation.optionType,
      observation.strike
    ].join('|');
    if (keys.has(key)) throw new Error('Duplicate option-chain contract observation.');
    keys.add(key);
  }

  return observations;
}
