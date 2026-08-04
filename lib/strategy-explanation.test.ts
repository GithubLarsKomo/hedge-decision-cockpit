import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { actionLabel, explainDecisionForBeginner } from './strategy-explanation';

describe('explainDecisionForBeginner', () => {
  it('explains the observed blue market setup and unknown hedge coverage', () => {
    const result = explainDecisionForBeginner({
      drawdownPercent: -6.144041538652212,
      vixPercentile: 22.6,
      hedgeCoveragePercent: null,
      action: 'BUY_OR_ROLL_PUTS'
    });

    assert.match(result.summary, /Markt ist nahe/);
    assert.ok(result.reasons.some(reason => reason.includes('6,1 %')));
    assert.ok(result.reasons.some(reason => reason.includes('22,6. Perzentil')));
    assert.match(result.coverageNote ?? '', /Hedge-Abdeckung ist unbekannt/);
  });

  it('explains that full target coverage means no hedge gap', () => {
    const result = explainDecisionForBeginner({
      drawdownPercent: -6.1,
      vixPercentile: 22.6,
      hedgeCoveragePercent: 100,
      action: 'HOLD'
    });

    assert.equal(result.coverageNote, null);
    assert.ok(result.reasons.some(reason => reason.includes('erreicht damit das konfigurierte Ziel')));
    assert.equal(result.summary, 'Keine Regel verlangt aktuell eine Änderung. Der bestehende Zustand wird beibehalten.');
  });

  it('provides beginner-friendly action labels', () => {
    assert.equal(actionLabel('BUY_OR_ROLL_PUTS'), 'Puts aufbauen oder rollen');
    assert.equal(actionLabel('HOLD'), 'Halten / nichts ändern');
  });
});
