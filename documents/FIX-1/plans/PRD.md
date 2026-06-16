# FIX-1 — Vercel serverless function exceeds 250 MB unzipped limit

## Problem

Deploying the backend to Vercel fails with:

> A Serverless Function has exceeded the unzipped maximum size of 250 MB.

The backend serverless function bundles the committed market-data directory via
[`backend/vercel.json`](../../../backend/vercel.json):

```json
"functions": {
  "api/index.ts": { "includeFiles": "{../shared/**/*,data/**/*}" }
}
```

`backend/data/` is **~416 MB** — `data/stocks/` alone is ~396 MB (497 S&P 500 tickers ×
year-partitioned daily OHLCV back to the 1980s). Together with the traced `node_modules`, the
function is roughly **double** the 250 MB ceiling. The 250 MB limit measures the on-disk size of all
files in the deployed function after Vercel unpacks its own transport layer.

## Constraints

- **Stay on Vercel.** Moving the backend to a long-running container host (Railway/Render/Fly.io)
  was considered and rejected for this fix — the team wants to keep the existing Vercel deployment.
- **No data loss.** All 10 strategies must keep working, including the stock-factor strategies
  (`06–10`) that need the full S&P 500 universe history.
- **Keep it free.** No paid storage add-ons (Vercel Blob, S3) — those were considered and rejected
  (Blob's free tier fits the storage but introduces cold-start download + bandwidth + 10 s timeout
  problems for a dataset that must be fully loaded at boot).

## Options considered

| Option | Verdict |
| --- | --- |
| Externalize data to Vercel Blob / S3 | Rejected — free storage fits, but every cold start would download/parse the full dataset, blowing the 10 s init timeout and the 10 GB/mo free bandwidth. |
| Move backend to a container host | Rejected for this fix — viable long-term, but the team wants to stay on Vercel. |
| **Gzip the committed JSON, decompress at runtime** | **Chosen** — Vercel counts `.json.gz` at its compressed size, and the dataset compresses ~4.3x (416 MB → ~85 MB), comfortably under 250 MB. Smallest code change, keeps everything free and on Vercel. |

## Chosen solution

Commit the large data files **gzip-compressed** (`*.json.gz`) and decompress them in-process when the
backend loads its market data. Vercel does not decompress arbitrary data files, so a committed
`.json.gz` only costs its compressed bytes toward the 250 MB bundle.

### Requirements

1. A repeatable script compresses every large data JSON in `backend/data/` in place to `.json.gz`.
2. `MarketDataService` reads both `.json` and `.json.gz` transparently, preferring a plain `.json`
   (fresh from a fetch script) and falling back to `.json.gz` (the committed/deployed form).
3. Manifests (`manifest.json`) and per-stock `meta.json` stay uncompressed — they are tiny and
   `manifest.json` is the marker `resolveDataDir()` relies on.
4. No change required to `vercel.json` (`includeFiles: data/**/*` still matches the `.gz` files).
5. All existing backend tests continue to pass against the compressed data.

## Residual risks (out of scope for this fix, documented for follow-up)

The 250 MB bundle error is fully resolved by this change. Two **serverless-runtime** limits remain
and are NOT addressed here:

- **10 s cold-start init timeout** — decompressing ~85 MB and `JSON.parse`-ing it into ~416 MB of
  objects at boot is CPU-bound and may approach the limit.
- **Function memory** — the parsed dataset expands to ~1 GB+ of heap.

If either is hit in production, the planned fallback is to trim the stock payload to only the fields
actually consumed (`{d, a}` — adjusted close; see
[DATA.md](../../FEAT-1/development/DATA.md)), which cuts the parse/heap load ~3x on top of gzip.

## Success criteria

- Backend deploys to Vercel without the 250 MB error.
- `backend/data/` on-disk size < 100 MB.
- `cd backend && npm run test` passes (strategies load and backtest correctly from `.gz`).
