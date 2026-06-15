# Market Data — Inventory & Dictionary (for strategy research)

> Read this before designing or iterating a strategy. It states **exactly what
> data exists, where it lives, what each strategy can access, and what is NOT
> available**, so you don't design a strategy the data can't support.

## TL;DR — is the data enough?

- **Enough for:** price/technical & asset-allocation strategies on **indices & ETFs**
  (moving averages, momentum, volatility, RSI, rotation, risk parity). All 19 current
  strategies are of this type. Daily **OHLCV** is stored (open/high/low/close/adjClose/volume).
- **NOT enough for (data missing today):**
  - **Individual-stock selection** — only a small demo stock universe is fetched (5 names).
    Expand with `fetch-stocks.mjs` (price/volume only).
  - **Fundamentals** — earnings, P/E, revenue, margins, balance sheet: **none**. Needs a new source
    (see "Adding fundamentals").
  - **Intraday history** — only a daily snapshot is stored; intraday is available **on demand**
    via the live refresh (`interval=1m/1h`), not persisted.

## Where data lives

```
backend/data/
├── manifest.json              # list of core series (key, yahoo, type, dates, count)
├── <KEY>.json                 # one core series: { key, yahoo, type, currency, firstDate, lastDate, points[] }
└── stocks/
    ├── manifest.json          # list of individual stocks
    └── <SYMBOL>/
        ├── meta.json          # { symbol, firstDate, lastDate, count, years[] }
        └── <YEAR>.json        # daily points for that calendar year (partitioned)
```

A daily **point** is `{ d, o, h, l, c, a, v }`:
`d` date `YYYY-MM-DD`, `o/h/l` open/high/low, `c` close (or **yield %** for rate series),
`a` adjusted close (dividends+splits; `== c` for indices/yields), `v` volume (absent for indices/yields).

## Core series (32) — `backend/data/<KEY>.json`

| Group | Keys (Yahoo) | Coverage |
|-------|--------------|----------|
| US equity indices | `SP500TR` (^SP500TR, total return), `GSPC` (^GSPC), `NDX` (^NDX), `IXIC` (^IXIC), `RUT` (^RUT) | 1970/1985/1987/1988+ |
| Treasury yields (%) | `IRX` (13-wk), `TNX` (10-yr), `TYX` (30-yr) | 1970/1977+ |
| Broad/intl/bond ETFs | `SPY` `QQQ` `VOO` `IWM` `TLT` `IEF` `SHY` `BIL` `EFA` `VEU` `BND` `AGG` | 1993–2010+ |
| Commodity/gold | `GLD` (2004+), `GCF` (GC=F gold future, 2000+), `DBC` (2006+) | |
| SPDR sectors | `XLK XLF XLE XLV XLY XLP XLI XLB XLU` | 1998+ |

## Logical assets (what strategies actually use)

The engine doesn't expose raw symbols to strategies; it composes **logical assets**
(`backend/src/market-data/assets.ts`, `ASSET.*`) as continuous daily total-return-style series,
splicing histories and synthesizing bond/cash from yields so backtests reach ~1990:

| AssetKey | Meaning | Built from |
|----------|---------|-----------|
| `USLC` | US large cap (total return) | `SP500TR` |
| `NASDAQ` | Nasdaq-100 (price) | `NDX` |
| `SMALL` | US small cap | `RUT` |
| `INTL` | Developed intl (EAFE) | `EFA` |
| `CASH` | T-bills | synth from `IRX` |
| `ITT` / `LTT` | Intermediate / long Treasuries | synth from `TNX` / `TYX` (constant duration) |
| `GOLD` | Gold | `GLD` spliced with `GCF` |
| `SEC_XL*` | 9 SPDR sectors | `XLK…XLU` |
| `NASDAQ3X` `USLC3X` `USLC2X` | Leveraged daily-reset ETFs (TQQQ/UPRO/SSO) | synth: `L × underlying − financing − fee` |

