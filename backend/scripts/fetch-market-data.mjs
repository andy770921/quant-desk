// @ts-check
/**
 * Fetches daily historical price data for US ETFs / indices from the free
 * Yahoo Finance chart API (no API key required) and caches each series as JSON
 * under backend/data/. Run with: `node scripts/fetch-market-data.mjs`.
 *
 * The cached files are consumed at runtime by MarketDataService. We store the
 * raw close and dividend/split-adjusted close so the backtest engine can use
 * total-return series for ETFs and price series for indices.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

/**
 * Yahoo tickers to fetch. The `key` is the filesystem-safe id we store under.
 * `note` documents what role the series plays for the logical-asset layer.
 */
const SYMBOLS = [
  // --- Broad equity indices / total-return indices (long history) ---
  { yahoo: '^SP500TR', key: 'SP500TR', note: 'S&P 500 total return (1988+)' },
  { yahoo: '^GSPC', key: 'GSPC', note: 'S&P 500 price index (1950+)' },
  { yahoo: '^NDX', key: 'NDX', note: 'Nasdaq 100 price index (1985+)' },
  { yahoo: '^IXIC', key: 'IXIC', note: 'Nasdaq Composite (1971+)' },
  { yahoo: '^RUT', key: 'RUT', note: 'Russell 2000 small cap (1987+)' },
  // --- Treasury yields (for synthesizing bond / cash returns back to 1990) ---
  { yahoo: '^IRX', key: 'IRX', note: '13-week T-bill discount rate % (cash)' },
  { yahoo: '^TNX', key: 'TNX', note: '10Y Treasury yield %' },
  { yahoo: '^TYX', key: 'TYX', note: '30Y Treasury yield %' },
  // --- Tradable ETFs (used as benchmarks + recent-era assets) ---
  { yahoo: 'SPY', key: 'SPY', note: 'S&P 500 ETF (1993+)' },
  { yahoo: 'QQQ', key: 'QQQ', note: 'Nasdaq 100 ETF (1999+)' },
  { yahoo: 'VOO', key: 'VOO', note: 'Vanguard S&P 500 ETF (2010+)' },
  { yahoo: 'IWM', key: 'IWM', note: 'Russell 2000 ETF (2000+)' },
  { yahoo: 'TLT', key: 'TLT', note: '20Y+ Treasury ETF (2002+)' },
  { yahoo: 'IEF', key: 'IEF', note: '7-10Y Treasury ETF (2002+)' },
  { yahoo: 'SHY', key: 'SHY', note: '1-3Y Treasury ETF (2002+)' },
  { yahoo: 'BIL', key: 'BIL', note: '1-3M T-bill ETF (2007+)' },
  { yahoo: 'GLD', key: 'GLD', note: 'Gold ETF (2004+)' },
  { yahoo: 'GC=F', key: 'GCF', note: 'Gold front-month future (2000+)' },
  { yahoo: 'DBC', key: 'DBC', note: 'Commodity ETF (2006+)' },
  { yahoo: 'EFA', key: 'EFA', note: 'MSCI EAFE developed intl ETF (2001+)' },
  { yahoo: 'VEU', key: 'VEU', note: 'FTSE all-world ex-US ETF (2007+)' },
  { yahoo: 'BND', key: 'BND', note: 'Total bond market ETF (2007+)' },
  { yahoo: 'AGG', key: 'AGG', note: 'Aggregate bond ETF (2003+)' },
  // --- SPDR sector ETFs (1998+, XLRE 2015+, XLC 2018+) ---
  { yahoo: 'XLK', key: 'XLK', note: 'Technology' },
  { yahoo: 'XLF', key: 'XLF', note: 'Financials' },
  { yahoo: 'XLE', key: 'XLE', note: 'Energy' },
  { yahoo: 'XLV', key: 'XLV', note: 'Health care' },
  { yahoo: 'XLY', key: 'XLY', note: 'Consumer discretionary' },
  { yahoo: 'XLP', key: 'XLP', note: 'Consumer staples' },
  { yahoo: 'XLI', key: 'XLI', note: 'Industrials' },
  { yahoo: 'XLB', key: 'XLB', note: 'Materials' },
  { yahoo: 'XLU', key: 'XLU', note: 'Utilities' },
];

const toISO = (epochSeconds) => new Date(epochSeconds * 1000).toISOString().slice(0, 10);

async function fetchSymbol({ yahoo, key, note }) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}` +
    `?period1=0&period2=9999999999&interval=1d&events=div%2Csplit`;

  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${yahoo}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No result for ${yahoo}: ${JSON.stringify(json?.chart?.error)}`);

  const { timestamp = [], indicators, meta } = result;
  const quote = indicators?.quote?.[0] ?? {};
  const adj = indicators?.adjclose?.[0]?.adjclose ?? null;
  const closes = quote.close ?? [];
  const px = (x) => (x == null ? undefined : Number(x.toFixed(4)));

  const points = [];
  for (let i = 0; i < timestamp.length; i++) {
    const c = closes[i];
    if (c == null) continue; // skip holidays / missing bars
    const a = adj && adj[i] != null ? adj[i] : c;
    // Store full OHLCV so future strategies can use volume / range / gaps.
    points.push({
      d: toISO(timestamp[i]),
      o: px(quote.open?.[i]),
      h: px(quote.high?.[i]),
      l: px(quote.low?.[i]),
      c: Number(c.toFixed(4)),
      a: Number(a.toFixed(4)),
      v: quote.volume?.[i] == null ? undefined : quote.volume[i],
    });
  }

  if (points.length === 0) throw new Error(`Empty series for ${yahoo}`);

  const payload = {
    key,
    yahoo,
    note,
    type: meta?.instrumentType ?? 'UNKNOWN',
    currency: meta?.currency ?? 'USD',
    firstDate: points[0].d,
    lastDate: points[points.length - 1].d,
    count: points.length,
    points,
  };

  await writeFile(join(DATA_DIR, `${key}.json`), JSON.stringify(payload));
  return payload;
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const manifest = [];
  for (const sym of SYMBOLS) {
    try {
      const p = await fetchSymbol(sym);
      manifest.push({
        key: p.key,
        yahoo: p.yahoo,
        note: p.note,
        type: p.type,
        firstDate: p.firstDate,
        lastDate: p.lastDate,
        count: p.count,
      });
      console.log(`✓ ${p.key.padEnd(9)} ${p.firstDate} → ${p.lastDate}  (${p.count} pts)`);
    } catch (err) {
      console.error(`✗ ${sym.yahoo}: ${err.message}`);
    }
    // Be polite to the free endpoint.
    await new Promise((r) => setTimeout(r, 350));
  }
  await writeFile(join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${manifest.length}/${SYMBOLS.length} series + manifest.json to ${DATA_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
