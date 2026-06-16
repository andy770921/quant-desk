/**
 * Logical assets used by the strategies & backtest engine.
 *
 * A logical asset is a continuous daily total-return-style index built from one
 * or more raw Yahoo series (see scripts/fetch-market-data.mjs). The composition
 * layer (MarketDataService) handles splicing shorter ETF histories onto longer
 * index histories and synthesizing bond / cash returns from Treasury yields so
 * that equity + bond + cash strategies can be backtested all the way to 1990.
 */

export const ASSET = {
  USLC: 'USLC', // US large cap (S&P 500 total return)
  NASDAQ: 'NASDAQ', // Nasdaq-100 price index
  SMALL: 'SMALL', // US small cap (Russell 2000)
  INTL: 'INTL', // Developed international (EAFE)
  CASH: 'CASH', // T-bills (synth from 13-week yield)
  ITT: 'ITT', // Intermediate Treasuries (synth, ~7.5y duration)
  LTT: 'LTT', // Long Treasuries (synth, ~17y duration)
  GOLD: 'GOLD', // Gold (GLD spliced with gold futures)
  // Leveraged daily-reset ETFs (synthesized) — held with cash, NO borrowing.
  NASDAQ3X: 'NASDAQ3X', // 3x Nasdaq-100 (TQQQ-like)
  NASDAQ2X: 'NASDAQ2X', // 2x Nasdaq-100 (QLD-like)
  USLC3X: 'USLC3X', // 3x S&P 500 (UPRO/SPXL-like)
  USLC2X: 'USLC2X', // 2x S&P 500 (SSO-like)
  LTT3X: 'LTT3X', // 3x 20Y+ Treasuries (TMF-like) — the risk-parity hedge sleeve
  // SPDR sectors
  SEC_XLK: 'SEC_XLK',
  SEC_XLF: 'SEC_XLF',
  SEC_XLE: 'SEC_XLE',
  SEC_XLV: 'SEC_XLV',
  SEC_XLY: 'SEC_XLY',
  SEC_XLP: 'SEC_XLP',
  SEC_XLI: 'SEC_XLI',
  SEC_XLB: 'SEC_XLB',
  SEC_XLU: 'SEC_XLU',
} as const;

/** A composed logical asset (index / ETF / bond / sector / leveraged ETF). */
export type LogicalAssetKey = (typeof ASSET)[keyof typeof ASSET];

/**
 * An individual-stock asset key, e.g. `STK_AAPL`. Stocks are loaded from
 * `data/stocks/` and exposed to strategies through the same `ctx` indicator API
 * (`ctx.stocks()` enumerates the ones with data on the signal day).
 */
export type StockKey = `STK_${string}`;

/** Anything a strategy can allocate to: a logical asset or an individual stock. */
export type AssetKey = LogicalAssetKey | StockKey;

/** Build a stock asset key from a ticker symbol. */
export const stockKey = (symbol: string): StockKey => `STK_${symbol}`;

/** Recover the ticker symbol from a stock asset key (undefined for non-stocks). */
export const symbolOf = (a: AssetKey): string | undefined =>
  a.startsWith('STK_') ? a.slice(4) : undefined;

/**
 * Human-readable label for any asset key. Logical assets use their Chinese
 * label; individual stocks render as their plain US ticker (e.g. `STK_AAPL` →
 * `AAPL`) rather than the internal key. Use this everywhere an asset is shown.
 */
export const assetLabel = (a: AssetKey): string => ASSET_LABELS[a] ?? symbolOf(a) ?? a;

export const SECTOR_ASSETS: AssetKey[] = [
  ASSET.SEC_XLK,
  ASSET.SEC_XLF,
  ASSET.SEC_XLE,
  ASSET.SEC_XLV,
  ASSET.SEC_XLY,
  ASSET.SEC_XLP,
  ASSET.SEC_XLI,
  ASSET.SEC_XLB,
  ASSET.SEC_XLU,
];

export const ASSET_LABELS: Record<AssetKey, string> = {
  USLC: '美國大型股 (S&P 500)',
  NASDAQ: '那斯達克 100',
  SMALL: '美國小型股 (Russell 2000)',
  INTL: '已開發國際股 (EAFE)',
  CASH: '現金 / 美國國庫券',
  ITT: '中期美國公債',
  LTT: '長期美國公債',
  GOLD: '黃金',
  NASDAQ3X: '3x 那斯達克 (TQQQ)',
  NASDAQ2X: '2x 那斯達克 (QLD)',
  USLC3X: '3x 標普500 (UPRO)',
  USLC2X: '2x 標普500 (SSO)',
  LTT3X: '3x 長期美國公債 (TMF)',
  SEC_XLK: '科技類股',
  SEC_XLF: '金融類股',
  SEC_XLE: '能源類股',
  SEC_XLV: '醫療類股',
  SEC_XLY: '非必需消費類股',
  SEC_XLP: '必需消費類股',
  SEC_XLI: '工業類股',
  SEC_XLB: '原物料類股',
  SEC_XLU: '公用事業類股',
};

/** Modified-duration assumptions for synthesizing Treasury total returns. */
export const BOND_DURATION = {
  ITT: 7.5,
  LTT: 17,
};

/** Market-exposure multiple of each asset (cash = 0, leveraged ETFs = 2/3, else 1). */
export const ASSET_LEVERAGE: Partial<Record<AssetKey, number>> = {
  NASDAQ3X: 3,
  NASDAQ2X: 2,
  USLC3X: 3,
  USLC2X: 2,
  LTT3X: 3,
  CASH: 0,
};

export const leverageOf = (a: AssetKey): number => ASSET_LEVERAGE[a] ?? 1;

/** Annual expense/financing drag applied to the *borrowed* portion of leverage. */
export const LEVERAGE_ANNUAL_COST = 0.01; // ~1%/yr, approximates leveraged-ETF fees + spread

/**
 * Synthetic leveraged daily-reset ETFs. Each compounds `leverage × underlying
 * daily return − (leverage−1) × cash rate − expense`, matching how a real
 * leveraged ETF (e.g. TQQQ) behaves — the holder buys it with cash, no margin.
 */
export const LEVERAGED_ETFS: {
  key: AssetKey;
  underlying: AssetKey;
  leverage: number;
  expense: number; // annual expense ratio
}[] = [
  { key: ASSET.NASDAQ3X, underlying: ASSET.NASDAQ, leverage: 3, expense: 0.0095 },
  { key: ASSET.NASDAQ2X, underlying: ASSET.NASDAQ, leverage: 2, expense: 0.0095 },
  { key: ASSET.USLC3X, underlying: ASSET.USLC, leverage: 3, expense: 0.0091 },
  { key: ASSET.USLC2X, underlying: ASSET.USLC, leverage: 2, expense: 0.0089 },
  { key: ASSET.LTT3X, underlying: ASSET.LTT, leverage: 3, expense: 0.0106 },
];
