export function computeDrawdownPercent(current: number, referenceHigh: number): number {
  if (!Number.isFinite(current) || current <= 0) throw new Error('current must be positive and finite.');
  if (!Number.isFinite(referenceHigh) || referenceHigh <= 0) throw new Error('referenceHigh must be positive and finite.');
  return ((current / referenceHigh) - 1) * 100;
}
