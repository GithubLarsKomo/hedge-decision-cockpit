import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { optionPositionMarketValueEur, priceEuropeanOption } from './option-pricing';

describe('priceEuropeanOption', () => {
  it('erfüllt näherungsweise die Put-Call-Parität', () => {
    const common = {
      spot: 100,
      strike: 100,
      timeToExpiryYears: 1,
      volatility: 0.2,
      riskFreeRate: 0.05,
      dividendYield: 0.01
    };
    const call = priceEuropeanOption({ ...common, type: 'call' });
    const put = priceEuropeanOption({ ...common, type: 'put' });
    const parityRight = common.spot * Math.exp(-common.dividendYield)
      - common.strike * Math.exp(-common.riskFreeRate);
    assert.ok(Math.abs((call.price - put.price) - parityRight) < 0.02);
  });

  it('bewertet eine Option am Verfall zum inneren Wert', () => {
    const put = priceEuropeanOption({
      type: 'put', spot: 80, strike: 100, timeToExpiryYears: 0,
      volatility: 0.3, riskFreeRate: 0
    });
    assert.equal(put.price, 20);
    assert.equal(put.intrinsicValue, 20);
    assert.equal(put.timeValue, 0);
  });

  it('liefert für einen Put ein negatives Delta', () => {
    const result = priceEuropeanOption({
      type: 'put', spot: 100, strike: 95, timeToExpiryYears: 0.5,
      volatility: 0.25, riskFreeRate: 0.03
    });
    assert.ok(result.price > 0);
    assert.ok(result.delta < 0 && result.delta > -1);
    assert.ok(result.gamma > 0);
    assert.ok(result.vega > 0);
  });

  it('berechnet den Positionswert in Euro', () => {
    assert.equal(optionPositionMarketValueEur({
      optionPrice: 12.5,
      contracts: 4,
      contractMultiplier: 100,
      fxRateToEur: 0.92
    }), 4600);
  });

  it('weist ungültige Eingaben zurück', () => {
    assert.throws(() => priceEuropeanOption({
      type: 'put', spot: 0, strike: 100, timeToExpiryYears: 1,
      volatility: 0.2, riskFreeRate: 0
    }));
  });
});
