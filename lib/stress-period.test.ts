import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeStressPeriods } from './stress-period';

test('summarizes an empty period', () => {
  const result = summarizeStressPeriods([], [{
    id: 'sample',
    label: 'Sample',
    startsAt: '2020-01-01',
    endsAt: '2020-12-31'
  }]);
  assert.equal(result[0].observationCount, 0);
  assert.equal(result[0].minimumNdxClose, null);
});
