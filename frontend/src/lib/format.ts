/** Display formatting helpers shared across pages. */

export function formatUsd(
  value: number,
  opts: { compact?: boolean; decimals?: number } = {},
): string {
  if (opts.compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  const digits = opts.decimals ?? 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPct(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
}

export function pctClass(value: number): string {
  if (value > 0) return 'pos';
  if (value < 0) return 'neg';
  return 'flat';
}

export const RISK_LABELS: Record<string, string> = {
  low: '低風險',
  medium: '中風險',
  high: '高風險',
  'very-high': '極高風險',
};

export const CATEGORY_LABELS: Record<string, string> = {
  'trend-following': '趨勢追蹤',
  momentum: '動能',
  'mean-reversion': '均值回歸',
  volatility: '波動度',
  diversified: '多元配置',
};

export const REBALANCE_LABELS: Record<string, string> = {
  daily: '每日',
  weekly: '每週',
  monthly: '每月',
  quarterly: '每季',
};
