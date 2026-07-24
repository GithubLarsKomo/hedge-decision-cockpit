import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidBearerToken } from '@/lib/auth';
import { decisionInputSchema } from '@/lib/decision-schema';

export async function POST(req: NextRequest) {
  if (!isValidBearerToken(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = decisionInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const decision = await prisma.decision.create({
    data: {
      ndxNow: input.ndxNow,
      ndxHigh2y: input.ndxHigh2y,
      ndxDrawdownPct: input.drawdownPercent,
      vixNow: input.vixNow,
      vixPercentile: input.vixPercentile,
      action: input.action,
      severity: input.severity,
      recommendation: input.recommendation,
      hedgeMarketValueEur: input.hedgeMarketValueEur ?? null,
      hedgeUnrealizedGainEur: input.hedgeUnrealizedGainEur ?? null,
      notes: input.notes ?? null
    }
  });

  return NextResponse.json({ ok: true, id: decision.id });
}
