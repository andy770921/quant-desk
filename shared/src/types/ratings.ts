/**
 * Single source of truth for the quantitative thresholds used to grade
 * strategies and metrics. Both the backend (deriving `riskLevel`) and the
 * frontend (rating badges + the 說明/Guide page) import from here so the
 * displayed thresholds can never drift from the logic.
 */
import type { RiskLevel } from './strategy';

export type RatingTone = 'pos' | 'flat' | 'warn' | 'neg';

export interface RatingBand {
  /** Upper bound (exclusive) of the band; the final band uses Infinity. */
  max: number;
  label: string;
  tone: RatingTone;
}

export interface Rating {
  label: string;
  tone: RatingTone;
}

function classify(bands: RatingBand[], value: number): Rating {
  const b = bands.find((x) => value < x.max) ?? bands[bands.length - 1];
  return { label: b.label, tone: b.tone };
}

// --- Risk level (derived from annualized volatility, which already reflects leverage) ---
export const RISK_VOL_BANDS: { max: number; level: RiskLevel; label: string; tone: RatingTone }[] =
  [
    { max: 10, level: 'low', label: '低風險', tone: 'pos' },
    { max: 20, level: 'medium', label: '中風險', tone: 'flat' },
    { max: 35, level: 'high', label: '高風險', tone: 'warn' },
    { max: Infinity, level: 'very-high', label: '極高風險', tone: 'neg' },
  ];

export function classifyRiskLevel(annualVolPct: number): RiskLevel {
  const b =
    RISK_VOL_BANDS.find((x) => annualVolPct < x.max) ?? RISK_VOL_BANDS[RISK_VOL_BANDS.length - 1];
  return b.level;
}

// --- Sharpe ratio quality ---
export const SHARPE_BANDS: RatingBand[] = [
  { max: 0, label: '不佳', tone: 'neg' },
  { max: 0.5, label: '偏弱', tone: 'flat' },
  { max: 1, label: '尚可', tone: 'flat' },
  { max: 2, label: '良好', tone: 'pos' },
  { max: Infinity, label: '優秀', tone: 'pos' },
];
export const rateSharpe = (sharpe: number): Rating => classify(SHARPE_BANDS, sharpe);

// --- Max drawdown severity (positive %) ---
export const DRAWDOWN_BANDS: RatingBand[] = [
  { max: 15, label: '輕微', tone: 'pos' },
  { max: 30, label: '中等', tone: 'flat' },
  { max: 50, label: '嚴重', tone: 'warn' },
  { max: Infinity, label: '極嚴重', tone: 'neg' },
];
export const rateDrawdown = (drawdownPct: number): Rating => classify(DRAWDOWN_BANDS, drawdownPct);

// --- Annualized volatility band (same thresholds as risk level) ---
export const VOLATILITY_BANDS: RatingBand[] = [
  { max: 10, label: '低', tone: 'pos' },
  { max: 20, label: '中', tone: 'flat' },
  { max: 35, label: '高', tone: 'warn' },
  { max: Infinity, label: '極高', tone: 'neg' },
];
export const rateVolatility = (volPct: number): Rating => classify(VOLATILITY_BANDS, volPct);

// --- Annualized return band (context only) ---
export const RETURN_BANDS: RatingBand[] = [
  { max: 0, label: '虧損', tone: 'neg' },
  { max: 6, label: '偏低', tone: 'flat' },
  { max: 12, label: '穩健', tone: 'flat' },
  { max: 20, label: '優異', tone: 'pos' },
  { max: Infinity, label: '極高', tone: 'pos' },
];
export const rateReturn = (pct: number): Rating => classify(RETURN_BANDS, pct);
