import { z } from 'zod';
import {
  computePortfolioSnapshotFingerprint,
  portfolioSnapshotPayloadSchema,
  type PortfolioSnapshot,
  validatePortfolioSnapshot
} from './portfolio-snapshot';

export const monthlyPortfolioInputSchema = portfolioSnapshotPayloadSchema.extend({
  input_fingerprint: z.never().optional()
}).strict();

export type MonthlyPortfolioInput = z.infer<typeof monthlyPortfolioInputSchema>;

export function generatePortfolioSnapshot(input: unknown): PortfolioSnapshot {
  const payload = monthlyPortfolioInputSchema.parse(input);
  const inputFingerprint = computePortfolioSnapshotFingerprint(payload);
  return validatePortfolioSnapshot({ ...payload, input_fingerprint: inputFingerprint });
}
