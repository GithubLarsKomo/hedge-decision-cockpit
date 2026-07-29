export type ExpiryCandidate = { expiry: string };

export type ExpirySelectionConfig = {
  targetDaysToExpiry: number;
  minimumDaysToExpiry: number;
  maximumDaysToExpiry: number;
};

export type SelectedExpiry = {
  expiry: string;
  daysToExpiry: number;
  distanceFromTarget: number;
};

const DAY_MS = 86_400_000;

function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} must be a valid ISO timestamp.`);
  return date;
}

function requireDays(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer.`);
}

export function selectExpiry(observedAt: string, candidates: ExpiryCandidate[], config: ExpirySelectionConfig): SelectedExpiry {
  const observation = parseDate(observedAt, 'observedAt');
  requireDays(config.targetDaysToExpiry, 'targetDaysToExpiry');
  requireDays(config.minimumDaysToExpiry, 'minimumDaysToExpiry');
  requireDays(config.maximumDaysToExpiry, 'maximumDaysToExpiry');
  if (config.minimumDaysToExpiry > config.maximumDaysToExpiry) {
    throw new Error('minimumDaysToExpiry cannot exceed maximumDaysToExpiry.');
  }

  const eligible = candidates.map(candidate => {
    const expiry = parseDate(candidate.expiry, 'expiry');
    const daysToExpiry = Math.ceil((expiry.getTime() - observation.getTime()) / DAY_MS);
    return {
      expiry: expiry.toISOString(),
      daysToExpiry,
      distanceFromTarget: Math.abs(daysToExpiry - config.targetDaysToExpiry)
    };
  }).filter(candidate => candidate.daysToExpiry >= config.minimumDaysToExpiry && candidate.daysToExpiry <= config.maximumDaysToExpiry);

  if (eligible.length === 0) throw new Error('No eligible expiry candidate is available.');
  return eligible.sort((left, right) => left.distanceFromTarget - right.distanceFromTarget || left.daysToExpiry - right.daysToExpiry || left.expiry.localeCompare(right.expiry))[0];
}
