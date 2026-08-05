export type StrategyTone = 'blue' | 'green' | 'yellow' | 'amber' | 'orange' | 'red';

export type StrategyToneStyle = {
  label: string;
  badgeClass: string;
  cardClass: string;
};

export const STRATEGY_TONE_ORDER: StrategyTone[] = [
  'blue',
  'green',
  'yellow',
  'amber',
  'orange',
  'red'
];

export const STRATEGY_TONE_STYLES: Record<StrategyTone, StrategyToneStyle> = {
  blue: {
    label: 'Blau',
    badgeClass: 'bg-blue-100 text-blue-800',
    cardClass: 'border-blue-500 bg-blue-50'
  },
  green: {
    label: 'Grün',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    cardClass: 'border-emerald-500 bg-emerald-50'
  },
  yellow: {
    label: 'Gelb',
    badgeClass: 'bg-yellow-100 text-yellow-800',
    cardClass: 'border-yellow-400 bg-yellow-50'
  },
  amber: {
    label: 'Amber',
    badgeClass: 'bg-amber-100 text-amber-800',
    cardClass: 'border-amber-500 bg-amber-50'
  },
  orange: {
    label: 'Orange',
    badgeClass: 'bg-orange-100 text-orange-800',
    cardClass: 'border-orange-500 bg-orange-50'
  },
  red: {
    label: 'Rot',
    badgeClass: 'bg-red-100 text-red-800',
    cardClass: 'border-red-500 bg-red-50'
  }
};

const ACTION_TONES: Record<string, StrategyTone> = {
  BUY_OR_ROLL_PUTS: 'blue',
  HOLD: 'green',
  DO_NOT_BUY_NEW_PUTS: 'green',
  HOLD_HEDGE: 'yellow',
  REALIZE_25_PERCENT: 'amber',
  REALIZE_35_PERCENT_MORE: 'orange',
  CLOSE_MOST_HEDGE_AND_BUY_EQUITIES: 'red'
};

export const VIX_EXPENSIVE_OVERLAY = {
  label: 'VIX teuer',
  badgeClass: 'bg-violet-100 text-violet-800',
  cardClass: 'border-violet-200 bg-violet-50 text-violet-900'
} as const;

export function strategyToneForAction(action: string): StrategyTone | null {
  return ACTION_TONES[action] ?? null;
}

export function strategyToneStyleForAction(action: string): StrategyToneStyle | null {
  const tone = strategyToneForAction(action);
  return tone ? STRATEGY_TONE_STYLES[tone] : null;
}

export function hasExpensiveVixOverlay(triggeredRules: readonly string[]): boolean {
  return triggeredRules.includes('VIX_EXPENSIVE');
}
