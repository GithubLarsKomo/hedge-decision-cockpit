import { prisma } from '@/lib/prisma';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let decisions: Awaited<ReturnType<typeof prisma.decision.findMany>> = [];

  try {
    decisions = await prisma.decision.findMany({
      orderBy: { createdAt: 'desc' },
      take: 250
    });
  } catch (error) {
    console.error('Could not load decision history', error);
  }

  return <Dashboard decisions={decisions.map(d => ({
    id: d.id,
    createdAt: d.createdAt.toISOString(),
    ndxNow: d.ndxNow,
    ndxHigh2y: d.ndxHigh2y,
    ndxDrawdownPct: d.ndxDrawdownPct,
    vixNow: d.vixNow,
    vixPercentile: d.vixPercentile,
    action: d.action,
    severity: d.severity,
    recommendation: d.recommendation,
    hedgeMarketValueEur: d.hedgeMarketValueEur?.toNumber() ?? null,
    hedgeUnrealizedGainEur: d.hedgeUnrealizedGainEur?.toNumber() ?? null,
    notes: d.notes
  }))} />;
}
