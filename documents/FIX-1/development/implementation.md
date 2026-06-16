# FIX-1 — Implementation: gzip-compressed market data

Resolves the Vercel "Serverless Function exceeded 250 MB unzipped" error by committing the
market-data files gzip-compressed and decompressing them in-process. See
[PRD](../plans/PRD.md) for the problem statement and the options considered.

## Result

| | Before | After |
| --- | --- | --- |
| `backend/data/` on-disk | ~416 MB | **~85 MB** (4.3x smaller) |
| Files compressed | — | 17,661 (`*.json` → `*.json.gz`) |
| Backend tests | pass | pass (6/6) |

The function bundle (compressed data + traced `node_modules`) now sits well under the 250 MB limit.

## Changes

### 1. Runtime read path — `backend/src/market-data/market-data.service.ts`

- Imported `gunzipSync` from `node:zlib`.
- Added `readJsonFile<T>(file)`: reads a plain `.json` if present, otherwise falls back to
  `${file}.gz` (gunzip + parse), returning `undefined` if neither exists. Preferring the plain file
  keeps the local dev loop fast right after a fetch, while deploys read the committed `.gz`.
- Routed `loadRaw()` (core series) and `loadStocks()` (year-partitioned stock files) through the
  helper.
- `resolveDataDir()` is unchanged — it still detects the data dir via the uncompressed
  `manifest.json` marker.

### 2. Compression script — `backend/scripts/compress-data.mjs` (new)

- Recursively walks `backend/data/`, gzips every `*.json` (level 9) to `*.json.gz`, and removes the
  original.
- Skips `manifest.json` and `meta.json` (tiny; `manifest.json` is the dir marker).
- Prints the compression ratio and the resulting on-disk total.

### 3. npm script — `backend/package.json`

- Added `"compress:data": "node scripts/compress-data.mjs"`.

### 4. Docs — `CLAUDE.md`

- Documented that data is committed gzip-compressed and that `npm run compress:data` must be run
  (and the resulting `.gz` committed) after any fetch, before deploying.

## Workflow after this change

```bash
cd backend
node scripts/fetch-market-data.mjs        # or fetch-stocks.mjs / refresh-all.mjs — writes plain .json
npm run compress:data                      # .json → .json.gz (removes the plain .json)
# commit the updated *.json.gz, then deploy
```

The read path tolerates a mixed tree: years rewritten by a fetch exist as fresh `.json` (preferred),
untouched years remain as `.gz` (fallback). `compress:data` only processes `.json` files, leaving
existing `.gz` untouched until their source is re-fetched.

## Verification

```bash
cd backend && npx jest src/backtest/strategy-eval.spec.ts   # boots MarketDataService on real .gz data
cd backend && npm run test                                  # full suite — 6/6 pass
```

All 10 strategies (including the stock-factor strategies `06–10` that require the full stock
universe) produce identical scoreboard numbers reading from the compressed data.

## Not done (see PRD "Residual risks")

The serverless **10 s cold-start** and **memory** limits are not addressed here. Fallback if hit:
trim the stock payload to `{d, a}` to cut parse/heap load ~3x on top of gzip.
