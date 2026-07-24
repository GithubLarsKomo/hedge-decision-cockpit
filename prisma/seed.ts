import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const samples = [
    { dd: -4.2, vix: 13.9, pct: 18, action: 'BUY_OR_ROLL_PUTS', severity: 'blue' },
    { dd: -12.5, vix: 18.2, pct: 55, action: 'HOLD', severity: 'green' },
    { dd: -21.1, vix: 26.7, pct: 82, action: 'HOLD_HEDGE', severity: 'yellow' },
    { dd: -31.3, vix: 35.4, pct: 94, action: 'REALIZE_25_PERCENT', severity: 'yellow' }
  ];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    await prisma.decision.create({
      data: {
        createdAt: new Date(now.getTime() - (samples.length - i) * 86400000),
        ndxNow: 21000 * (1 + s.dd / 100),
        ndxHigh2y: 21000,
        ndxDrawdownPct: s.dd,
        vixNow: s.vix,
        vixPercentile: s.pct,
        action: s.action,
        severity: s.severity,
        recommendation: `Sample signal: ${s.action}`
      }
    });
  }
}

main().finally(() => prisma.$disconnect());
