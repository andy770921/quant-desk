/**
 * Market-data types for the overview dashboard and price charts.
 */

export interface MarketIndexQuote {
  /** Internal series key, e.g. "GSPC". */
  symbol: string;
  /** Display name, e.g. "S&P 500". */
  name: string;
  /** Latest close (or yield for rate series). */
  last: number;
  /** Whether `last` is a percentage yield rather than a price level. */
  isYield: boolean;
  /** 1-day percentage change. */
  changePct1d: number;
  /** Year-to-date percentage change. */
  changePctYtd: number;
  /** Trailing 1-year percentage change. */
  changePct1y: number;
  /** ~30 recent monthly closes for a sparkline. */
  sparkline: number[];
}

export interface MarketOverview {
  asOf: string;
  quotes: MarketIndexQuote[];
}

export interface PricePoint {
  date: string;
  close: number;
}

export interface PriceSeries {
  symbol: string;
  name: string;
  firstDate: string;
  lastDate: string;
  /** Down-sampled points (monthly) for charting. */
  points: PricePoint[];
}
