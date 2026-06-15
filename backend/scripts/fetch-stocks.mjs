// @ts-check
/**
 * Fetches daily OHLCV history for INDIVIDUAL US stocks from the free Yahoo
 * Finance chart API and stores it partitioned by year, so the dataset scales to
 * many tickers without huge files and can be updated incrementally (only the
 * current year changes; prior years are immutable → minimal API calls).
 *
 * Layout:
 *   backend/data/stocks/<SYMBOL>/<YEAR>.json   // [{ d,o,h,l,c,a,v }, ...]
 *   backend/data/stocks/<SYMBOL>/meta.json     // { symbol, firstDate, lastDate, count, years }
 *   backend/data/stocks/manifest.json          // [{ symbol, firstDate, lastDate, count }]
 *
 * Usage:
 *   node scripts/fetch-stocks.mjs                 # default demo universe
 *   node scripts/fetch-stocks.mjs AAPL MSFT TSLA  # specific tickers
 *
 * NOTE: this only provides PRICE/VOLUME data. Fundamentals (earnings, P/E,
 * revenue, margins) are NOT included — see documents/FEAT-1/development/DATA.md.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STOCKS_DIR = join(__dirname, '..', 'data', 'stocks');

// Small representative demo universe (mega-cap leaders). Expand freely — pass
// tickers as CLI args, or edit this list, to build a larger research universe.
const DEFAULT_UNIVERSE = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL'];

const toISO = (epochSeconds) => new Date(epochSeconds * 1000).toISOString().slice(0, 10);
const px = (x) => (x == null ? undefined : Number(x.toFixed(4)));

async function fetchStock(symbol) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=0&period2=9999999999&interval=1d&events=div%2Csplit`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result?.timestamp) throw new Error('empty result');
  const q = result.indicators?.quote?.[0] ?? {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose ?? null;
  const closes = q.close ?? [];

  const points = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const c = closes[i];
    if (c == null) continue;
    const a = adj && adj[i] != null ? adj[i] : c;
    points.push({
      d: toISO(result.timestamp[i]),
      o: px(q.open?.[i]),
      h: px(q.high?.[i]),
      l: px(q.low?.[i]),
      c: Number(c.toFixed(4)),
      a: Number(a.toFixed(4)),
      v: q.volume?.[i] == null ? undefined : q.volume[i],
    });
  }
  return points;
}

async function writeStock(symbol, points) {
  const dir = join(STOCKS_DIR, symbol);
  await mkdir(dir, { recursive: true });

  // Partition by calendar year.
  const byYear = new Map();
  for (const p of points) {
    const year = p.d.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(p);
  }
  for (const [year, pts] of byYear) {
    await writeFile(join(dir, `${year}.json`), JSON.stringify(pts));
  }
  const meta = {
    symbol,
    firstDate: points[0].d,
    lastDate: points[points.length - 1].d,
    count: points.length,
    years: [...byYear.keys()].sort(),
  };
  await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  return meta;
}

async function main() {
  const universe = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_UNIVERSE;
  await mkdir(STOCKS_DIR, { recursive: true });
  const manifest = [];
  for (const symbol of universe) {
    try {
      const points = await fetchStock(symbol);
      const meta = await writeStock(symbol, points);
      manifest.push({
        symbol: meta.symbol,
        firstDate: meta.firstDate,
        lastDate: meta.lastDate,
        count: meta.count,
      });
      console.log(
        `✓ ${symbol.padEnd(6)} ${meta.firstDate} → ${meta.lastDate}  (${meta.count} pts, ${meta.years.length} yearly files)`,
      );
    } catch (err) {
      console.error(`✗ ${symbol}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  await writeFile(join(STOCKS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${manifest.length}/${universe.length} stocks (partitioned by year) to ${STOCKS_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
