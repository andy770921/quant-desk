# Real-time Signals — Architecture

## Question answered

Are buy/sell timings precomputed/hardcoded, or computed live? **The signal logic is computed live**
— each strategy is a pure `decide(ctx)` function evaluated against the data; nothing is hardcoded to
a date. The only thing that was static was the **price data** (a startup JSON snapshot). This feature
adds a refreshable data layer + a dedicated live-signal path + scheduling so the platform can drive
real-time buy/sell alerts that react to the latest prices.

## Components

| Layer | Where | Role |
|-------|-------|------|
| Live data | `market-data/yahoo.client.ts`, `MarketDataService.refreshFromLive()` | Pull latest bars (Yahoo, no key), merge into the raw store, atomically rebuild calendar + logical assets. `interval='1d'` for EOD; `'1h'`/`'1m'` (short range) for intraday. |
| Current signal | `signals/signals.service.ts` → `getCurrentSignal()` | Evaluate a strategy's target allocation **at the latest index** (`decide(makeContext(md, lastIndex))`). Live, never time-cached. |
| Change detection | `SignalsService.detectChanges()` | Compare each strategy's current allocation signature to the previous evaluation; emit `SignalChange[]`. First call seeds the baseline silently. |
| Scheduler | `signals/signals.scheduler.ts` | Opt-in `setInterval` loop: refresh → re-evaluate → dispatch changes. No extra dependency. |
| Notify | `notifications/notifications.service.ts` | Receives changes; logs today (Email/LINE wiring is the next step). |

## API

- `GET /api/signals` — live target allocation for all strategies.
- `GET /api/signals/:id` — one strategy.
- `POST /api/signals/refresh?interval=1d&range=5d` — pull latest prices, rebuild, re-evaluate, return changes.

## Cadence (daily / hourly / minute)

Enable + tune via env (the scheduler is **off by default** so dev/test runs don't poll the data API):

```
SIGNALS_LIVE=true
SIGNALS_INTERVAL_MS=3600000   # 1h. 86400000 ≈ daily, 60000 = 1 min
SIGNALS_DATA_INTERVAL=1d      # 1d (EOD) | 1h | 1m | 5m
SIGNALS_DATA_RANGE=5d         # recent window pulled each poll (use 1d for intraday)
```

- **Daily**: `INTERVAL=1d`, poll once after the close. MAs/RSI use daily closes; signals settle once/day.
- **Hourly / minute**: `INTERVAL=1h`/`1m`, short range. The latest intraday price updates "today's"
  bar, so signals (e.g. price crossing the 20-day MA) can flip intraday and fire an alert immediately.

A full daily refresh of all 32 symbols takes ~3s in practice. For high-frequency intraday, narrow the
refresh to the underlying index/yield symbols to stay within the free API's limits.

## Production hardening (next steps)

- Persist signal state + user subscriptions in a DB (currently in-memory).
- Wire real Email (SES/Resend) + LINE Messaging API in `NotificationsService`; add auth.
- For sub-minute / many symbols, move to a dedicated data feed (websocket/quote API) and a job queue.
- Run the scheduler in a single worker (not per serverless invocation) — Vercel cron or a long-running worker.
