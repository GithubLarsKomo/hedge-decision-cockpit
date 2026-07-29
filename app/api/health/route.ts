import { NextResponse } from 'next/server';
import packageJson from '@/package.json';
import { evaluateApplicationReadiness } from '@/lib/application-readiness';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  let databaseReachable = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseReachable = true;
  } catch (error) {
    console.error('Application health database check failed', error);
  }

  const readiness = evaluateApplicationReadiness({
    checkedAt: new Date().toISOString(),
    version: packageJson.version,
    checks: [{
      name: 'database',
      ok: databaseReachable,
      detail: databaseReachable ? 'Database connection available.' : 'Database connection unavailable.'
    }]
  });

  return NextResponse.json(readiness, {
    status: readiness.status === 'ready' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' }
  });
}
