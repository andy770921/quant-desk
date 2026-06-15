import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MarketIndexQuote, MarketOverview, PriceSeries } from '@repo/shared';
import { ASSET, AssetKey, BOND_DURATION, LEVERAGED_ETFS } from './assets';
import { fetchYahooSeries, RawPoint } from './yahoo.client';

interface RawSeries {
  key: string;
  yahoo: string;
  note: string;
  type: string;
  currency: string;
  firstDate: string;
  lastDate: string;
  points: RawPoint[];
}

type Aligned = (number | undefined)[];

/** Display series shown on the market dashboard. */
const DISPLAY_SERIES: { symbol: string; name: string; isYield: boolean }[] = [
  { symbol: 'GSPC', name: 'S&P 500', isYield: false },
  { symbol: 'NDX', name: '那斯達克 100', isYield: false },
  { symbol: 'IXIC', name: '那斯達克綜合指數', isYield: false },
  { symbol: 'RUT', name: 'Russell 2000 小型股', isYield: false },
  { symbol: 'GLD', name: '黃金 (GLD)', isYield: false },
  { symbol: 'TNX', name: '美國 10 年期公債殖利率', isYield: true },
];

@Injectable()
export class MarketDataService implements OnModuleInit {
  private readonly logger = new Logger(MarketDataService.name);
  private raw = new Map<string, RawSeries>();
  /** Canonical US trading-day calendar (from the S&P 500 price index). */
  private calendar: string[] = [];
  private calendarIndex = new Map<string, number>();
  /** Logical asset → daily level aligned to the calendar (undefined pre-inception). */
  private levels = new Map<AssetKey, Aligned>();
  /** ISO timestamp of the last successful live refresh (empty until first refresh). */
  private lastRefreshed = '';

  onModuleInit() {
    this.loadRaw();
    this.rebuild();
    this.logger.log(
      `Loaded ${this.raw.size} raw series, calendar ${this.calendar[0]}…${this.calendar.at(-1)} (${this.calendar.length} days), ${this.levels.size} logical assets`,
    );
  }

  /** Rebuild the calendar + all logical-asset levels from the current raw data. */
  private rebuild() {
    this.buildCalendar();
    this.inceptionLevelCache.clear();
    this.buildAssets();
  }

  /**
   * Pull the latest bars from Yahoo for every series, merge them into the raw
   * store and atomically rebuild. Use interval '1d' for end-of-day refreshes or
   * '1m'/'1h' (with a short range) for intraday. Safe to call on a schedule.
   */
  async refreshFromLive(
    range = '5d',
    interval: '1d' | '1h' | '1m' | '5m' = '1d',
  ): Promise<{
    updated: number;
    asOf: string;
  }> {
    let updated = 0;
    for (const series of this.raw.values()) {
      try {
        const points = await fetchYahooSeries(series.yahoo, range, interval);
        if (this.mergePoints(series, points)) updated++;
      } catch (err) {
        this.logger.warn(`refresh ${series.yahoo} failed: ${(err as Error).message}`);
      }
    }
    this.rebuild();
    this.lastRefreshed = new Date().toISOString();
    const asOf = this.calendar.at(-1) ?? '';
    this.logger.log(`Live refresh: ${updated}/${this.raw.size} series updated, data asOf ${asOf}`);
    return { updated, asOf };
  }

  /** Merge fresh daily points into a series (update existing dates, append new). */
  private mergePoints(series: RawSeries, fresh: RawPoint[]): boolean {
    if (fresh.length === 0) return false;
    const byDate = new Map(series.points.map((p) => [p.d, p]));
    let changed = false;
    for (const p of fresh) {
      const existing = byDate.get(p.d);
      if (!existing || existing.c !== p.c) {
        byDate.set(p.d, p);
        changed = true;
      }
    }
    if (!changed) return false;
    series.points = [...byDate.values()].sort((a, b) => (a.d < b.d ? -1 : 1));
    series.lastDate = series.points[series.points.length - 1].d;
    return true;
  }

