/**
 * Minimal Yahoo Finance chart-API client used to refresh market data at runtime.
 * No API key required. Mirrors scripts/fetch-market-data.mjs so the live refresh
 * and the one-off snapshot stay consistent.
 */

export interface RawPoint {
  d: string; // 'YYYY-MM-DD'
  c: number; // close (or yield for rate series)
  a: number; // adjusted close (== close for indices)
  o?: number; // open
  h?: number; // high
  l?: number; // low
  v?: number; // volume
}

const toISO = (epochSeconds: number) => new Date(epochSeconds * 1000).toISOString().slice(0, 10);

/**
 * Fetch recent bars for a Yahoo symbol. Defaults to ~3 months of daily bars,
 * enough to append newly-closed days and update the latest close. Pass a smaller
 * `range` with `interval: '1m'`/`'1h'` for intraday refreshes.
 */
export async function fetchYahooSeries(
  yahooSymbol: string,
  range = '3mo',
  interval: '1d' | '1h' | '1m' | '5m' = '1d',
): Promise<RawPoint[]> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}` +
    `?range=${range}&interval=${interval}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status} for ${yahooSymbol}`);
  const json = (await res.json()) as {
    chart?: {
      result?: {
        timestamp?: number[];
        indicators?: {
          quote?: {
            open?: (number | null)[];
            high?: (number | null)[];
            low?: (number | null)[];
            close?: (number | null)[];
            volume?: (number | null)[];
          }[];
          adjclose?: { adjclose?: (number | null)[] }[];
        };
      }[];
      error?: unknown;
    };
  };
  const result = json?.chart?.result?.[0];
  if (!result?.timestamp) throw new Error(`Yahoo empty result for ${yahooSymbol}`);
  const q = result.indicators?.quote?.[0] ?? {};
  const closes = q.close ?? [];
  const adj = result.indicators?.adjclose?.[0]?.adjclose ?? null;
  const px = (x: number | null | undefined) => (x == null ? undefined : Number(x.toFixed(4)));

  const points: RawPoint[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const c = closes[i];
    if (c == null) continue;
    const a = adj && adj[i] != null ? (adj[i] as number) : c;
    points.push({
      d: toISO(result.timestamp[i]),
      c: Number(c.toFixed(4)),
      a: Number(a.toFixed(4)),
      o: px(q.open?.[i]),
      h: px(q.high?.[i]),
      l: px(q.low?.[i]),
      v: q.volume?.[i] == null ? undefined : (q.volume![i] as number),
    });
  }
  return points;
}
