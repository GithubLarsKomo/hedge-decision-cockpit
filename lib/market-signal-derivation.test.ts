import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveHedgeSignalsFromHistory,
  deriveHedgeSignalsFromStore,
  marketSignalWindowStart,
  MIN_NDX_HISTORY_OBSERVATIONS,
  MIN_VIX_HISTORY_OBSERVATIONS
} from './market-signal-derivation';

function dailyHistory(
  count = 400,
  end = new Date('2026-08-03T00:00:00.000Z'),
  map?: (index: number) => { ndxClose?: number; vixClose?: number | null }
) {
  return Array.from({ length: count }, (_, index) => {
    const observedAt = new Date(end.getTime() - (count - 1 - index) * 86_400_000);
    const values = map?.(index) ?? {};
    return {
      observedAt,
      ndxClose: values.ndxClose ?? 100,
      vixClose: values.vixClose === undefined ? 20 : values.vixClose
    };
  });
}

test('derives the NDX reference high and drawdown from the trailing two-year window', () => {
  const end = new Date('2026-08-03T00:00:00.000Z');
  const history = dailyHistory(400, end, index => ({
    ndxClose: index === 250 ? 120 : index === 399 ? 90 : 100,
    vixClose: 20
  }));
  history.unshift({ observedAt: new Date('2024-08-02T23:59:59.000Z'), ndxClose: 999, vixClose: 20 });

  const result = deriveHedgeSignalsFromHistory(history, { asOf: end });
  assert.equal(result.ndxReferenceHigh, 120);
  assert.equal(result.ndxNow, 90);
  assert.ok(Math.abs(result.drawdownPercent - (-25)) < 1e-12);
  assert.equal(result.ndxObservationCount, 400);
});

test('uses the existing <= rank semantics for VIX percentile including ties', () => {
  const history = dailyHistory(400, undefined, index => {
    if (index < 100) return { vixClose: 10 };
    if (index < 199) return { vixClose: 20 };
    if (index < 399) return { vixClose: 30 };
    return { vixClose: 20 };
  });

  const result = deriveHedgeSignalsFromHistory(history);
  assert.equal(result.vixObservationCount, 400);
  assert.equal(result.vixNow, 20);
  assert.equal(result.vixPercentile, 50);
  assert.equal(result.decisionInput.vixPercentile, 50);
});

test('requires the historical minimums used by the existing n8n workflow', () => {
  assert.throws(
    () => deriveHedgeSignalsFromHistory(dailyHistory(MIN_NDX_HISTORY_OBSERVATIONS - 1)),
    /Insufficient NDX market history/
  );

  const tooFewVix = dailyHistory(MIN_NDX_HISTORY_OBSERVATIONS, undefined, index => ({
    vixClose: index < MIN_VIX_HISTORY_OBSERVATIONS - 1 ? 20 : null
  }));
  assert.throws(() => deriveHedgeSignalsFromHistory(tooFewVix), /Insufficient VIX market history/);
});

test('requires a VIX close on the selected current observation', () => {
  const history = dailyHistory(400, undefined, index => ({ vixClose: index === 399 ? null : 20 }));
  assert.throws(() => deriveHedgeSignalsFromHistory(history), /has no VIX close/);
});

test('computes a calendar two-year UTC lookback boundary', () => {
  assert.equal(
    marketSignalWindowStart('2026-08-03T15:30:00.000Z').toISOString(),
    '2024-08-03T15:30:00.000Z'
  );
});

test('loads one source in chronological order and derives the latest stored signal', async () => {
  const latest = new Date('2026-08-03T00:00:00.000Z');
  const history = dailyHistory(400, latest);
  let findManyArgs: unknown;

  const result = await deriveHedgeSignalsFromStore({
    marketSnapshot: {
      async findFirst(args) {
        assert.deepEqual(args, {
          where: { source: 'nasdaq+fred' },
          orderBy: { observedAt: 'desc' },
          select: { observedAt: true }
        });
        return { observedAt: latest };
      },
      async findMany(args) {
        findManyArgs = args;
        return history.map(row => ({
          observedAt: row.observedAt,
          ndxClose: row.ndxClose,
          vixClose: row.vixClose
        }));
      }
    }
  }, { source: 'nasdaq+fred', hedgeCoveragePercent: 75 });

  assert.deepEqual(findManyArgs, {
    where: {
      source: 'nasdaq+fred',
      observedAt: {
        gte: new Date('2024-08-03T00:00:00.000Z'),
        lte: latest
      }
    },
    orderBy: { observedAt: 'asc' },
    select: { observedAt: true, ndxClose: true, vixClose: true }
  });
  assert.equal(result.observedAt, latest.toISOString());
  assert.equal(result.decisionInput.hedgeCoveragePercent, 75);
});
