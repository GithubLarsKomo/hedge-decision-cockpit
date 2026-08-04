import { NextRequest, NextResponse } from 'next/server';
import { isValidBearerToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncFredMarketData } from '@/lib/fred-market-data';
import { InvalidFredSyncPayloadError, parseFredSyncRequestBody } from '@/lib/fred-sync-request';

export async function POST(request: NextRequest) {
  if (!isValidBearerToken(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = parseFredSyncRequestBody(await request.text());
  } catch (error) {
    if (error instanceof InvalidFredSyncPayloadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  try {
    const result = await syncFredMarketData(prisma, body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'FRED market-data sync failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