`MarketDataService.getPrice(asset, i)` / `getLevels(asset)` return these. `getInceptionIndex(asset)`
gives first available day. The full set + how each is built is in `market-data.service.ts → buildAssets()`.

## Strategy toolbox (the `decide(ctx)` API)

A strategy is one file in `backend/src/strategies/definitions/` exporting a `StrategyDefinition`
whose `decide(ctx) → Weights` returns target weights per `AssetKey` (sum ≤ 1; no borrowing —
leverage only via the leveraged-ETF assets). `ctx` (see `strategy.types.ts`) currently exposes
**close-based** indicators on any asset:

`level(a, lag?)`, `sma(a, period)`, `ret(a, period)`, `rsi(a, period)`, `vol(a, period)`,
`score13612W(a)`, `accel(a)`, `has(a)`. Periods are in trading days (1m≈21, 3m≈63, 6m≈126, 12m≈252).

> ⚠️ The context is **close-only** today. OHLCV is stored on disk but `ctx` does not yet surface
> `volume()/high()/low()`. To build volume/ATR/gap strategies, first extend `MarketDataService` +
> `StrategyContext` to expose those fields (the data is already there).

Engine constraints (`backtest/engine.ts`): long-only, no margin, ≤3 discretionary trades/calendar
month, signals computed on the close (one-bar lag), cadence `daily` or `monthly`. Risk level &
leverage are **derived** from a canonical backtest, not hard-coded.

## Individual stocks — `backend/data/stocks/`

Fetched by `node backend/scripts/fetch-stocks.mjs [TICKERS...]`, **partitioned by year**
(`<SYMBOL>/<YEAR>.json`) so the dataset scales and updates incrementally (only the current year
changes). Default demo universe: AAPL, MSFT, NVDA, AMZN, GOOGL (full OHLCV history). These are
**not yet wired into the engine** — to build a stock-selection strategy, add a loader for
`data/stocks/` and a logical-asset/universe layer, then write the strategy.

## NOT available — and how to add it

| Need | Status | How to add |
|------|--------|-----------|
| More ETFs / indices | easy | add to `SYMBOLS` in `fetch-market-data.mjs`, then a logical asset in `assets.ts` + `buildAssets()` |
| More individual stocks | easy | `node scripts/fetch-stocks.mjs TSLA META …` |
| Volume / OHLC in signals | data on disk, not in `ctx` | extend `MarketDataService` + `StrategyContext` to expose o/h/l/v |
| **Fundamentals** (EPS, P/E, revenue, margins, balance sheet) | **missing** | free: **SEC EDGAR** company-facts API (`data.sec.gov`, official filings) or Yahoo `quoteSummary` (unstable); paid: Financial Modeling Prep / Tiingo / Polygon. Store under `data/fundamentals/<SYMBOL>.json` |
| Intraday history (minute/hour) | live on-demand only | `refreshFromLive(range,'1m')`; to persist, add `data/intraday/<SYMBOL>/<YYYY-MM>.json` (partition by month) |
| Corporate actions, options, analyst, sentiment, breadth | missing | external sources; out of scope today |

## Storage & API-limit strategy

- **Daily** core series: one file per symbol (~600KB–1.2MB). Refreshed in full (~3s for 32 symbols).
- **Stocks**: partitioned by **year**; re-fetch only the current year to update (prior years immutable).
- **Intraday**: partition by **month** (or day) when added — minute data is large.
- Commit the snapshot so the app runs offline; for large universes (hundreds of stocks) gitignore
  `data/stocks/` and fetch on deploy/CI instead. Prefer cached static files over live calls to stay
  within Yahoo's free rate limits; use the live refresh only for the latest bar(s).

## Checklist before researching a new strategy

1. Does it only need indices/ETFs + close-based indicators? → **ready now**, write `decide()`.
2. Needs volume/high/low? → extend `ctx` first (data is on disk).
3. Needs individual stocks? → fetch them + add a universe loader.
4. Needs fundamentals? → add a data source first (SEC EDGAR / paid). Don't design it until the data exists.
