import { NextRequest, NextResponse } from 'next/server';
import { isValidBearerToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncFredMarketData } from '@/lib/fred-market-data';

export async function POST(request: NextRequest) {
  if (!isValidBearerToken(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const candidate = body as Record<string, unknown>;
    const result = await syncFredMarketData(prisma, {
      ...(typeof candidate.observationStart === 'string' ? { observationStart: candidate.observationStart } : {}),
      ...(typeof candidate.observationEnd === 'string' ? { observationEnd: candidate.observationEnd } : {})
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'FRED market-data sync failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
