import { NextRequest, NextResponse } from 'next/server';
import { isValidBearerToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeMarketSnapshotIngestBody } from '@/lib/market-snapshot-ingest';
import { persistMarketSnapshots } from '@/lib/market-snapshot-store';

export async function POST(request: NextRequest) {
  if (!isValidBearerToken(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const snapshots = normalizeMarketSnapshotIngestBody(body);
    const result = await persistMarketSnapshots(prisma, snapshots);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid market snapshot payload.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
