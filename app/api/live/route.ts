import { NextResponse } from 'next/server';
import packageJson from '@/package.json';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'alive',
    version: packageJson.version,
    timestamp: new Date().toISOString()
  }, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' }
  });
}
