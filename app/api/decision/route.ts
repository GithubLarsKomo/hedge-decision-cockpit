import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isValidBearerToken } from '@/lib/auth';
import { decisionInputSchema } from '@/lib/decision-schema';
import { createRequestId } from '@/lib/request-id';

export async function POST(req: NextRequest) {
  const requestId = createRequestId();

  if (!isValidBearerToken(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = decisionInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten(), requestId },
      { status: 400 }
    );
  }

  const input = parsed.data;

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

    return NextResponse.json({ ok: true, id: decision.id, requestId }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Duplicate input', requestId }, { status: 409 });
    }

    console.error('decision ingest failed', { requestId, error });
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