  getAsOf(): string {
    return this.calendar.at(-1) ?? '';
  }

  getLastRefreshed(): string {
    return this.lastRefreshed;
  }

  // ----------------------------------------------------------------- loading

  private resolveDataDir(): string {
    const candidates = [
      resolve(__dirname, '..', '..', 'data'),
      resolve(__dirname, '..', '..', '..', 'data'),
      resolve(process.cwd(), 'data'),
      resolve(process.cwd(), 'backend', 'data'),
    ];
    for (const dir of candidates) {
      if (existsSync(resolve(dir, 'manifest.json'))) return dir;
    }
    throw new Error(
      `Market data not found. Run "node scripts/fetch-market-data.mjs". Looked in: ${candidates.join(', ')}`,
    );
  }

  private loadRaw() {
    const dir = this.resolveDataDir();
    const manifest = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8')) as {
      key: string;
    }[];
    for (const { key } of manifest) {
      const file = resolve(dir, `${key}.json`);
      if (!existsSync(file)) continue;
      this.raw.set(key, JSON.parse(readFileSync(file, 'utf8')) as RawSeries);
    }
  }

  private buildCalendar() {
    const base = this.raw.get('GSPC');
    if (!base) throw new Error('GSPC base calendar series missing');
    this.calendar = base.points.map((p) => p.d);
    this.calendar.forEach((d, i) => this.calendarIndex.set(d, i));
  }

  // ------------------------------------------------------- asset composition

  /** Most-recent raw value on or before each calendar day (forward fill). */
  private align(seriesKey: string, field: 'c' | 'a'): Aligned {
    const series = this.raw.get(seriesKey);
    const out: Aligned = new Array(this.calendar.length).fill(undefined);
    if (!series) return out;
    let j = 0;
    let last: number | undefined;
    const pts = series.points;
    for (let i = 0; i < this.calendar.length; i++) {
      const day = this.calendar[i];
      while (j < pts.length && pts[j].d <= day) {
        last = pts[j][field];
        j++;
      }
      out[i] = last;
    }
    return out;
  }

  /** Chain daily returns from the first available of `sources` (priority order). */
  private spliceReturns(sources: Aligned[]): Aligned {
    const n = this.calendar.length;
    const out: Aligned = new Array(n).fill(undefined);
    let level: number | undefined;
    for (let i = 0; i < n; i++) {
      if (level === undefined) {
        if (sources.some((s) => s[i] !== undefined)) {
          level = 100;
          out[i] = level;
        }
        continue;
      }
      let r = 0;
      for (const s of sources) {
        if (s[i] !== undefined && s[i - 1] !== undefined) {
          r = s[i]! / s[i - 1]! - 1;
          break;
        }
      }
      level *= 1 + r;
      out[i] = level;
    }
    return out;
  }

  /** Synthesize a constant-duration Treasury total-return index from a yield series. */
  private synthBond(yieldKey: string, duration: number): Aligned {
    const y = this.align(yieldKey, 'c'); // yields stored as percent in close
    const n = this.calendar.length;
    const out: Aligned = new Array(n).fill(undefined);
    let level: number | undefined;
    for (let i = 0; i < n; i++) {
      if (y[i] === undefined) continue;
      if (level === undefined) {
        level = 100;
        out[i] = level;
        continue;
      }
      const yPrev = y[i - 1] !== undefined ? y[i - 1]! / 100 : y[i]! / 100;
      const dy = (y[i]! - (y[i - 1] ?? y[i]!)) / 100;
      // carry + duration price move + convexity
      const r = yPrev / 252 - duration * dy + 0.5 * duration * duration * dy * dy;
      level *= 1 + r;
      out[i] = level;
    }
    return out;
  }

  /**
   * Synthesize a daily-reset leveraged ETF NAV from an underlying asset:
   * dailyReturn = L·r_underlying − (L−1)·cashRate − expense/252.
   */
  private synthLeveraged(underlying: AssetKey, leverage: number, expense: number): Aligned {
    const base = this.levels.get(underlying);
    if (!base) throw new Error(`Leverage underlying ${underlying} not built yet`);
    const cash = this.levels.get(ASSET.CASH)!;
    const n = this.calendar.length;
    const out: Aligned = new Array(n).fill(undefined);
    let nav: number | undefined;
    for (let i = 0; i < n; i++) {
      if (base[i] === undefined) continue;
      if (nav === undefined || base[i - 1] === undefined) {
        nav = 100;
        out[i] = nav;
        continue;
      }
      const r = base[i]! / base[i - 1]! - 1;
      const cashRate =
        cash[i] !== undefined && cash[i - 1] !== undefined ? cash[i]! / cash[i - 1]! - 1 : 0;
      const lev = leverage * r - (leverage - 1) * cashRate - expense / 252;
      nav *= 1 + lev;
      out[i] = nav;
    }
    return out;
  }

  /** Synthesize a T-bill cash index from the 13-week discount-rate series. */
  private synthCash(): Aligned {
    const y = this.align('IRX', 'c');
    const n = this.calendar.length;
    const out: Aligned = new Array(n).fill(undefined);
    let level: number | undefined;
    for (let i = 0; i < n; i++) {
      if (y[i] === undefined) continue;
      if (level === undefined) {
        level = 100;
        out[i] = level;
        continue;
      }
      const rate = (y[i - 1] ?? y[i]!) / 100;
      out[i] = level = level * (1 + rate / 252);
    }
    return out;
  }

  private buildAssets() {
    // Equities & international: use adjusted close directly as a return index.
    this.levels.set(ASSET.USLC, this.align('SP500TR', 'a'));
    this.levels.set(ASSET.NASDAQ, this.align('NDX', 'c'));
    this.levels.set(ASSET.SMALL, this.align('RUT', 'c'));
    this.levels.set(ASSET.INTL, this.align('EFA', 'a'));

    // Synthesized fixed income / cash (long history back to 1990).
    this.levels.set(ASSET.CASH, this.synthCash());
    this.levels.set(ASSET.ITT, this.synthBond('TNX', BOND_DURATION.ITT));
    this.levels.set(ASSET.LTT, this.synthBond('TYX', BOND_DURATION.LTT));

    // Gold: GLD adjusted close spliced with gold-futures before 2004.
    this.levels.set(
      ASSET.GOLD,
      this.spliceReturns([this.align('GLD', 'a'), this.align('GCF', 'c')]),
    );

    // SPDR sectors.
    const sectorMap: [AssetKey, string][] = [
      [ASSET.SEC_XLK, 'XLK'],
      [ASSET.SEC_XLF, 'XLF'],
      [ASSET.SEC_XLE, 'XLE'],
      [ASSET.SEC_XLV, 'XLV'],
      [ASSET.SEC_XLY, 'XLY'],
      [ASSET.SEC_XLP, 'XLP'],
      [ASSET.SEC_XLI, 'XLI'],
      [ASSET.SEC_XLB, 'XLB'],
      [ASSET.SEC_XLU, 'XLU'],
    ];
    for (const [asset, sym] of sectorMap) this.levels.set(asset, this.align(sym, 'a'));

    // Leveraged daily-reset ETFs (depend on underlying + CASH already built above).
    for (const { key, underlying, leverage, expense } of LEVERAGED_ETFS) {
      this.levels.set(key, this.synthLeveraged(underlying, leverage, expense));
    }
  }

  // -------------------------------------------------------- engine accessors

  getCalendar(): string[] {
    return this.calendar;
  }

  getLevels(asset: AssetKey): Aligned {
    const lv = this.levels.get(asset);
    if (!lv) throw new Error(`Unknown asset ${asset}`);
    return lv;
  }

  private inceptionLevelCache = new Map<AssetKey, number>();

  /**
   * Tradable price per share for an asset, rebased to 100 at its inception so
   * share counts in the ledger are sensible and comparable across instruments.
   */
  getPrice(asset: AssetKey, i: number): number | undefined {
    const lv = this.getLevels(asset);
    const v = lv[i];
    if (v === undefined) return undefined;
    let base = this.inceptionLevelCache.get(asset);
    if (base === undefined) {
      const idx = lv.findIndex((x) => x !== undefined);
      base = lv[idx]!;
      this.inceptionLevelCache.set(asset, base);
    }
    return (100 * v) / base;
  }

  /** First calendar date where the asset has a value. */
  getInceptionIndex(asset: AssetKey): number {
    const lv = this.getLevels(asset);
    return lv.findIndex((v) => v !== undefined);
  }

  getInceptionDate(asset: AssetKey): string {
    const idx = this.getInceptionIndex(asset);
    return idx >= 0 ? this.calendar[idx] : this.calendar[0];
  }

  /** Index of the first trading day on or after `date` ("YYYY-MM-DD" or "YYYY-MM"). */
  indexOnOrAfter(date: string): number {
    const target = date.length === 7 ? `${date}-01` : date;
    for (let i = 0; i < this.calendar.length; i++) {
      if (this.calendar[i] >= target) return i;
    }
    return -1;
  }

  lastIndex(): number {
    return this.calendar.length - 1;
  }

  // -------------------------------------------------------- display / charts

  getMarketOverview(): MarketOverview {
    const quotes: MarketIndexQuote[] = [];
    for (const { symbol, name, isYield } of DISPLAY_SERIES) {
      const series = this.raw.get(symbol);
      if (!series) continue;
      quotes.push(this.toQuote(series, name, isYield));
    }
    return { asOf: this.calendar.at(-1) ?? '', quotes };
  }

  private toQuote(series: RawSeries, name: string, isYield: boolean): MarketIndexQuote {
    const pts = series.points;
    const last = pts.at(-1)!;
    const prev = pts.at(-2) ?? last;
    const year = last.d.slice(0, 4);
    // Last close of the previous calendar year for YTD.
    let ytdBase = pts[0];
    for (let i = pts.length - 1; i >= 0; i--) {
      if (pts[i].d.slice(0, 4) < year) {
        ytdBase = pts[i];
        break;
      }
    }
    const oneYearAgo = pts[Math.max(0, pts.length - 253)];
    const pct = (from: number, to: number) => (to / from - 1) * 100;
    // Monthly sparkline: last close of each of the trailing ~30 months.
    const spark: number[] = [];
    let curMonth = '';
    for (const p of pts) {
      const m = p.d.slice(0, 7);
      if (m !== curMonth) {
        spark.push(p.c);
        curMonth = m;
      } else {
        spark[spark.length - 1] = p.c;
      }
    }
    return {
      symbol: series.key,
      name,
      last: last.c,
      isYield,
      changePct1d: pct(prev.c, last.c),
      changePctYtd: pct(ytdBase.c, last.c),
      changePct1y: pct(oneYearAgo.c, last.c),
      sparkline: spark.slice(-30),
    };
  }

  getPriceSeries(symbol: string): PriceSeries {
    const series = this.raw.get(symbol);
    if (!series) throw new Error(`Unknown symbol ${symbol}`);
    const meta = DISPLAY_SERIES.find((d) => d.symbol === symbol);
    // Down-sample to monthly closes for charting.
    const points: { date: string; close: number }[] = [];
    let curMonth = '';
    for (const p of series.points) {
      const m = p.d.slice(0, 7);
      if (m !== curMonth) {
        points.push({ date: p.d, close: p.c });
        curMonth = m;
      } else {
        points[points.length - 1] = { date: p.d, close: p.c };
      }
    }
    return {
      symbol: series.key,
      name: meta?.name ?? series.key,
      firstDate: series.firstDate,
      lastDate: series.lastDate,
      points,
    };
  }
}
