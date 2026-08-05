import {
  STRATEGY_TONE_ORDER,
  STRATEGY_TONE_STYLES,
  VIX_EXPENSIVE_OVERLAY,
  type StrategyTone
} from './strategy-presentation';

const captions: Record<StrategyTone, string> = {
  blue: 'Aufbau',
  green: 'Keine Änderung',
  yellow: 'Hedge halten',
  amber: '1. Realisierung',
  orange: '2. Realisierung',
  red: 'Großteil monetarisieren'
};

export default function StrategyColorLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex flex-wrap items-center gap-2">
        {STRATEGY_TONE_ORDER.map((tone, index) => {
          const style = STRATEGY_TONE_STYLES[tone];
          return (
            <div key={tone} className="flex items-center gap-2">
              {index > 0 && <span className="text-xs text-slate-400">→</span>}
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${style.badgeClass}`}>
                {style.label}
              </span>
              {!compact && <span className="text-xs text-slate-600">{captions[tone]}</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span className={`rounded-full px-3 py-1 font-semibold uppercase tracking-wide ${VIX_EXPENSIVE_OVERLAY.badgeClass}`}>
          {VIX_EXPENSIVE_OVERLAY.label}
        </span>
        <span>ist ein separates Volatilitäts-Overlay und keine zusätzliche Drawdown-Stufe.</span>
      </div>
    </div>
  );
}
