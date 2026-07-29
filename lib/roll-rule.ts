export type RollRule =
  | { kind: 'scheduled'; rollWhenDaysToExpiryAtOrBelow: number }
  | { kind: 'drawdown'; rollWhenDrawdownPercentAtOrBelow: number }
  | {
      kind: 'combined';
      rollWhenDaysToExpiryAtOrBelow: number;
      rollWhenDrawdownPercentAtOrBelow: number;
    };

export type RollDecision = {
  shouldRoll: boolean;
  reasons: string[];
};

function requireDays(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer.`);
}

export function evaluateRollRule(daysToExpiry: number, drawdownPercent: number, rule: RollRule): RollDecision {
  requireDays(daysToExpiry, 'daysToExpiry');
  if (!Number.isFinite(drawdownPercent) || drawdownPercent > 0) {
    throw new Error('drawdownPercent must be finite and at or below zero.');
  }

  const reasons: string[] = [];
  if (rule.kind === 'scheduled' || rule.kind === 'combined') {
    requireDays(rule.rollWhenDaysToExpiryAtOrBelow, 'rollWhenDaysToExpiryAtOrBelow');
    if (daysToExpiry <= rule.rollWhenDaysToExpiryAtOrBelow) reasons.push('scheduled-expiry-threshold');
  }
  if (rule.kind === 'drawdown' || rule.kind === 'combined') {
    if (!Number.isFinite(rule.rollWhenDrawdownPercentAtOrBelow) || rule.rollWhenDrawdownPercentAtOrBelow > 0) {
      throw new Error('rollWhenDrawdownPercentAtOrBelow must be finite and at or below zero.');
    }
    if (drawdownPercent <= rule.rollWhenDrawdownPercentAtOrBelow) reasons.push('drawdown-threshold');
  }

  return { shouldRoll: reasons.length > 0, reasons };
}
