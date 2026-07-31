import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);

export const executionAuditInputSchema = z.object({
  recommendationId: nonEmptyString,
  recommendedStrategy: nonEmptyString,
  recommendedContracts: z.number().int().nonnegative(),
  decidedAt: z.string().datetime(),
  approval: z.object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    actorId: nonEmptyString,
    recordedAt: z.string().datetime(),
    reason: z.string().optional()
  }),
  execution: z.object({
    status: z.enum(['NOT_EXECUTED', 'PARTIALLY_EXECUTED', 'EXECUTED']),
    actorId: z.string().optional(),
    recordedAt: z.string().datetime().optional(),
    executedStrategy: z.string().optional(),
    executedContracts: z.number().int().nonnegative().optional(),
    averagePrice: z.number().nonnegative().finite().optional(),
    deviationReason: z.string().optional()
  })
});

export type ExecutionAuditRequest = z.infer<typeof executionAuditInputSchema>;
