import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { decisionInputSchema, type DecisionInput } from './decision-schema';

export class DecisionConflictError extends Error {
  constructor(message = 'Duplicate input') {
    super(message);
    this.name = 'DecisionConflictError';
  }
}

export async function persistDecision(value: unknown): Promise<{ id: number; input: DecisionInput }> {
  const input = decisionInputSchema.parse(value);

  try {
    const decision = await prisma.decision.create({
      data: {
        observedAt: input.observedAt ? new Date(input.observedAt) : null,
        source: input.source ?? null,
        inputFingerprint: input.inputFingerprint ?? null,
        ruleVersion: input.ruleVersion,
        triggeredRulesJson: input.triggeredRules,
        ndxNow: input.ndxNow,
        ndxHigh2y: input.ndxHigh2y,
        ndxDrawdownPct: input.drawdownPercent,
        vixNow: input.vixNow,
        vixPercentile: input.vixPercentile,
        action: input.action,
        severity: input.severity,
        recommendation: input.recommendation,
        portfolioMarketValueEur: input.portfolioMarketValueEur ?? null,
        hedgeMarketValueEur: input.hedgeMarketValueEur ?? null,
        hedgeUnrealizedGainEur: input.hedgeUnrealizedGainEur ?? null,
        hedgeCoveragePercent: input.hedgeCoveragePercent ?? null,
        notes: input.notes ?? null,
        portfolioSnapshot: input.portfolioSnapshot ? {
          create: {
            marketValueEur: input.portfolioSnapshot.marketValueEur,
            targetHedgePercent: input.portfolioSnapshot.targetHedgePercent ?? null
          }
        } : undefined,
        hedgePositionSnapshot: input.hedgePositionSnapshot ? {
          create: {
            underlying: input.hedgePositionSnapshot.underlying,
            instrumentDescription: input.hedgePositionSnapshot.instrumentDescription ?? null,
            quantity: input.hedgePositionSnapshot.quantity ?? null,
            strike: input.hedgePositionSnapshot.strike ?? null,
            expiry: input.hedgePositionSnapshot.expiry ? new Date(input.hedgePositionSnapshot.expiry) : null,
            marketValueEur: input.hedgePositionSnapshot.marketValueEur ?? null,
            unrealizedGainEur: input.hedgePositionSnapshot.unrealizedGainEur ?? null
          }
        } : undefined
      }
    });

    return { id: decision.id, input };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new DecisionConflictError();
    }
    throw error;
  }
}
