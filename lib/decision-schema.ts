import { z } from 'zod';

const money = z.number().finite().nonnegative();

export const decisionInputSchema = z.object({
  observedAt: z.string().datetime().optional(),
  source: z.string().trim().min(1).max(120).optional(),
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  ndxNow: z.number().finite().positive(),
  ndxHigh2y: z.number().finite().positive(),
  drawdownPercent: z.number().finite().min(-100).max(100),
  vixNow: z.number().finite().nonnegative(),
  vixPercentile: z.number().finite().min(0).max(100),
  action: z.string().min(1).max(80),
  severity: z.enum(['green', 'blue', 'yellow', 'orange', 'red']),
  recommendation: z.string().trim().min(1).max(4000),
  ruleVersion: z.string().trim().min(1).max(30).default('1.0.0'),
  triggeredRules: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  portfolioMarketValueEur: money.optional().nullable(),
  hedgeMarketValueEur: money.optional().nullable(),
  hedgeUnrealizedGainEur: z.number().finite().optional().nullable(),
  hedgeCoveragePercent: z.number().finite().min(0).max(1000).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  portfolioSnapshot: z.object({
    marketValueEur: money,
    targetHedgePercent: z.number().finite().min(0).max(1000).optional().nullable()
  }).optional(),
  hedgePositionSnapshot: z.object({
    underlying: z.string().trim().min(1).max(40),
    instrumentDescription: z.string().trim().max(255).optional().nullable(),
    quantity: z.number().finite().optional().nullable(),
    strike: z.number().finite().nonnegative().optional().nullable(),
    expiry: z.string().datetime().optional().nullable(),
    marketValueEur: money.optional().nullable(),
    unrealizedGainEur: z.number().finite().optional().nullable()
  }).optional()
});

export type DecisionInput = z.infer<typeof decisionInputSchema>;
