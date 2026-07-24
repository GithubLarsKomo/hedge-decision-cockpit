import { z } from 'zod';

export const decisionInputSchema = z.object({
  ndxNow: z.number().finite(),
  ndxHigh2y: z.number().finite().positive(),
  drawdownPercent: z.number().finite(),
  vixNow: z.number().finite().nonnegative(),
  vixPercentile: z.number().finite().min(0).max(100),
  action: z.string().min(1).max(80),
  severity: z.enum(['green', 'blue', 'yellow', 'orange', 'red']),
  recommendation: z.string().min(1),
  hedgeMarketValueEur: z.number().finite().optional().nullable(),
  hedgeUnrealizedGainEur: z.number().finite().optional().nullable(),
  notes: z.string().optional().nullable()
});

export type DecisionInput = z.infer<typeof decisionInputSchema>;
