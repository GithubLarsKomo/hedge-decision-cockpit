import { NextRequest, NextResponse } from 'next/server';
import { isValidBearerToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ingestRawMarketObservations } from '@/lib/raw-market-observation-ingest';

export async function POST(request: NextRequest) {
  if (!isValidBearerToken(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await ingestRawMarketObservations(prisma, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid raw market observation payload.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
