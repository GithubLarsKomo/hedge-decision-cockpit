import { prisma } from '@/lib/prisma';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const decisions = await prisma.decision.findMany({
    orderBy: { createdAt: 'desc' },
    take: 250
  });

  return <Dashboard decisions={decisions.map(d => ({
    ...d,
    createdAt: d.createdAt.toISOString()
  }))} />;
}
