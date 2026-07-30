export type ExpirySelectionRule = {
  targetDaysToExpiry: number;
  minimumDaysToExpiry: number;
  maximumDaysToExpiry: number;
};

export type ExpiryCandidate = { expiry: string };

const DAY_MS = 86_400_000;

function timestamp(value: string, field: string): number {
  const result = new Date(value).getTime();
  if (Number.isNaN(result)) throw new Error(`Invalid ${field}.`);
  return result;
}

function nonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer.`);
}

export function daysUntil(expiry: string, observedAt: string): number {
  return Math.ceil((timestamp(expiry, 'expiry') - timestamp(observedAt, 'observedAt')) / DAY_MS);
}

export function selectExpiry(
  candidates: readonly ExpiryCandidate[],
  observedAt: string,
  rule: ExpirySelectionRule
): ExpiryCandidate {
  nonNegativeInteger(rule.targetDaysToExpiry, 'targetDaysToExpiry');
  nonNegativeInteger(rule.minimumDaysToExpiry, 'minimumDaysToExpiry');
  nonNegativeInteger(rule.maximumDaysToExpiry, 'maximumDaysToExpiry');
  if (rule.minimumDaysToExpiry > rule.maximumDaysToExpiry) {
    throw new Error('minimumDaysToExpiry must not exceed maximumDaysToExpiry.');
  }
  if (rule.targetDaysToExpiry < rule.minimumDaysToExpiry || rule.targetDaysToExpiry > rule.maximumDaysToExpiry) {
    throw new Error('targetDaysToExpiry must be inside the allowed expiry range.');
  }

  const eligible = candidates
    .map(candidate => ({ candidate, dte: daysUntil(candidate.expiry, observedAt) }))
    .filter(item => item.dte >= rule.minimumDaysToExpiry && item.dte <= rule.maximumDaysToExpiry)
    .sort((left, right) => {
      const difference = Math.abs(left.dte - rule.targetDaysToExpiry) - Math.abs(right.dte - rule.targetDaysToExpiry);
      return difference || timestamp(left.candidate.expiry, 'expiry') - timestamp(right.candidate.expiry, 'expiry');
    });

  if (eligible.length === 0) throw new Error('No eligible expiry candidate.');
  return eligible[0].candidate;
}

export type RollRule = {
  rollAtOrBelowDaysToExpiry?: number;
  maximumHoldingDays?: number;
};

export type RollDecision = {
  shouldRoll: boolean;
  reason: 'none' | 'expiry-threshold' | 'maximum-holding-period';
  daysToExpiry: number;
  holdingDays: number | null;
};

export function evaluateRoll(
  observedAt: string,
  currentExpiry: string,
  rule: RollRule,
  openedAt?: string
): RollDecision {
  const observed = timestamp(observedAt, 'observedAt');
  const daysToExpiry = daysUntil(currentExpiry, observedAt);
  let holdingDays: number | null = null;

  if (openedAt) {
    const opened = timestamp(openedAt, 'openedAt');
    if (opened > observed) throw new Error('openedAt must not be after observedAt.');
    holdingDays = Math.floor((observed - opened) / DAY_MS);
  }

  if (rule.rollAtOrBelowDaysToExpiry != null) {
    nonNegativeInteger(rule.rollAtOrBelowDaysToExpiry, 'rollAtOrBelowDaysToExpiry');
    if (daysToExpiry <= rule.rollAtOrBelowDaysToExpiry) {
      return { shouldRoll: true, reason: 'expiry-threshold', daysToExpiry, holdingDays };
    }
  }

  if (rule.maximumHoldingDays != null) {
    nonNegativeInteger(rule.maximumHoldingDays, 'maximumHoldingDays');
    if (holdingDays == null) throw new Error('openedAt is required when maximumHoldingDays is configured.');
    if (holdingDays >= rule.maximumHoldingDays) {
      return { shouldRoll: true, reason: 'maximum-holding-period', daysToExpiry, holdingDays };
    }
  }

  return { shouldRoll: false, reason: 'none', daysToExpiry, holdingDays };
}
