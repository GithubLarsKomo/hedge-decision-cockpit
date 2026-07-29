export type TimestampedQuote = {
  symbol: string;
  quotedAt: string;
};

export type QuoteFreshnessConfig = {
  maximumAgeSeconds: number;
  maximumFutureSkewSeconds?: number;
};

export type FreshQuote<T extends TimestampedQuote> = T & {
  ageSeconds: number;
};

function parseTimestamp(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${field} must be a valid ISO timestamp.`);
  return parsed;
}

function requireNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer.`);
  }
}

export function filterFreshQuotes<T extends TimestampedQuote>(
  observedAt: string,
  quotes: T[],
  config: QuoteFreshnessConfig
): FreshQuote<T>[] {
  const observation = parseTimestamp(observedAt, 'observedAt');
  requireNonNegativeInteger(config.maximumAgeSeconds, 'maximumAgeSeconds');
  const maximumFutureSkewSeconds = config.maximumFutureSkewSeconds ?? 0;
  requireNonNegativeInteger(maximumFutureSkewSeconds, 'maximumFutureSkewSeconds');

  return quotes
    .map(quote => {
      const quotedAt = parseTimestamp(quote.quotedAt, 'quotedAt');
      const ageSeconds = (observation.getTime() - quotedAt.getTime()) / 1000;
      return { ...quote, quotedAt: quotedAt.toISOString(), ageSeconds };
    })
    .filter(quote => quote.ageSeconds <= config.maximumAgeSeconds && quote.ageSeconds >= -maximumFutureSkewSeconds)
    .sort((left, right) => left.ageSeconds - right.ageSeconds || left.symbol.localeCompare(right.symbol));
}
