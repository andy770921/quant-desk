# `backend/scripts` — data scripts & schedule

Standalone Node scripts (no build step, no deps) that refresh the **static market-data snapshot**
in `backend/data/`. The NestJS app reads those files at startup. Run them on a schedule (cron) to
keep the committed data current.

> These scripts update the on-disk snapshot. They are **separate** from the in-app live refresh
> (`SignalScheduler`, enabled with `SIGNALS_LIVE=true`), which pulls the latest bars into memory for
> real-time signals/alerts. Use the scripts for the durable daily snapshot; use the in-app scheduler
> for intraday/real-time. See `../../documents/FEAT-1/development/realtime-signals.md`.

## Scripts

| Script                        | What it does                                                                                                                          | Output                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `fetch-market-data.mjs`       | Fetch the 32 core index / ETF / Treasury-yield series (daily OHLCV, full history).                                                    | `data/<KEY>.json` + `data/manifest.json`           |
| `fetch-stocks.mjs [TICKERS…]` | Fetch individual US stocks (daily OHLCV), **partitioned by year**. Defaults to a small demo universe.                                 | `data/stocks/<SYMBOL>/<YEAR>.json` + meta/manifest |
| `refresh-all.mjs`             | Runs `fetch-market-data` then re-fetches every stock already in `data/stocks/manifest.json`. **The single command cron should call.** | both of the above                                  |

### Run manually

```bash
cd backend
node scripts/fetch-market-data.mjs            # core series
node scripts/fetch-stocks.mjs TSLA META       # add/update specific stocks
node scripts/refresh-all.mjs                  # refresh everything currently tracked
```

A full refresh of the 32 core series takes ~15s; each stock ~0.5s.

## Recommended schedule (how often)

US end-of-day data is final ~2 hours after the 4:00 pm ET close. Refresh **once per trading day**,
in the evening ET. Intraday signals do **not** need these scripts — enable the in-app scheduler instead.

| Cadence                 | When                       | Why                                                                                   |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| **Daily (recommended)** | ~18:30 US/Eastern, Mon–Fri | EOD data is settled; daily strategies (MA/momentum/RSI) only change on the close.     |
| Weekly                  | Sat morning                | Fine if you only run monthly-rebalanced strategies and don't need fresh daily charts. |
| Intraday (1m/1h)        | n/a for scripts            | Use `SIGNALS_LIVE=true` + `SIGNALS_DATA_INTERVAL=1m` in the running app, not cron.    |

### Cron example (server in US/Eastern)

```cron
# Refresh the market-data snapshot every weekday at 18:30 ET
30 18 * * 1-5  cd /path/to/repo/backend && /usr/bin/node scripts/refresh-all.mjs >> /var/log/quantdesk-refresh.log 2>&1
```

If your server runs in UTC, schedule `30 22 * * 1-5` (≈18:30 EST) / `30 21` during EDT, or set
`CRON_TZ=America/New_York` at the top of the crontab.

### macOS (launchd) / CI alternatives

- **launchd**: a `StartCalendarInterval` plist calling `node scripts/refresh-all.mjs`.
- **GitHub Actions / Vercel Cron**: schedule a job that runs `refresh-all.mjs` and commits/deploys the
  updated `data/` (good for keeping the deployed snapshot fresh without a long-running server).

## Notes

- Scripts are idempotent: re-running re-fetches and overwrites. Stocks are partitioned by year, so an
  incremental updater only needs to rewrite the current year (prior years are immutable).
- Data source: Yahoo Finance chart API (free, no key). Be considerate of rate limits — the scripts
  already pause ~350 ms between symbols. For large stock universes, gitignore `data/stocks/` and fetch
  on deploy/CI rather than committing it.
- What the data contains / what's missing (fundamentals, intraday) is documented in
  `../../documents/FEAT-1/development/DATA.md`.
