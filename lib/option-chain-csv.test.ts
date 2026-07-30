import assert from 'node:assert/strict';
import test from 'node:test';
import { importOptionChainCsv } from './option-chain-csv';

test('imports, normalizes and sorts option-chain observations', () => {
  const csv = [
    'observedAt,expiry,underlyingSymbol,underlyingPrice,optionType,strike,bid,ask,last,impliedVolatility,openInterest,volume',
    '2020-03-20T15:30:00Z,2020-06-19,ndx,6994.29,PUT,6500,250.5,255.0,253.2,0.42,1200,45',
    '2020-03-20T15:30:00Z,2020-06-19,ndx,6994.29,put,6000,150.5,155.0,,0.38,900,30'
  ].join('\n');

  const observations = importOptionChainCsv(csv, { source: 'stress-fixture' });
  assert.equal(observations.length, 2);
  assert.equal(observations[0].strike, 6000);
  assert.equal(observations[1].underlyingSymbol, 'NDX');
  assert.equal(observations[1].expiry, '2020-06-19T00:00:00.000Z');
  assert.match(observations[1].contentHash, /^[a-f0-9]{64}$/);
});

test('supports semicolon-separated files and optional quote fields', () => {
  const csv = [
    'observedAt;expiry;underlyingSymbol;underlyingPrice;optionType;strike;bid;ask',
    '"2022-01-03T16:00:00Z";"2022-03-18";NDX;16501.77;call;17000;120;125'
  ].join('\n');

  const observations = importOptionChainCsv(csv, { source: 'vendor;export', delimiter: ';' });
  assert.equal(observations[0].optionType, 'call');
  assert.equal(observations[0].last, null);
});

test('rejects malformed economics and contract identity', () => {
  const header = 'observedAt,expiry,underlyingSymbol,underlyingPrice,optionType,strike,bid,ask';
  assert.throws(
    () => importOptionChainCsv(`${header}\n2020-01-01,2020-02-01,NDX,100,put,90,12,10`, { source: 'x' }),
    /ask must be greater/
  );
  assert.throws(
    () => importOptionChainCsv(`${header}\n2020-01-01,2019-12-01,NDX,100,put,90,10,12`, { source: 'x' }),
    /expiry must be after/
  );
  assert.throws(
    () => importOptionChainCsv(`${header}\n2020-01-01,2020-02-01,NDX,100,future,90,10,12`, { source: 'x' }),
    /Invalid optionType/
  );
});

test('rejects duplicate contract observations', () => {
  const csv = [
    'observedAt,expiry,underlyingSymbol,underlyingPrice,optionType,strike',
    '2020-01-01,2020-02-01,NDX,100,put,90',
    '2020-01-01,2020-02-01,NDX,100,put,90'
  ].join('\n');
  assert.throws(() => importOptionChainCsv(csv, { source: 'duplicate' }), /Duplicate option-chain/);
});
