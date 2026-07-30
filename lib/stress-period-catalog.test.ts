import assert from 'node:assert/strict';
import test from 'node:test';

import { assessStressPeriodCoverage, STRESS_PERIODS } from './stress-period-catalog';

test('catalog contains the required historical stress periods in chronological order', () => {
  assert.deepEqual(
    STRESS_PERIODS.map(period => period.id),
    ['dot-com-bust', 'global-financial-crisis', 'covid-crash', 'inflation-shock-2022']
  );

  for (let index = 1; index < STRESS_PERIODS.length; index += 1) {
    assert.ok(STRESS_PERIODS[index - 1].endsOn < STRESS_PERIODS[index].startsOn);
  }
});

test('reports complete coverage for a dataset spanning all catalog periods', () => {
  const result = assessStressPeriodCoverage({
    firstObservationAt: '1999-01-01T00:00:00.000Z',
    lastObservationAt: '2023-01-31T00:00:00.000Z'
  });

  assert.equal(result.every(period => period.covered), true);
  assert.equal(result.every(period => period.missingBeforeDays === 0), true);
  assert.equal(result.every(period => period.missingAfterDays === 0), true);
});

test('reports missing leading and trailing days for partial coverage', () => {
  const [result] = assessStressPeriodCoverage(
    {
      firstObservationAt: '2020-02-21T00:00:00.000Z',
      lastObservationAt: '2020-04-28T23:59:59.999Z'
    },
    [STRESS_PERIODS[2]]
  );

  assert.equal(result.covered, false);
  assert.equal(result.missingBeforeDays, 2);
  assert.equal(result.missingAfterDays, 2);
});

test('rejects invalid dataset ranges and malformed period definitions', () => {
  assert.throws(
    () => assessStressPeriodCoverage({
      firstObservationAt: '2022-01-02T00:00:00.000Z',
      lastObservationAt: '2022-01-01T00:00:00.000Z'
    }),
    /lastObservationAt/
  );

  assert.throws(
    () => assessStressPeriodCoverage(
      {
        firstObservationAt: '2020-01-01T00:00:00.000Z',
        lastObservationAt: '2021-01-01T00:00:00.000Z'
      },
      [
        {
          id: 'covid-crash',
          label: 'Invalid',
          startsOn: '2020-05-01T00:00:00.000Z',
          endsOn: '2020-04-01T00:00:00.000Z'
        }
      ]
    ),
    /ends before it starts/
  );
});
